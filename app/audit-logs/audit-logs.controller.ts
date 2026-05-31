import { NextFunction, Request, Response } from "express";
import { config } from "../../config/error.config";
import { AuditAction, LogSeverity, Prisma, PrismaClient, Role } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { AuthRequest } from "../../middleware/verifyToken";

const logger = getLogger();
const auditLogger = logger.child({ module: "audit-logs" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		// Only admin and super_admin can access audit logs
		if (req.role !== Role.admin && req.role !== Role.super_admin) {
			auditLogger.warn(`Unauthorized audit log access attempt by user ${req.userId}`);
			res.status(403).json({
				error: config.ERROR.AUDIT_LOGS.UNAUTHORIZED_ACCESS,
			});
			return;
		}

		if (!id) {
			auditLogger.error(config.ERROR.AUDIT_LOGS.MISSING_ID);
			res.status(400).json({ error: config.ERROR.AUDIT_LOGS.MISSING_ID });
			return;
		}

		if (fields && typeof fields !== "string") {
			auditLogger.error(`Invalid fields parameter: ${fields}`);
			res.status(400).json({ error: config.ERROR.AUDIT_LOGS.POPULATE_MUST_BE_STRING });
			return;
		}

		auditLogger.info(`Getting audit log by ID: ${id}`);

		try {
			const query: Prisma.AuditLogFindFirstArgs = {
				where: {
					id,
					isDeleted: false,
				},
			};

			if (fields) {
				const fieldSelections = fields.split(",").reduce(
					(acc: Record<string, any>, field: string) => {
						const parts = field.trim().split(".");
						if (parts.length > 1) {
							const [parent, ...children] = parts;
							acc[parent] = acc[parent] || { select: {} };

							let current = acc[parent].select;
							for (let i = 0; i < children.length - 1; i++) {
								current[children[i]] = current[children[i]] || { select: {} };
								current = current[children[i]].select;
							}
							current[children[children.length - 1]] = true;
						} else {
							acc[parts[0]] = true;
						}
						return acc;
					},
					{ id: true } as Record<string, any>,
				);

				query.select = fieldSelections;
			} else {
				// Default include user information
				query.include = {
					user: {
						select: {
							id: true,
							userName: true,
							role: true,
							type: true,
							person: {
								select: {
									firstName: true,
									lastName: true,
									email: true,
								},
							},
						},
					},
				};
			}

			const auditLog = await prisma.auditLog.findFirst(query);

			if (!auditLog) {
				auditLogger.error(`Audit log not found: ${id}`);
				res.status(404).json({ error: config.ERROR.AUDIT_LOGS.NOT_FOUND });
				return;
			}

			auditLogger.info(`Audit log retrieved: ${auditLog.id}`);
			res.status(200).json(auditLog);
		} catch (error) {
			auditLogger.error(`Error getting audit log: ${error}`);
			res.status(500).json({ error: config.ERROR.AUDIT_LOGS.INTERNAL_SERVER_ERROR });
		}
	};

	const getAll = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		// Only admin and super_admin can access audit logs
		if (req.role !== Role.admin && req.role !== Role.super_admin) {
			auditLogger.warn(`Unauthorized audit logs access attempt by user ${req.userId}`);
			res.status(403).json({
				error: config.ERROR.AUDIT_LOGS.UNAUTHORIZED_ACCESS,
			});
			return;
		}

		const {
			page = 1,
			limit = 20,
			sort,
			fields,
			query,
			order = "desc",
			action,
			entityType,
			module,
			userId,
			riskLevel,
			isSecurityLog,
			isSystemAction,
			dateFrom,
			dateTo,
			ipAddress,
		} = req.query as Record<string, any>;

		// Validate pagination parameters
		if (isNaN(Number(page)) || Number(page) < 1) {
			auditLogger.error(`Invalid page parameter: ${page}`);
			res.status(400).json({ error: config.ERROR.AUDIT_LOGS.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1 || Number(limit) > 100) {
			auditLogger.error(`Invalid limit parameter: ${limit}`);
			res.status(400).json({ error: config.ERROR.AUDIT_LOGS.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			auditLogger.error(`Invalid order parameter: ${order}`);
			res.status(400).json({ error: config.ERROR.AUDIT_LOGS.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			auditLogger.error(`Invalid fields parameter: ${fields}`);
			res.status(400).json({ error: config.ERROR.AUDIT_LOGS.POPULATE_MUST_BE_STRING });
			return;
		}

		// Validate enum filters
		if (action && !Object.values(AuditAction).includes(action)) {
			auditLogger.error(`Invalid action filter: ${action}`);
			res.status(400).json({ error: config.ERROR.AUDIT_LOGS.INVALID_ACTION });
			return;
		}

		if (riskLevel && !Object.values(LogSeverity).includes(riskLevel)) {
			auditLogger.error(`Invalid risk level filter: ${riskLevel}`);
			res.status(400).json({ error: config.ERROR.AUDIT_LOGS.INVALID_RISK_LEVEL });
			return;
		}

		const skip = (Number(page) - 1) * Number(limit);

		auditLogger.info(
			`Getting audit logs, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
		);

		try {
			// Build date filter
			const dateFilter: any = {};
			if (dateFrom) {
				dateFilter.gte = new Date(dateFrom);
			}
			if (dateTo) {
				dateFilter.lte = new Date(dateTo);
			}

			const whereClause: Prisma.AuditLogWhereInput = {
				isDeleted: false,
				...(query
					? {
							OR: [
								{ description: { contains: String(query), mode: "insensitive" } },
								{ entityType: { contains: String(query), mode: "insensitive" } },
								{ module: { contains: String(query), mode: "insensitive" } },
								{ userName: { contains: String(query), mode: "insensitive" } },
							],
						}
					: {}),
				...(action ? { action } : {}),
				...(entityType
					? { entityType: { contains: entityType, mode: "insensitive" } }
					: {}),
				...(module ? { module: { contains: module, mode: "insensitive" } } : {}),
				...(userId ? { userId: String(userId) } : {}),
				...(riskLevel ? { riskLevel } : {}),
				...(isSecurityLog !== undefined ? { isSecurityLog: isSecurityLog === "true" } : {}),
				...(isSystemAction !== undefined
					? { isSystemAction: isSystemAction === "true" }
					: {}),
				...(ipAddress ? { ipAddress: { contains: ipAddress, mode: "insensitive" } } : {}),
				...(Object.keys(dateFilter).length > 0 ? { timestamp: dateFilter } : {}),
			};

			// Handle sort parameter - strip leading '-' if present and adjust order
			let sortField = sort;
			let sortOrder = order as Prisma.SortOrder;
			if (sort && typeof sort === "string" && !sort.startsWith("{")) {
				if (sort.startsWith("-")) {
					sortField = sort.substring(1);
					sortOrder = order === "asc" ? "desc" : "asc";
				}
			}

			const findManyQuery: Prisma.AuditLogFindManyArgs = {
				where: whereClause,
				skip,
				take: Number(limit),
				orderBy: sortField
					? typeof sortField === "string" && !sortField.startsWith("{")
						? { [sortField as string]: sortOrder }
						: JSON.parse(sortField as string)
					: { timestamp: order as Prisma.SortOrder },
			};

			if (fields) {
				const fieldSelections = (fields as string).split(",").reduce(
					(acc: Record<string, any>, field: string) => {
						const parts = field.trim().split(".");
						if (parts.length > 1) {
							const [parent, ...children] = parts;
							acc[parent] = acc[parent] || { select: {} };

							let current = acc[parent].select;
							for (let i = 0; i < children.length - 1; i++) {
								current[children[i]] = current[children[i]] || { select: {} };
								current = current[children[i]].select;
							}
							current[children[children.length - 1]] = true;
						} else {
							acc[parts[0]] = true;
						}
						return acc;
					},
					{ id: true } as Record<string, any>,
				);

				findManyQuery.select = fieldSelections;
			} else {
				// Default include user information
				findManyQuery.include = {
					user: {
						select: {
							id: true,
							userName: true,
							role: true,
							type: true,
							person: {
								select: {
									firstName: true,
									lastName: true,
									email: true,
								},
							},
						},
					},
				};
			}

			const [auditLogs, total] = await Promise.all([
				prisma.auditLog.findMany(findManyQuery),
				prisma.auditLog.count({ where: whereClause }),
			]);

			auditLogger.info(`Retrieved ${auditLogs.length} audit logs`);

			res.status(200).json({
				auditLogs,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
				filters: {
					action,
					entityType,
					module,
					userId,
					riskLevel,
					isSecurityLog,
					isSystemAction,
					dateFrom,
					dateTo,
					ipAddress,
				},
			});
		} catch (error) {
			auditLogger.error(`Error getting audit logs: ${error}`);
			res.status(500).json({ error: config.ERROR.AUDIT_LOGS.INTERNAL_SERVER_ERROR });
		}
	};

	const getStatistics = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		// Only admin and super_admin can access audit log statistics
		if (req.role !== Role.admin && req.role !== Role.super_admin) {
			auditLogger.warn(
				`Unauthorized audit log statistics access attempt by user ${req.userId}`,
			);
			res.status(403).json({
				error: config.ERROR.AUDIT_LOGS.UNAUTHORIZED_ACCESS,
			});
			return;
		}

		const { dateFrom, dateTo, module } = req.query as Record<string, any>;

		try {
			// Build date filter
			const dateFilter: any = {};
			if (dateFrom) {
				dateFilter.gte = new Date(dateFrom);
			}
			if (dateTo) {
				dateFilter.lte = new Date(dateTo);
			}

			const baseFilter: Prisma.AuditLogWhereInput = {
				isDeleted: false,
				...(Object.keys(dateFilter).length > 0 ? { timestamp: dateFilter } : {}),
				...(module ? { module: { contains: module, mode: "insensitive" } } : {}),
			};

			// Calculate date ranges for today, this week, this month
			const now = new Date();
			const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			const startOfWeek = new Date(startOfToday);
			startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
			const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

			// Get various statistics
			const [
				totalLogs,
				actionStats,
				entityStats,
				moduleStats,
				riskLevelStats,
				userTypeStats,
				securityLogs,
				systemLogs,
				todayLogs,
				thisWeekLogs,
				thisMonthLogs,
				recentHighRiskActions,
			] = await Promise.all([
				// Total logs
				prisma.auditLog.count({ where: baseFilter }),

				// Action statistics
				prisma.auditLog.groupBy({
					by: ["action"],
					where: baseFilter,
					_count: { action: true },
					orderBy: { _count: { action: "desc" } },
				}),

				// Entity type statistics
				prisma.auditLog.groupBy({
					by: ["entityType"],
					where: baseFilter,
					_count: { entityType: true },
					orderBy: { _count: { entityType: "desc" } },
				}),

				// Module statistics
				prisma.auditLog.groupBy({
					by: ["module"],
					where: baseFilter,
					_count: { module: true },
					orderBy: { _count: { module: "desc" } },
				}),

				// Risk level statistics
				prisma.auditLog.groupBy({
					by: ["riskLevel"],
					where: baseFilter,
					_count: { riskLevel: true },
					orderBy: { _count: { riskLevel: "desc" } },
				}),

				// User type statistics
				prisma.auditLog.groupBy({
					by: ["userType"],
					where: baseFilter,
					_count: { userType: true },
					orderBy: { _count: { userType: "desc" } },
				}),

				// Security logs count
				prisma.auditLog.count({
					where: { ...baseFilter, isSecurityLog: true },
				}),

				// System logs count
				prisma.auditLog.count({
					where: { ...baseFilter, isSystemAction: true },
				}),

				// Today's logs
				prisma.auditLog.count({
					where: {
						...baseFilter,
						timestamp: {
							gte: startOfToday,
						},
					},
				}),

				// This week's logs
				prisma.auditLog.count({
					where: {
						...baseFilter,
						timestamp: {
							gte: startOfWeek,
						},
					},
				}),

				// This month's logs
				prisma.auditLog.count({
					where: {
						...baseFilter,
						timestamp: {
							gte: startOfMonth,
						},
					},
				}),

				// Recent high-risk actions (high or critical risk level)
				prisma.auditLog.findMany({
					where: {
						...baseFilter,
						riskLevel: {
							in: [LogSeverity.high, LogSeverity.critical],
						},
					},
					orderBy: {
						timestamp: "desc",
					},
					take: 10,
					include: {
						user: {
							select: {
								id: true,
								userName: true,
								role: true,
								type: true,
								person: {
									select: {
										firstName: true,
										lastName: true,
										email: true,
									},
								},
							},
						},
					},
				}),
			]);

			// Calculate user actions (total - system actions)
			const userActions = totalLogs - systemLogs;

			// Calculate percentages for breakdowns
			const calculatePercentage = (count: number, total: number) =>
				total > 0 ? Math.round((count / total) * 100 * 100) / 100 : 0;

			const statistics = {
				totalLogs,
				todayLogs,
				thisWeekLogs,
				thisMonthLogs,
				actionBreakdown: actionStats.map((stat) => ({
					action: stat.action,
					count: stat._count.action,
					percentage: calculatePercentage(stat._count.action, totalLogs),
				})),
				moduleBreakdown: moduleStats.map((stat) => ({
					module: stat.module,
					count: stat._count.module,
					percentage: calculatePercentage(stat._count.module, totalLogs),
				})),
				riskLevelBreakdown: riskLevelStats.map((stat) => ({
					riskLevel: stat.riskLevel,
					count: stat._count.riskLevel,
					percentage: calculatePercentage(stat._count.riskLevel, totalLogs),
				})),
				userTypeBreakdown: userTypeStats.map((stat) => ({
					userType: stat.userType,
					count: stat._count.userType,
					percentage: calculatePercentage(stat._count.userType, totalLogs),
				})),
				recentHighRiskActions: recentHighRiskActions.map((log) => ({
					id: log.id,
					action: log.action,
					entityType: log.entityType,
					entityId: log.entityId,
					tableName: log.tableName,
					recordId: log.recordId,
					userId: log.userId,
					userName: log.userName,
					userRole: log.userRole,
					userType: log.userType,
					ipAddress: log.ipAddress,
					userAgent: log.userAgent,
					sessionId: log.sessionId,
					description: log.description,
					module: log.module,
					beforeValues: log.beforeValues,
					afterValues: log.afterValues,
					changedFields: log.changedFields,
					metadata: log.metadata,
					riskLevel: log.riskLevel,
					isSystemAction: log.isSystemAction,
					isSecurityLog: log.isSecurityLog,
					timestamp: log.timestamp.toISOString(),
					isDeleted: log.isDeleted,
					retentionDate: log.retentionDate?.toISOString(),
					user: log.user,
				})),
				systemVsUserActions: {
					systemActions: systemLogs,
					userActions: userActions,
				},
				filters: {
					dateFrom,
					dateTo,
					module,
				},
			};

			auditLogger.info("Audit log statistics retrieved");
			res.status(200).json(statistics);
		} catch (error) {
			auditLogger.error(`Error getting audit log statistics: ${error}`);
			res.status(500).json({ error: config.ERROR.AUDIT_LOGS.INTERNAL_SERVER_ERROR });
		}
	};

	const exportLogs = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		// Only super_admin can export audit logs
		if (req.role !== Role.super_admin) {
			auditLogger.warn(`Unauthorized audit log export attempt by user ${req.userId}`);
			res.status(403).json({
				error: config.ERROR.AUDIT_LOGS.UNAUTHORIZED_ACCESS,
			});
			return;
		}

		const {
			format = "json",
			action,
			entityType,
			module,
			userId,
			riskLevel,
			dateFrom,
			dateTo,
			limit = 1000,
		} = req.query as Record<string, any>;

		if (!["json", "csv"].includes(format)) {
			auditLogger.error(`Invalid export format: ${format}`);
			res.status(400).json({ error: config.ERROR.AUDIT_LOGS.INVALID_EXPORT_FORMAT });
			return;
		}

		if (Number(limit) > 10000) {
			auditLogger.error(`Export limit too high: ${limit}`);
			res.status(400).json({ error: config.ERROR.AUDIT_LOGS.EXPORT_LIMIT_EXCEEDED });
			return;
		}

		try {
			// Build date filter
			const dateFilter: any = {};
			if (dateFrom) {
				dateFilter.gte = new Date(dateFrom);
			}
			if (dateTo) {
				dateFilter.lte = new Date(dateTo);
			}

			const whereClause: Prisma.AuditLogWhereInput = {
				isDeleted: false,
				...(action ? { action } : {}),
				...(entityType
					? { entityType: { contains: entityType, mode: "insensitive" } }
					: {}),
				...(module ? { module: { contains: module, mode: "insensitive" } } : {}),
				...(userId ? { userId: String(userId) } : {}),
				...(riskLevel ? { riskLevel } : {}),
				...(Object.keys(dateFilter).length > 0 ? { timestamp: dateFilter } : {}),
			};

			const auditLogs = await prisma.auditLog.findMany({
				where: whereClause,
				include: {
					user: {
						select: {
							userName: true,
							role: true,
							type: true,
							person: {
								select: {
									firstName: true,
									lastName: true,
									email: true,
								},
							},
						},
					},
				},
				orderBy: { timestamp: "desc" },
				take: Number(limit),
			});

			// Log the export action
			auditLogger.info(`Audit logs exported by user ${req.userId}`, {
				format,
				recordCount: auditLogs.length,
				filters: { action, entityType, module, userId, riskLevel, dateFrom, dateTo },
			});

			if (format === "csv") {
				// Convert to CSV
				const csvHeaders = [
					"Timestamp",
					"Action",
					"Entity Type",
					"Entity ID",
					"User",
					"Description",
					"Module",
					"Risk Level",
					"IP Address",
					"Is Security Log",
					"Is System Action",
				];

				const csvRows = auditLogs.map((log) => [
					log.timestamp.toISOString(),
					log.action,
					log.entityType,
					log.entityId || "",
					log.user?.userName || log.userName || "System",
					log.description,
					log.module,
					log.riskLevel,
					log.ipAddress || "",
					log.isSecurityLog ? "Yes" : "No",
					log.isSystemAction ? "Yes" : "No",
				]);

				const csvContent = [
					csvHeaders.join(","),
					...csvRows.map((row) =>
						row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
					),
				].join("\n");

				res.setHeader("Content-Type", "text/csv");
				res.setHeader(
					"Content-Disposition",
					`attachment; filename="audit_logs_${Date.now()}.csv"`,
				);
				res.status(200).send(csvContent);
			} else {
				// Return JSON
				res.setHeader("Content-Type", "application/json");
				res.setHeader(
					"Content-Disposition",
					`attachment; filename="audit_logs_${Date.now()}.json"`,
				);
				res.status(200).json({
					exportInfo: {
						timestamp: new Date().toISOString(),
						recordCount: auditLogs.length,
						filters: {
							action,
							entityType,
							module,
							userId,
							riskLevel,
							dateFrom,
							dateTo,
						},
						exportedBy: req.userId,
					},
					auditLogs,
				});
			}
		} catch (error) {
			auditLogger.error(`Error exporting audit logs: ${error}`);
			res.status(500).json({ error: config.ERROR.AUDIT_LOGS.INTERNAL_SERVER_ERROR });
		}
	};

	const deleteOldLogs = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		// Only super_admin can delete audit logs
		if (req.role !== Role.super_admin) {
			auditLogger.warn(`Unauthorized audit log deletion attempt by user ${req.userId}`);
			res.status(403).json({
				error: config.ERROR.AUDIT_LOGS.CLEANUP_PERMISSION_DENIED,
			});
			return;
		}

		const { olderThanDays, dryRun = "true" } = req.query as Record<string, any>;

		if (!olderThanDays || isNaN(Number(olderThanDays)) || Number(olderThanDays) < 90) {
			auditLogger.error(`Invalid olderThanDays parameter: ${olderThanDays}`);
			res.status(400).json({
				error: config.ERROR.AUDIT_LOGS.INVALID_RETENTION_PERIOD,
			});
			return;
		}

		try {
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - Number(olderThanDays));

			const whereClause = {
				timestamp: { lt: cutoffDate },
				isDeleted: false,
			};

			if (dryRun === "true") {
				// Just count what would be deleted
				const count = await prisma.auditLog.count({ where: whereClause });

				auditLogger.info(
					`Dry run: ${count} audit logs would be deleted (older than ${olderThanDays} days)`,
				);

				res.status(200).json({
					message: "Dry run completed",
					recordsToDelete: count,
					cutoffDate,
					dryRun: true,
				});
			} else {
				// Actually perform soft delete
				const result = await prisma.auditLog.updateMany({
					where: whereClause,
					data: { isDeleted: true },
				});

				auditLogger.info(
					`Soft deleted ${result.count} audit logs older than ${olderThanDays} days`,
				);

				res.status(200).json({
					message: `Successfully soft deleted ${result.count} audit logs`,
					recordsDeleted: result.count,
					cutoffDate,
					dryRun: false,
				});
			}
		} catch (error) {
			auditLogger.error(`Error deleting old audit logs: ${error}`);
			res.status(500).json({ error: config.ERROR.AUDIT_LOGS.INTERNAL_SERVER_ERROR });
		}
	};

	return {
		getById,
		getAll,
		getStatistics,
		exportLogs,
		deleteOldLogs,
	};
};
