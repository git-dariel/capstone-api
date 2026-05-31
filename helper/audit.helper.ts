import { Request } from "express";
import { AuditAction, AuditLog, LogSeverity, PrismaClient, Role } from "../generated/prisma";
import { getLogger } from "./logger";
import { AuthRequest } from "../middleware/verifyToken";

const logger = getLogger();
const auditLogger = logger.child({ module: "audit" });

export interface AuditLogData {
	action: AuditAction;
	entityType: string;
	entityId?: string;
	tableName?: string;
	recordId?: string;
	description: string;
	module: string;
	beforeValues?: any;
	afterValues?: any;
	changedFields?: string[];
	metadata?: any;
	riskLevel?: LogSeverity;
	isSystemAction?: boolean;
	isSecurityLog?: boolean;
}

export interface AuditContext {
	userId?: string;
	userName?: string;
	userRole?: string;
	userType?: string;
	ipAddress?: string;
	userAgent?: string;
	sessionId?: string;
}

/**
 * Extract audit context from request
 */
export const extractAuditContext = (req: Request | AuthRequest): AuditContext => {
	const authReq = req as AuthRequest;

	return {
		userId: authReq.userId,
		userName: authReq.userName || "unknown",
		userRole: authReq.role ? String(authReq.role) : "unknown",
		userType: authReq.type || "unknown",
		ipAddress: getClientIP(req),
		userAgent: req.headers["user-agent"] || "unknown",
		sessionId: (req as any).sessionID || (req.headers["x-session-id"] as string) || undefined,
	};
};

/**
 * Get client IP address from request
 */
export const getClientIP = (req: Request): string => {
	return (
		(req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
		req.ip ||
		req.connection?.remoteAddress ||
		req.socket?.remoteAddress ||
		"unknown"
	);
};

/**
 * Compare objects and return changed fields
 */
export const getChangedFields = (beforeValues: any, afterValues: any): string[] => {
	if (!beforeValues || !afterValues) return [];

	const changedFields: string[] = [];
	const allKeys = new Set([...Object.keys(beforeValues), ...Object.keys(afterValues)]);

	allKeys.forEach((key) => {
		const before = beforeValues[key];
		const after = afterValues[key];

		// Handle different data types
		if (JSON.stringify(before) !== JSON.stringify(after)) {
			changedFields.push(key);
		}
	});

	return changedFields;
};

/**
 * Sanitize sensitive data before logging
 */
export const sanitizeData = (data: any): any => {
	if (!data || typeof data !== "object") return data;

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
		"ssn",
		"socialSecurityNumber",
		"creditCard",
		"bankAccount",
	];

	const sanitized = { ...data };

	Object.keys(sanitized).forEach((key) => {
		const lowerKey = key.toLowerCase();
		if (sensitiveFields.some((field) => lowerKey.includes(field))) {
			sanitized[key] = "[REDACTED]";
		} else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
			sanitized[key] = sanitizeData(sanitized[key]);
		}
	});

	return sanitized;
};

/**
 * Determine risk level based on action and entity type
 */
export const determineRiskLevel = (
	action: AuditAction,
	entityType: string,
	isSystemAction: boolean = false,
): LogSeverity => {
	// System actions are generally lower risk
	if (isSystemAction) {
		return LogSeverity.info;
	}

	// High-risk actions
	const criticalActions: AuditAction[] = [
		AuditAction.DELETE,
		AuditAction.BULK_DELETE,
		AuditAction.CHANGE_ROLE,
		AuditAction.RESET_PASSWORD,
		AuditAction.DEACTIVATE,
	];

	// High-risk entities
	const criticalEntities = ["User", "AuditLog", "System"];

	if (criticalActions.includes(action) || criticalEntities.includes(entityType)) {
		return LogSeverity.critical;
	}

	// Medium-risk actions
	const highRiskActions: AuditAction[] = [
		AuditAction.UPDATE,
		AuditAction.ACTIVATE,
		AuditAction.APPROVE,
		AuditAction.REJECT,
		AuditAction.BULK_UPDATE,
	];

	if (highRiskActions.includes(action)) {
		return LogSeverity.high;
	}

	// Security-related actions
	const securityActions: AuditAction[] = [AuditAction.LOGIN, AuditAction.LOGOUT];
	if (securityActions.includes(action)) {
		return LogSeverity.medium;
	}

	// Default to info level
	return LogSeverity.info;
};

/**
 * Check if action is security-related
 */
export const isSecurityAction = (action: AuditAction): boolean => {
	const securityActions: AuditAction[] = [
		AuditAction.LOGIN,
		AuditAction.LOGOUT,
		AuditAction.RESET_PASSWORD,
		AuditAction.CHANGE_ROLE,
		AuditAction.ACTIVATE,
		AuditAction.DEACTIVATE,
	];

	return securityActions.includes(action);
};

/**
 * Calculate retention date based on risk level
 */
export const calculateRetentionDate = (riskLevel: LogSeverity): Date => {
	const now = new Date();
	const retentionDays = {
		[LogSeverity.critical]: 2555, // 7 years
		[LogSeverity.high]: 1825, // 5 years
		[LogSeverity.medium]: 1095, // 3 years
		[LogSeverity.low]: 365, // 1 year
		[LogSeverity.info]: 365, // 1 year
	};

	const days = retentionDays[riskLevel] || 365;
	now.setDate(now.getDate() + days);
	return now;
};

/**
 * Create audit log entry
 */
export const createAuditLog = async (
	prisma: PrismaClient,
	auditData: AuditLogData,
	context: AuditContext,
): Promise<AuditLog | null> => {
	try {
		// Sanitize data
		const sanitizedBeforeValues = auditData.beforeValues
			? sanitizeData(auditData.beforeValues)
			: null;
		const sanitizedAfterValues = auditData.afterValues
			? sanitizeData(auditData.afterValues)
			: null;

		// Determine risk level if not provided
		const riskLevel =
			auditData.riskLevel ||
			determineRiskLevel(auditData.action, auditData.entityType, auditData.isSystemAction);

		// Calculate retention date
		const retentionDate = calculateRetentionDate(riskLevel);

		// Get changed fields if not provided
		const changedFields =
			auditData.changedFields ||
			getChangedFields(auditData.beforeValues, auditData.afterValues);

		const auditLog = await prisma.auditLog.create({
			data: {
				action: auditData.action,
				entityType: auditData.entityType,
				entityId: auditData.entityId,
				tableName: auditData.tableName,
				recordId: auditData.recordId,
				userId: context.userId,
				userName: context.userName,
				userRole: context.userRole,
				userType: context.userType,
				ipAddress: context.ipAddress,
				userAgent: context.userAgent,
				sessionId: context.sessionId,
				description: auditData.description,
				module: auditData.module,
				beforeValues: sanitizedBeforeValues,
				afterValues: sanitizedAfterValues,
				changedFields,
				metadata: auditData.metadata,
				riskLevel,
				isSystemAction: auditData.isSystemAction || false,
				isSecurityLog: auditData.isSecurityLog || isSecurityAction(auditData.action),
				retentionDate,
			},
		});

		auditLogger.info(`Audit log created: ${auditData.action} on ${auditData.entityType}`, {
			auditLogId: auditLog.id,
			userId: context.userId,
			action: auditData.action,
			entityType: auditData.entityType,
			entityId: auditData.entityId,
		});

		return auditLog;
	} catch (error) {
		auditLogger.error("Failed to create audit log", {
			error: error instanceof Error ? error.message : "Unknown error",
			auditData: {
				...auditData,
				beforeValues: "[TRUNCATED]",
				afterValues: "[TRUNCATED]",
			},
			context,
		});
		return null;
	}
};

/**
 * Create system audit log (for automated actions)
 */
export const createSystemAuditLog = async (
	prisma: PrismaClient,
	auditData: Omit<AuditLogData, "isSystemAction">,
): Promise<AuditLog | null> => {
	const systemContext: AuditContext = {
		userId: undefined,
		userName: "system",
		userRole: "system",
		userType: "system",
		ipAddress: "127.0.0.1",
		userAgent: "system",
		sessionId: "system",
	};

	return createAuditLog(prisma, { ...auditData, isSystemAction: true }, systemContext);
};

/**
 * Audit log helpers for specific actions
 */
export const auditHelpers = {
	/**
	 * Log user login
	 */
	logLogin: async (
		prisma: PrismaClient,
		userId: string,
		context: AuditContext,
		metadata?: any,
	) => {
		const success = metadata?.success !== false;
		const actionDescription = success
			? `User ${context.userName} successfully logged in`
			: `Failed login attempt for user ${context.userName}`;

		return createAuditLog(
			prisma,
			{
				action: AuditAction.LOGIN,
				entityType: "User",
				entityId: userId,
				description: actionDescription,
				module: "authentication",
				metadata: {
					loginMethod: metadata?.loginMethod || "email",
					...metadata,
				},
				isSecurityLog: true,
				riskLevel: success ? LogSeverity.info : LogSeverity.medium,
			},
			context,
		);
	},

	/**
	 * Log user logout
	 */
	logLogout: async (prisma: PrismaClient, userId: string, context: AuditContext) => {
		return createAuditLog(
			prisma,
			{
				action: AuditAction.LOGOUT,
				entityType: "User",
				entityId: userId,
				description: `User ${context.userName} logged out`,
				module: "authentication",
				isSecurityLog: true,
			},
			context,
		);
	},

	/**
	 * Log record creation
	 */
	logCreate: async (
		prisma: PrismaClient,
		entityType: string,
		entityId: string,
		module: string,
		afterValues: any,
		context: AuditContext,
		metadata?: any,
	) => {
		return createAuditLog(
			prisma,
			{
				action: AuditAction.CREATE,
				entityType,
				entityId,
				description: `Created ${entityType} record`,
				module,
				afterValues,
				metadata,
			},
			context,
		);
	},

	/**
	 * Log record update
	 */
	logUpdate: async (
		prisma: PrismaClient,
		entityType: string,
		entityId: string,
		module: string,
		beforeValues: any,
		afterValues: any,
		context: AuditContext,
		metadata?: any,
	) => {
		const changedFields = getChangedFields(beforeValues, afterValues);

		return createAuditLog(
			prisma,
			{
				action: AuditAction.UPDATE,
				entityType,
				entityId,
				description: `Updated ${entityType} record (${changedFields.join(", ")})`,
				module,
				beforeValues,
				afterValues,
				changedFields,
				metadata,
			},
			context,
		);
	},

	/**
	 * Log record deletion
	 */
	logDelete: async (
		prisma: PrismaClient,
		entityType: string,
		entityId: string,
		module: string,
		beforeValues: any,
		context: AuditContext,
		metadata?: any,
	) => {
		return createAuditLog(
			prisma,
			{
				action: AuditAction.DELETE,
				entityType,
				entityId,
				description: `Deleted ${entityType} record`,
				module,
				beforeValues,
				riskLevel: LogSeverity.critical,
				metadata,
			},
			context,
		);
	},

	/**
	 * Log appointment actions
	 */
	logAppointmentAction: async (
		prisma: PrismaClient,
		action: AuditAction,
		appointmentId: string,
		context: AuditContext,
		beforeValues?: any,
		afterValues?: any,
		metadata?: any,
	) => {
		const actionDescriptions: Record<AuditAction, string> = {
			[AuditAction.CREATE]: "created appointment",
			[AuditAction.UPDATE]: "updated appointment",
			[AuditAction.DELETE]: "deleted appointment",
			[AuditAction.LOGIN]: "logged in",
			[AuditAction.LOGOUT]: "logged out",
			[AuditAction.VIEW]: "viewed appointment",
			[AuditAction.EXPORT]: "exported appointment",
			[AuditAction.APPROVE]: "approved appointment",
			[AuditAction.REJECT]: "rejected appointment",
			[AuditAction.CANCEL]: "cancelled appointment",
			[AuditAction.RESTORE]: "restored appointment",
			[AuditAction.ASSIGN]: "assigned appointment",
			[AuditAction.UNASSIGN]: "unassigned appointment",
			[AuditAction.ACTIVATE]: "activated appointment",
			[AuditAction.DEACTIVATE]: "deactivated appointment",
			[AuditAction.RESET_PASSWORD]: "reset password",
			[AuditAction.CHANGE_ROLE]: "changed role",
			[AuditAction.BULK_UPDATE]: "bulk updated appointment",
			[AuditAction.BULK_DELETE]: "bulk deleted appointment",
			[AuditAction.FILE_UPLOAD]: "uploaded file",
			[AuditAction.FILE_DOWNLOAD]: "downloaded file",
		};

		return createAuditLog(
			prisma,
			{
				action,
				entityType: "Appointment",
				entityId: appointmentId,
				description: `User ${context.userName} ${actionDescriptions[action] || "performed action on appointment"}`,
				module: "appointment",
				beforeValues,
				afterValues,
				metadata,
			},
			context,
		);
	},

	/**
	 * Log inventory changes
	 */
	logInventoryChange: async (
		prisma: PrismaClient,
		action: AuditAction,
		inventoryId: string,
		context: AuditContext,
		beforeValues?: any,
		afterValues?: any,
		metadata?: any,
	) => {
		return createAuditLog(
			prisma,
			{
				action,
				entityType: "Inventory",
				entityId: inventoryId,
				description: `Inventory ${action.toLowerCase()} by ${context.userName}`,
				module: "inventory",
				beforeValues,
				afterValues,
				metadata,
			},
			context,
		);
	},

	/**
	 * Log role changes
	 */
	logRoleChange: async (
		prisma: PrismaClient,
		targetUserId: string,
		oldRole: string,
		newRole: string,
		context: AuditContext,
	) => {
		return createAuditLog(
			prisma,
			{
				action: AuditAction.CHANGE_ROLE,
				entityType: "User",
				entityId: targetUserId,
				description: `User role changed from ${oldRole} to ${newRole} by ${context.userName}`,
				module: "user-management",
				beforeValues: { role: oldRole },
				afterValues: { role: newRole },
				riskLevel: LogSeverity.critical,
				isSecurityLog: true,
			},
			context,
		);
	},

	/**
	 * Log file operations
	 */
	logFileOperation: async (
		prisma: PrismaClient,
		action: AuditAction,
		fileName: string,
		context: AuditContext,
		metadata?: any,
	) => {
		return createAuditLog(
			prisma,
			{
				action,
				entityType: "File",
				entityId: fileName,
				description: `File ${action === AuditAction.FILE_UPLOAD ? "uploaded" : "downloaded"}: ${fileName}`,
				module: "file-management",
				metadata: {
					fileName,
					fileSize: metadata?.fileSize,
					fileType: metadata?.fileType,
					...metadata,
				},
			},
			context,
		);
	},
};
