import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { Role } from "./generated/prisma";
import { config } from "./config/config";
import openApiSpecs from "./docs/openApiSpecs";
import verifyToken from "./middleware/verifyToken";
import verifyRole from "./middleware/verifyRole";
import { connectDb, getPrismaClient } from "./config/database";
import { corsMiddleware } from "./config/cors.config";
import { time } from "console";

const app = express();
const prisma = getPrismaClient();

const auth = require("./app/auth")(prisma);
const user = require("./app/user")(prisma);
const person = require("./app/person")(prisma);
const student = require("./app/student")(prisma);
const announcement = require("./app/announcement")(prisma);
const loggings = require("./app/loggings")(prisma);
const anxiety = require("./app/anxiety")(prisma);
const stress = require("./app/stress")(prisma);
const depression = require("./app/depression")(prisma);
const consent = require("./app/consent")(prisma);
const suicide = require("./app/suicide")(prisma);
const metrics = require("./app/metrics")(prisma);
const retakeRequest = require("./app/retake-request")(prisma);
const message = require("./app/message")(prisma);
const appointment = require("./app/appointment")(prisma);
const schedule = require("./app/schedule")(prisma);
const inventory = require("./app/inventory")(prisma);

app.use(express.json());
app.use(cookieParser());
corsMiddleware(app);

const server = createServer(app);
const io = new Server(server, {
	cors: {
		origin: process.env.CLIENT_URL || ["http://localhost:5173", "http://localhost:3001"],
		methods: ["GET", "POST", "PUT", "DELETE"],
		credentials: true,
	},
});

// Enhanced socket connection handling with logging
io.on("connection", (socket) => {
	console.log("Socket client connected:", socket.id);

	// Handle user room joining
	socket.on("join_user_room", (userId: string) => {
		console.log(`User ${userId} joining room: user_${userId}`);
		socket.join(`user_${userId}`);

		// Confirm room joined
		socket.emit("room_joined", { room: `user_${userId}`, userId });
		console.log(`User ${userId} successfully joined room: user_${userId}`);
	});

	// Handle disconnection
	socket.on("disconnect", (reason) => {
		console.log("Socket client disconnected:", socket.id, "Reason:", reason);
	});

	// Handle errors
	socket.on("error", (error) => {
		console.error("Socket error:", error);
	});

	// Keep connection alive with ping/pong
	socket.on("ping", () => {
		socket.emit("pong");
	});
});

app.use((req: Request, res: Response, next: NextFunction) => {
	(req as any).io = io;
	next();
});

// Set up routes that don't need authentication
if (process.env.NODE_ENV !== "production") {
	app.use(`${config.baseApiPath}/docs`, swaggerUi.serve, swaggerUi.setup(openApiSpecs()));
}

app.get(`${config.baseApiPath}/`, (_req: Request, res: Response) => {
	res.json({ message: "Welcome to the API.", version: "1.0.0", time: new Date().toISOString() });
});

// Auth routes should be public (login/register)
app.use(config.baseApiPath, auth);

// Apply middleware for protected routes
app.use(config.baseApiPath, (req: Request, res: Response, next: NextFunction) => {
	if (req.path.startsWith("/docs") || req.path.startsWith("/auth")) {
		// Skip middleware for docs and auth routes
		return next();
	}
	// Apply middleware for other routes
	verifyToken(req, res, () => {
		verifyRole([Role.admin, Role.user, Role.super_admin])(req, res, next);
	});
});

// Protected routes
app.use(config.baseApiPath, person);
app.use(config.baseApiPath, student);
app.use(config.baseApiPath, announcement);
app.use(config.baseApiPath, user);
app.use(config.baseApiPath, loggings);
app.use(config.baseApiPath, anxiety);
app.use(config.baseApiPath, stress);
app.use(config.baseApiPath, depression);
app.use(config.baseApiPath, consent);
app.use(config.baseApiPath, suicide);
app.use(config.baseApiPath, metrics);
app.use(config.baseApiPath, retakeRequest);
app.use(config.baseApiPath, message);
app.use(config.baseApiPath, appointment);
app.use(config.baseApiPath, schedule);
app.use(config.baseApiPath, inventory);

server.listen(config.port, async () => {
	await connectDb();
	console.log(`Server is running on port ${config.port}. Socket.IO server initialized.`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
	console.log("Received SIGINT, shutting down gracefully...");
	await prisma.$disconnect();
	server.close(() => {
		process.exit(0);
	});
});

process.on("SIGTERM", async () => {
	console.log("Received SIGTERM, shutting down gracefully...");
	await prisma.$disconnect();
	server.close(() => {
		process.exit(0);
	});
});
