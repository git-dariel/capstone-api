import { NextFunction, Response } from "express";
import { Role } from "../generated/prisma";
import { AuthRequest } from "./verifyToken";

const verifyRole = (allowedRoles: Role[]) => {
	return (req: AuthRequest, res: Response, next: NextFunction) => {
		if (!req.role || !allowedRoles.includes(req.role)) {
			res.status(403).json({ message: "Forbidden" });
			return;
		}
		next();
	};
};

export default verifyRole;