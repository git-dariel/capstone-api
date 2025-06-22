import { NextFunction, Response } from "express";
import { Role } from "../generated/prisma";
import { AuthRequest } from "./verifyToken";

export const requireRole = (allowedRoles: Role[]) => {
	return (target: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>) => {
		return async (req: AuthRequest, res: Response, next: NextFunction) => {
			// Check if user is authenticated (has role from token verification)
			if (!req.role) {
				res.status(401).json({ message: "Authentication required" });
				return;
			}

			// Check if user has required role
			if (!allowedRoles.includes(req.role)) {
				res.status(403).json({
					message: "Insufficient permissions",
					required: allowedRoles,
					current: req.role,
				});
				return;
			}

			// User has required role, proceed to controller
			await target(req, res, next);
		};
	};
};

/**
 * Convenience decorators for common role combinations
 */
export const requireAdmin = requireRole([Role.admin, Role.super_admin]);
export const requireSuperAdmin = requireRole([Role.super_admin]);
export const requireUser = requireRole([Role.user]);
export const requireAnyRole = requireRole([Role.user, Role.admin, Role.super_admin]);

/**
 * Alternative decorator that can be applied to controller objects
 * This allows protecting entire controller methods after creation
 */
export const protectController = <T extends Record<string, any>>(
	controller: T,
	protections: Partial<Record<keyof T, Role[]>>,
): T => {
	const protectedController = { ...controller } as any;

	for (const [methodName, allowedRoles] of Object.entries(protections)) {
		if (typeof controller[methodName] === "function") {
			protectedController[methodName] = requireRole(allowedRoles as Role[])(
				controller[methodName] as any,
			);
		}
	}

	return protectedController;
};

export default requireRole;
