import express, { Router } from "express";
import { controller } from "./audit-logs.controller";
import { router } from "./audit-logs.router";
import { PrismaClient } from "../../generated/prisma";
import { auditMiddlewares } from "../../middleware/auditMiddleware";

module.exports = (prisma: PrismaClient): Router => {
	const auditLogsRouter = router(express.Router(), controller(prisma));

	// Apply audit middleware for tracking access to audit logs
	auditLogsRouter.use(
		auditMiddlewares.generic(prisma, {
			entityType: "AuditLog",
			module: "audit-logs",
			captureRequestBody: false,
			captureResponseBody: false,
		}),
	);

	return auditLogsRouter;
};
