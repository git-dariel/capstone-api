import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma, LogType, LogStatus, LogSeverity } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/error.config";
import { AuthRequest } from "../../middleware/verifyToken";
import { requireAnyRole, requireAdmin } from "../../middleware/rbac";

const logger = getLogger();
const loggingsLogger = logger.child({ module: "loggings" });

export const controller = (prisma: PrismaClient) => {
	const getById = requireAnyRole(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		if (!id) {
			loggingsLogger.error(config.ERROR.LOGS.MISSING_ID);
			res.status(400).json({ error: config.ERROR.LOGS.MISSING_ID });
			return;
		}

		if (fields && typeof fields !== "string") {
			loggingsLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.LOGS.POPULATE_MUST_BE_STRING });
			return;
		}

		loggingsLogger.info(`${config.SUCCESS.LOGS.GETTING_BY_ID}: ${id}`);

		try {
			const query: Prisma.LogFindFirstArgs = {
				where: {
					id,
				},
			};

			if (fields) {
				const fieldSelections = fields.split(",").reduce(
					(acc, field) => {
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
			}

			const log = await prisma.log.findFirst(query);

			if (!log) {
				loggingsLogger.error(`${config.ERROR.LOGS.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.LOGS.NOT_FOUND });
				return;
			}

			loggingsLogger.info(`${config.SUCCESS.LOGS.RETRIEVED}: ${log.id}`);
			res.status(200).json(log);
		} catch (error) {
			loggingsLogger.error(`${config.ERROR.LOGS.ERROR_GETTING_LOG}: ${error}`);
			res.status(500).json({ error: config.ERROR.LOGS.INTERNAL_SERVER_ERROR });
		}
	});

	const getAll = requireAdmin(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { page = 1, limit = 10, sort, fields, query, order = "desc" } = req.query;

		if (isNaN(Number(page)) || Number(page) < 1) {
			loggingsLogger.error(`${config.ERROR.LOGS.INVALID_PAGE}: ${page}`);
			res.status(400).json({ error: config.ERROR.LOGS.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			loggingsLogger.error(`${config.ERROR.LOGS.INVALID_LIMIT}: ${limit}`);
			res.status(400).json({ error: config.ERROR.LOGS.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			loggingsLogger.error(`${config.ERROR.LOGS.INVALID_ORDER}: ${order}`);
			res.status(400).json({ error: config.ERROR.LOGS.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			loggingsLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.LOGS.POPULATE_MUST_BE_STRING });
			return;
		}

		if (sort) {
			if (typeof sort === "string" && sort.startsWith("{")) {
				try {
					JSON.parse(sort);
				} catch (error) {
					loggingsLogger.error(`${config.ERROR.LOGS.INVALID_SORT}: ${sort}`);
					res.status(400).json({
						error: config.ERROR.LOGS.SORT_MUST_BE_STRING,
					});
					return;
				}
			}
		}

		const skip = (Number(page) - 1) * Number(limit);

		loggingsLogger.info(
			`${config.SUCCESS.LOGS.GETTING_ALL}, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
		);

		try {
			const whereClause: Prisma.LogWhereInput = {
				...(query
					? {
							OR: [
								{ title: { contains: String(query) } },
								{ message: { contains: String(query) } },
								{ action: { contains: String(query) } },
								{ entityType: { contains: String(query) } },
							],
						}
					: {}),
			};

			const findManyQuery: Prisma.LogFindManyArgs = {
				where: whereClause,
				skip,
				take: Number(limit),
				orderBy: sort
					? typeof sort === "string" && !sort.startsWith("{")
						? { [sort as string]: order }
						: JSON.parse(sort as string)
					: { createdAt: order as Prisma.SortOrder },
			};

			if (fields) {
				const fieldSelections = fields.split(",").reduce(
					(acc, field) => {
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
			}

			const [logs, total] = await Promise.all([
				prisma.log.findMany(findManyQuery),
				prisma.log.count({ where: whereClause }),
			]);

			loggingsLogger.info(`Retrieved ${logs.length} logs`);
			res.status(200).json({
				logs,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			loggingsLogger.error(`${config.ERROR.LOGS.ERROR_GETTING_LOG}: ${error}`);
			res.status(500).json({ error: config.ERROR.LOGS.INTERNAL_SERVER_ERROR });
		}
	});

	const create = requireAdmin(async (req: Request, res: Response, _next: NextFunction) => {
		const {
			type,
			action,
			title,
			message,
			userId,
			entityType,
			entityId,
			data,
			status,
			severity,
		} = req.body;

		if (!type || !userId) {
			loggingsLogger.error("Invalid log data");
			res.status(400).json({
				error: config.ERROR.LOGS.INVALID_DATA,
			});
			return;
		}

		if (!Object.values(LogType).includes(type)) {
			loggingsLogger.error(`${config.ERROR.LOGS.INVALID_TYPE}: ${type}`);
			res.status(400).json({ error: config.ERROR.LOGS.INVALID_TYPE });
			return;
		}

		if (!action || typeof action !== "string" || action.trim().length === 0) {
			loggingsLogger.error(`${config.ERROR.LOGS.INVALID_ACTION}: ${action}`);
			res.status(400).json({ error: config.ERROR.LOGS.INVALID_ACTION });
			return;
		}

		if (!title || typeof title !== "string" || title.trim().length === 0) {
			loggingsLogger.error(`${config.ERROR.LOGS.INVALID_TITLE}: ${title}`);
			res.status(400).json({ error: config.ERROR.LOGS.INVALID_TITLE });
			return;
		}

		if (status && !Object.values(LogStatus).includes(status)) {
			loggingsLogger.error(`${config.ERROR.LOGS.INVALID_STATUS}: ${status}`);
			res.status(400).json({ error: config.ERROR.LOGS.INVALID_STATUS });
			return;
		}

		if (severity && !Object.values(LogSeverity).includes(severity)) {
			loggingsLogger.error(`${config.ERROR.LOGS.INVALID_SEVERITY}: ${severity}`);
			res.status(400).json({ error: config.ERROR.LOGS.INVALID_SEVERITY });
			return;
		}

		try {
			// Verify user exists
			const user = await prisma.user.findFirst({ where: { id: userId, isDeleted: false } });
			if (!user) {
				loggingsLogger.error(`${config.ERROR.LOGS.USER_NOT_FOUND}: ${userId}`);
				res.status(400).json({ error: config.ERROR.LOGS.USER_NOT_FOUND });
				return;
			}

			const newLog = await prisma.log.create({
				data: {
					type,
					action,
					title,
					message,
					userId,
					entityType,
					entityId,
					data,
					status: status || LogStatus.pending,
					severity: severity || LogSeverity.info,
				},
				include: {
					user: {
						select: {
							id: true,
							userName: true,
							person: {
								select: {
									firstName: true,
									lastName: true,
								},
							},
						},
					},
				},
			});

			loggingsLogger.info(`${config.SUCCESS.LOGS.CREATED}: ${newLog.id}`);
			res.status(201).json(newLog);
		} catch (error) {
			loggingsLogger.error(`${config.ERROR.LOGS.ERROR_GETTING_LOG}: ${error}`);
			res.status(500).json({ error: config.ERROR.LOGS.INTERNAL_SERVER_ERROR });
		}
	});

	const update = requireAdmin(async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const updateData = req.body;

		if (!id) {
			loggingsLogger.error(config.ERROR.LOGS.MISSING_ID);
			res.status(400).json({ error: config.ERROR.LOGS.MISSING_ID });
			return;
		}

		if (!updateData || Object.keys(updateData).length === 0) {
			loggingsLogger.error(config.ERROR.LOGS.NO_UPDATE_FIELDS);
			res.status(400).json({ error: config.ERROR.LOGS.NO_UPDATE_FIELDS });
			return;
		}

		// Validate enum fields if they are being updated
		if (updateData.type && !Object.values(LogType).includes(updateData.type)) {
			loggingsLogger.error(`${config.ERROR.LOGS.INVALID_TYPE}: ${updateData.type}`);
			res.status(400).json({ error: config.ERROR.LOGS.INVALID_TYPE });
			return;
		}

		if (updateData.status && !Object.values(LogStatus).includes(updateData.status)) {
			loggingsLogger.error(`${config.ERROR.LOGS.INVALID_STATUS}: ${updateData.status}`);
			res.status(400).json({ error: config.ERROR.LOGS.INVALID_STATUS });
			return;
		}

		if (updateData.severity && !Object.values(LogSeverity).includes(updateData.severity)) {
			loggingsLogger.error(`${config.ERROR.LOGS.INVALID_SEVERITY}: ${updateData.severity}`);
			res.status(400).json({ error: config.ERROR.LOGS.INVALID_SEVERITY });
			return;
		}

		try {
			const existingLog = await prisma.log.findFirst({ where: { id } });
			if (!existingLog) {
				loggingsLogger.error(`${config.ERROR.LOGS.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.LOGS.NOT_FOUND });
				return;
			}

			// If userId is being updated, verify the new user exists
			if (updateData.userId) {
				const user = await prisma.user.findFirst({
					where: { id: updateData.userId, isDeleted: false },
				});
				if (!user) {
					loggingsLogger.error(
						`${config.ERROR.LOGS.USER_NOT_FOUND}: ${updateData.userId}`,
					);
					res.status(400).json({ error: config.ERROR.LOGS.USER_NOT_FOUND });
					return;
				}
			}

			const updatedLog = await prisma.log.update({
				where: { id },
				data: updateData,
				include: {
					user: {
						select: {
							id: true,
							userName: true,
							person: {
								select: {
									firstName: true,
									lastName: true,
								},
							},
						},
					},
				},
			});

			loggingsLogger.info(`${config.SUCCESS.LOGS.UPDATE}: ${updatedLog.id}`);
			res.status(200).json(updatedLog);
		} catch (error) {
			loggingsLogger.error(`${config.ERROR.LOGS.ERROR_UPDATING_LOG}: ${error}`);
			res.status(500).json({ error: config.ERROR.LOGS.INTERNAL_SERVER_ERROR });
		}
	});

	const markAsRead = requireAnyRole(
		async (req: AuthRequest, res: Response, _next: NextFunction) => {
			const { id } = req.params;

			if (!id) {
				loggingsLogger.error(config.ERROR.LOGS.MISSING_ID);
				res.status(400).json({ error: config.ERROR.LOGS.MISSING_ID });
				return;
			}

			try {
				const existingLog = await prisma.log.findFirst({ where: { id } });
				if (!existingLog) {
					loggingsLogger.error(`${config.ERROR.LOGS.NOT_FOUND}: ${id}`);
					res.status(404).json({ error: config.ERROR.LOGS.NOT_FOUND });
					return;
				}

				const updatedLog = await prisma.log.update({
					where: { id },
					data: {
						status: LogStatus.read,
						readAt: new Date(),
					},
					include: {
						user: {
							select: {
								id: true,
								userName: true,
								person: {
									select: {
										firstName: true,
										lastName: true,
									},
								},
							},
						},
					},
				});

				loggingsLogger.info(`${config.SUCCESS.LOGS.MARKED_AS_READ}: ${updatedLog.id}`);
				res.status(200).json(updatedLog);
			} catch (error) {
				loggingsLogger.error(`${config.ERROR.LOGS.ERROR_UPDATING_LOG}: ${error}`);
				res.status(500).json({ error: config.ERROR.LOGS.INTERNAL_SERVER_ERROR });
			}
		},
	);

	const remove = requireAdmin(async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			loggingsLogger.error(config.ERROR.LOGS.MISSING_ID);
			res.status(400).json({ error: config.ERROR.LOGS.MISSING_ID });
			return;
		}

		try {
			const existingLog = await prisma.log.findFirst({ where: { id } });
			if (!existingLog) {
				loggingsLogger.error(`${config.ERROR.LOGS.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.LOGS.NOT_FOUND });
				return;
			}

			await prisma.log.delete({ where: { id } });

			loggingsLogger.info(`${config.SUCCESS.LOGS.DELETED}: ${id}`);
			res.status(200).json({ message: config.SUCCESS.LOGS.DELETED });
		} catch (error) {
			loggingsLogger.error(`${config.ERROR.LOGS.ERROR_DELETING_LOG}: ${error}`);
			res.status(500).json({ error: config.ERROR.LOGS.INTERNAL_SERVER_ERROR });
		}
	});

	return {
		getById,
		getAll,
		create,
		update,
		markAsRead,
		remove,
	};
};
