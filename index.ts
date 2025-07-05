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

app.use(express.json());
app.use(cookieParser());
corsMiddleware(app);

// Set up routes that don't need authentication
if (process.env.NODE_ENV !== "production") {
	app.use(`${config.baseApiPath}/docs`, swaggerUi.serve, swaggerUi.setup(openApiSpecs()));
}

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

const server = createServer(app);
const io = new Server(server);

app.use((req: Request, res: Response, next: NextFunction) => {
	(req as any).io = io;
	next();
});

server.listen(config.port, async () => {
	await connectDb();
	console.log(`Server is running on port ${config.port}`);
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
