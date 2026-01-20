import { Request, Response, NextFunction } from "express";
import { PrismaClient, AuditAction } from "../generated/prisma";
import { AuthRequest } from "./verifyToken";
import { extractAuditContext, auditHelpers } from "../helper/audit.helper";
import { getLogger } from "../helper/logger";

const logger = getLogger();
const auditMiddleware = logger.child({ module: "audit-middleware" });

export interface AuditMiddlewareOptions {
	action?: AuditAction;
	entityType?: string;
	module?: string;
	skipLogging?: boolean;
	customDescription?: string;
	captureRequestBody?: boolean;
	captureResponseBody?: boolean;
}

/**
 * Audit middleware factory function
 */
export const createAuditMiddleware = (
	prisma: PrismaClient,
	options: AuditMiddlewareOptions = {},
) => {
	return async (req: AuthRequest, res: Response, next: NextFunction) => {
		// Skip if explicitly disabled or for certain routes
		if (options.skipLogging || shouldSkipLogging(req)) {
			return next();
		}

		const startTime = Date.now();
		const originalSend = res.send;
		const originalJson = res.json;

		// Capture response data
		let responseBody: any = null;
		let statusCode: number = 200;

		// Override res.send to capture response
		res.send = function (body: any) {
			if (options.captureResponseBody && body) {
				try {
					responseBody = typeof body === "string" ? JSON.parse(body) : body;
				} catch {
					responseBody = body;
				}
			}
			statusCode = res.statusCode;
			return originalSend.call(this, body);
		};

		// Override res.json to capture response
		res.json = function (body: any) {
			if (options.captureResponseBody) {
				responseBody = body;
			}
			statusCode = res.statusCode;
			return originalJson.call(this, body);
		};

		// Continue with request processing
		next();

		// Log after response is sent (in next tick to ensure response is complete)
		process.nextTick(async () => {
			try {
				const endTime = Date.now();
				const duration = endTime - startTime;
				const context = extractAuditContext(req);

				// Determine action from HTTP method and route if not specified
				const action = options.action || determineActionFromRequest(req);
				const entityType =
					options.entityType || extractEntityTypeFromRoute(req.route?.path || req.path);
				const module =
					options.module || extractModuleFromRoute(req.route?.path || req.path);

				// Skip logging for certain conditions
				if (!shouldLogAction(action, statusCode, req)) {
					return;
				}

				// Extract entity ID from params or response
				const entityId = extractEntityId(req, responseBody);

				// Prepare audit metadata
				const metadata = {
					method: req.method,
					url: req.originalUrl || req.url,
					statusCode,
					duration,
					userAgent: req.headers["user-agent"],
					requestId: req.headers["x-request-id"],
					...(options.captureRequestBody && {
						requestBody: sanitizeRequestBody(req.body),
					}),
					...(options.captureResponseBody && {
						responseBody: sanitizeResponseBody(responseBody),
					}),
				};

				// Create description
				const description =
					options.customDescription ||
					createDefaultDescription(
						action,
						entityType,
						req.method,
						statusCode,
						context.userName,
					);

				// Log the audit entry
				await auditHelpers.logCreate(
					prisma,
					entityType,
					entityId || "unknown",
					module,
					{
						method: req.method,
						url: req.originalUrl,
						statusCode,
						...(options.captureResponseBody && responseBody && { data: responseBody }),
					},
					context,
					metadata,
				);

				auditMiddleware.debug("Request audited", {
					method: req.method,
					url: req.originalUrl,
					statusCode,
					duration,
					userId: context.userId,
					action,
					entityType,
				});
			} catch (error) {
				auditMiddleware.error("Failed to create audit log for request", {
					error: error instanceof Error ? error.message : "Unknown error",
					method: req.method,
					url: req.originalUrl,
					userId: req.userId,
				});
			}
		});
	};
};

/**
 * Determine if logging should be skipped for this request
 */
const shouldSkipLogging = (req: Request): boolean => {
	const skipPatterns = [
		"/health",
		"/ping",
		"/metrics",
		"/favicon.ico",
		"/robots.txt",
		"/api/loggings",
		"/api/audit-logs",
	];

	const skipMethods = ["OPTIONS"];

	return (
		skipPatterns.some((pattern) => req.path.includes(pattern)) ||
		skipMethods.includes(req.method) ||
		req.path.endsWith("/") ||
		req.headers["x-skip-audit"] === "true"
	);
};

/**
 * Determine action from HTTP method and route
 */
const determineActionFromRequest = (req: Request): AuditAction => {
	const method = req.method.toLowerCase();
	const path = req.route?.path || req.path;

	// Special cases for specific endpoints
	if (path.includes("/login")) return AuditAction.LOGIN;
	if (path.includes("/logout")) return AuditAction.LOGOUT;
	if (path.includes("/approve")) return AuditAction.APPROVE;
	if (path.includes("/reject")) return AuditAction.REJECT;
	if (path.includes("/cancel")) return AuditAction.CANCEL;
	if (path.includes("/activate")) return AuditAction.ACTIVATE;
	if (path.includes("/deactivate")) return AuditAction.DEACTIVATE;
	if (path.includes("/restore")) return AuditAction.RESTORE;
	if (path.includes("/export")) return AuditAction.EXPORT;
	if (path.includes("/upload")) return AuditAction.FILE_UPLOAD;
	if (path.includes("/download")) return AuditAction.FILE_DOWNLOAD;

	// Standard CRUD operations
	switch (method) {
		case "post":
			return AuditAction.CREATE;
		case "put":
		case "patch":
			return AuditAction.UPDATE;
		case "delete":
			return AuditAction.DELETE;
		case "get":
			return AuditAction.VIEW;
		default:
			return AuditAction.VIEW;
	}
};

/**
 * Extract entity type from route path
 */
const extractEntityTypeFromRoute = (path: string): string => {
	const segments = path.split("/").filter(Boolean);

	// Remove 'api' if present
	if (segments[0] === "api") {
		segments.shift();
	}

	// Get the first segment and capitalize
	const entitySegment = segments[0] || "unknown";

	// Convert kebab-case or plural to singular PascalCase
	return entitySegment
		.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
		.replace(/s$/, "") // Remove trailing 's' for plurals
		.replace(/^[a-z]/, (letter) => letter.toUpperCase());
};

/**
 * Extract module from route path
 */
const extractModuleFromRoute = (path: string): string => {
	const segments = path.split("/").filter(Boolean);

	if (segments[0] === "api") {
		segments.shift();
	}

	return segments[0] || "unknown";
};

/**
 * Extract entity ID from request params or response
 */
const extractEntityId = (req: Request, responseBody: any): string | null => {
	// Try to get ID from URL params
	if (req.params.id) {
		return req.params.id;
	}

	// Try to get ID from other common param names
	const commonIdParams = ["userId", "appointmentId", "inventoryId", "studentId"];
	for (const param of commonIdParams) {
		if (req.params[param]) {
			return req.params[param];
		}
	}

	// Try to get ID from response body
	if (responseBody && typeof responseBody === "object") {
		if (responseBody.id) return responseBody.id;
		if (responseBody.data?.id) return responseBody.data.id;
		if (responseBody.result?.id) return responseBody.result.id;
	}

	return null;
};

/**
 * Determine if action should be logged based on conditions
 */
const shouldLogAction = (action: AuditAction, statusCode: number, req: Request): boolean => {
	// Don't log successful VIEW actions for GET requests (too verbose)
	if (
		action === AuditAction.VIEW &&
		req.method === "GET" &&
		statusCode >= 200 &&
		statusCode < 300
	) {
		return false;
	}

	// Always log security actions
	const securityActions: AuditAction[] = [
		AuditAction.LOGIN,
		AuditAction.LOGOUT,
		AuditAction.CHANGE_ROLE,
	];
	if (securityActions.includes(action)) {
		return true;
	}

	// Always log modification actions
	const modificationActions: AuditAction[] = [
		AuditAction.CREATE,
		AuditAction.UPDATE,
		AuditAction.DELETE,
	];
	if (modificationActions.includes(action)) {
		return true;
	}

	// Log failed requests
	if (statusCode >= 400) {
		return true;
	}

	return false;
};

/**
 * Create default description for audit log
 */
const createDefaultDescription = (
	action: AuditAction,
	entityType: string,
	method: string,
	statusCode: number,
	userName?: string,
): string => {
	const user = userName || "Unknown user";
	const status = statusCode >= 400 ? "failed to" : "successfully";

	const actionDescriptions: Record<AuditAction, string> = {
		[AuditAction.CREATE]: `${user} ${status} created ${entityType}`,
		[AuditAction.UPDATE]: `${user} ${status} updated ${entityType}`,
		[AuditAction.DELETE]: `${user} ${status} deleted ${entityType}`,
		[AuditAction.VIEW]: `${user} ${status} viewed ${entityType}`,
		[AuditAction.LOGIN]: `${user} ${status} logged in`,
		[AuditAction.LOGOUT]: `${user} ${status} logged out`,
		[AuditAction.APPROVE]: `${user} ${status} approved ${entityType}`,
		[AuditAction.REJECT]: `${user} ${status} rejected ${entityType}`,
		[AuditAction.CANCEL]: `${user} ${status} cancelled ${entityType}`,
		[AuditAction.RESTORE]: `${user} ${status} restored ${entityType}`,
		[AuditAction.ASSIGN]: `${user} ${status} assigned ${entityType}`,
		[AuditAction.UNASSIGN]: `${user} ${status} unassigned ${entityType}`,
		[AuditAction.ACTIVATE]: `${user} ${status} activated ${entityType}`,
		[AuditAction.DEACTIVATE]: `${user} ${status} deactivated ${entityType}`,
		[AuditAction.RESET_PASSWORD]: `${user} ${status} reset password`,
		[AuditAction.CHANGE_ROLE]: `${user} ${status} changed role`,
		[AuditAction.BULK_UPDATE]: `${user} ${status} bulk updated ${entityType}`,
		[AuditAction.BULK_DELETE]: `${user} ${status} bulk deleted ${entityType}`,
		[AuditAction.EXPORT]: `${user} ${status} exported ${entityType}`,
		[AuditAction.FILE_UPLOAD]: `${user} ${status} uploaded file`,
		[AuditAction.FILE_DOWNLOAD]: `${user} ${status} downloaded file`,
	};

	return actionDescriptions[action] || `${user} performed ${method} on ${entityType}`;
};

/**
 * Sanitize request body for logging
 */
const sanitizeRequestBody = (body: any): any => {
	if (!body || typeof body !== "object") return body;

	const sensitiveFields = [
		"password",
		"passwordHash",
		"token",
		"secret",
		"key",
		"apiKey",
		"accessToken",
		"refreshToken",
		"otp",
		"pin",
	];

	const sanitized = { ...body };

	Object.keys(sanitized).forEach((key) => {
		if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
			sanitized[key] = "[REDACTED]";
		}
	});

	return sanitized;
};

/**
 * Sanitize response body for logging
 */
const sanitizeResponseBody = (body: any): any => {
	if (!body || typeof body !== "object") return body;

	// Limit size of logged response
	const maxResponseSize = 1000; // characters
	const stringified = JSON.stringify(body);

	if (stringified.length > maxResponseSize) {
		return { message: `[Response too large: ${stringified.length} characters]` };
	}

	return sanitizeRequestBody(body);
};

/**
 * Specific audit middleware for different actions
 */
export const auditMiddlewares = {
	/**
	 * Middleware for authentication routes
	 */
	auth: (prisma: PrismaClient) =>
		createAuditMiddleware(prisma, {
			module: "authentication",
			captureRequestBody: true,
			captureResponseBody: false, // Don't capture tokens
		}),

	/**
	 * Middleware for appointment routes
	 */
	appointment: (prisma: PrismaClient) =>
		createAuditMiddleware(prisma, {
			entityType: "Appointment",
			module: "appointment",
			captureRequestBody: true,
			captureResponseBody: true,
		}),

	/**
	 * Middleware for inventory routes
	 */
	inventory: (prisma: PrismaClient) =>
		createAuditMiddleware(prisma, {
			entityType: "Inventory",
			module: "inventory",
			captureRequestBody: true,
			captureResponseBody: true,
		}),

	/**
	 * Middleware for user management routes
	 */
	userManagement: (prisma: PrismaClient) =>
		createAuditMiddleware(prisma, {
			entityType: "User",
			module: "user-management",
			captureRequestBody: true,
			captureResponseBody: false, // Don't capture sensitive user data
		}),

	/**
	 * Middleware for student routes
	 */
	student: (prisma: PrismaClient) =>
		createAuditMiddleware(prisma, {
			entityType: "Student",
			module: "student",
			captureRequestBody: true,
			captureResponseBody: true,
		}),

	/**
	 * Generic middleware for any entity
	 */
	generic: (prisma: PrismaClient, options: AuditMiddlewareOptions = {}) =>
		createAuditMiddleware(prisma, options),
};
