import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Role } from "../generated/prisma";

export interface AuthRequest extends Request {
	role?: Role;
	userId?: string;
}

interface JwtPayload {
	userId: string;
	role: Role;
}

// Routes that don't require authentication
const PUBLIC_ROUTES = [
	"/insurance/calculate",
	// Add more public routes here as needed
];

export default (req: AuthRequest, res: Response, next: NextFunction) => {
	if (PUBLIC_ROUTES.includes(req.path)) {
		return next();
	}

	const token = req.cookies.token;

	if (!token) {
		res.status(401).json({ message: "Unauthorized" });
		return;
	}

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
		req.role = decoded.role;
		req.userId = decoded.userId;
		next();
	} catch (error) {
		res.status(401).json({ message: "Invalid token" });
	}
};
