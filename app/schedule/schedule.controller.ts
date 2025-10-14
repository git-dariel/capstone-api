import { NextFunction, Response } from "express";
import { Prisma, PrismaClient } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { AuthRequest } from "../../middleware/verifyToken";
import { requireAnyRole } from "../../middleware/rbac";
import { getPhilippinesStartOfDay } from "../../helper/date.helper";
import { createNotificationHelper } from "../../helper/notification.helper";

const logger = getLogger();
const scheduleLogger = logger.child({ module: "schedule" });

export const controller = (prisma: PrismaClient) => {
	const notificationHelper = createNotificationHelper(prisma);
	const getById = requireAnyRole(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		if (!id) {
			scheduleLogger.error("Missing schedule ID");
			res.status(400).json({ error: "Schedule ID is required" });
			return;
		}

		if (fields && typeof fields !== "string") {
			scheduleLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: "Fields parameter must be a comma-separated string" });
			return;
		}

		scheduleLogger.info(`Getting schedule by id: ${id}`);

		try {
			const query: Prisma.ScheduleFindFirstArgs = {
				where: {
					id,
					isDeleted: false,
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

			const schedule = await prisma.schedule.findFirst(query);

			if (!schedule) {
				scheduleLogger.error(`Schedule not found: ${id}`);
				res.status(404).json({ error: "Schedule not found" });
				return;
			}

			scheduleLogger.info(`Schedule retrieved: ${schedule.id}`);
			res.status(200).json(schedule);
		} catch (error) {
			scheduleLogger.error(`Error getting schedule: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	});

	const getAll = requireAnyRole(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const {
			page = 1,
			limit = 10,
			sort,
			fields,
			query,
			order = "desc",
			counselorId,
			status,
			from,
			to,
		} = req.query;

		if (isNaN(Number(page)) || Number(page) < 1) {
			scheduleLogger.error(`Invalid page: ${page}`);
			res.status(400).json({ error: "Invalid page number" });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			scheduleLogger.error(`Invalid limit: ${limit}`);
			res.status(400).json({ error: "Invalid limit" });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			scheduleLogger.error(`Invalid order: ${order}`);
			res.status(400).json({ error: "Order must be 'asc' or 'desc'" });
			return;
		}

		if (fields && typeof fields !== "string") {
			scheduleLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: "Fields parameter must be a comma-separated string" });
			return;
		}

		if (sort && typeof sort !== "string") {
			scheduleLogger.error(`Invalid sort: ${sort}`);
			res.status(400).json({ error: "Sort parameter must be a valid field name" });
			return;
		}

		scheduleLogger.info("Getting all schedules");

		try {
			const skip = (Number(page) - 1) * Number(limit);
			const take = Number(limit);

			const whereClause: Prisma.ScheduleWhereInput = {
				isDeleted: false,
			};

			// Add counselorId filter if provided
			if (counselorId && typeof counselorId === "string") {
				whereClause.counselorId = counselorId;
			}

			// Add status filter if provided
			if (status && typeof status === "string") {
				whereClause.status = status as any;
			}

			// Add date range filters
			if (from || to) {
				whereClause.AND = [];
				if (from && typeof from === "string") {
					whereClause.AND.push({ startTime: { gte: new Date(from) } });
				}
				if (to && typeof to === "string") {
					whereClause.AND.push({ endTime: { lte: new Date(to) } });
				}
			}

			// Add search query
			if (query && typeof query === "string") {
				whereClause.OR = [
					{ title: { contains: query, mode: "insensitive" } },
					{ description: { contains: query, mode: "insensitive" } },
					{ location: { contains: query, mode: "insensitive" } },
					{ notes: { contains: query, mode: "insensitive" } },
					{
						counselor: {
							person: {
								OR: [
									{ firstName: { contains: query, mode: "insensitive" } },
									{ lastName: { contains: query, mode: "insensitive" } },
									{ email: { contains: query, mode: "insensitive" } },
								],
							},
						},
					},
				];
			}

			let orderBy: Prisma.ScheduleOrderByWithRelationInput = {
				startTime: order as "asc" | "desc",
			};

			if (sort) {
				try {
					if (sort.startsWith("{")) {
						orderBy = JSON.parse(sort);
					} else {
						orderBy = { [sort]: order };
					}
				} catch (error) {
					scheduleLogger.error(`Invalid sort JSON: ${sort}`);
					res.status(400).json({ error: "Invalid sort parameter" });
					return;
				}
			}

			const findManyArgs: Prisma.ScheduleFindManyArgs = {
				where: whereClause,
				skip,
				take,
				orderBy,
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

				findManyArgs.select = fieldSelections;
			}

			const [schedules, total] = await Promise.all([
				prisma.schedule.findMany(findManyArgs),
				prisma.schedule.count({ where: whereClause }),
			]);

			const totalPages = Math.ceil(total / take);

			scheduleLogger.info(`Retrieved ${schedules.length} schedules out of ${total} total`);

			res.status(200).json({
				schedules,
				total,
				page: Number(page),
				totalPages,
			});
		} catch (error) {
			scheduleLogger.error(`Error getting schedules: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	});

	const create = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const {
			title,
			description,
			startTime,
			endTime,
			isRecurring = false,
			recurringType = "none",
			maxSlots = 1,
			location,
			notes,
		} = req.body;

		const counselorId = req.userId;

		if (!counselorId) {
			scheduleLogger.error("Authentication required");
			res.status(401).json({ error: "Authentication required" });
			return;
		}

		if (!startTime || !endTime) {
			scheduleLogger.error("Start time and end time are required");
			res.status(400).json({ error: "Start time and end time are required" });
			return;
		}

		// Validate that user is a counselor
		try {
			const user = await prisma.user.findUnique({
				where: { id: counselorId },
			});

			if (!user || user.type !== "guidance") {
				scheduleLogger.error("Only guidance counselors can create schedules");
				res.status(403).json({ error: "Only guidance counselors can create schedules" });
				return;
			}

			const startDateTime = new Date(startTime);
			const endDateTime = new Date(endTime);

			// Validate time range
			if (endDateTime <= startDateTime) {
				scheduleLogger.error("End time must be after start time");
				res.status(400).json({ error: "End time must be after start time" });
				return;
			}

			// Check for overlapping schedules
			const overlapping = await prisma.schedule.findFirst({
				where: {
					counselorId,
					isDeleted: false,
					OR: [
						{
							AND: [
								{ startTime: { lte: startDateTime } },
								{ endTime: { gt: startDateTime } },
							],
						},
						{
							AND: [
								{ startTime: { lt: endDateTime } },
								{ endTime: { gte: endDateTime } },
							],
						},
						{
							AND: [
								{ startTime: { gte: startDateTime } },
								{ endTime: { lte: endDateTime } },
							],
						},
					],
				},
			});

			if (overlapping) {
				scheduleLogger.error("Schedule overlaps with existing schedule");
				res.status(400).json({ error: "Schedule overlaps with existing schedule" });
				return;
			}

			const schedule = await prisma.schedule.create({
				data: {
					title,
					description,
					startTime: startDateTime,
					endTime: endDateTime,
					isRecurring,
					recurringType,
					maxSlots,
					location,
					notes,
					counselorId,
				},
				include: {
					counselor: {
						select: {
							id: true,
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
			});

			scheduleLogger.info(`Schedule created: ${schedule.id}`);

			// Create notification for schedule creation
			try {
				await notificationHelper.createScheduleNotification(
					"CREATED",
					schedule.counselorId,
					schedule.id,
					{
						startTime: schedule.startTime,
						endTime: schedule.endTime,
						location: schedule.location,
						status: schedule.status,
						maxSlots: schedule.maxSlots,
					},
				);
			} catch (notificationError) {
				scheduleLogger.warn(`Failed to create schedule notification: ${notificationError}`);
			}

			res.status(201).json({
				message: "Schedule created successfully",
				...schedule,
			});
		} catch (error) {
			scheduleLogger.error(`Error creating schedule: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	const update = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const counselorId = req.userId;

		if (!id) {
			scheduleLogger.error("Missing schedule ID");
			res.status(400).json({ error: "Schedule ID is required" });
			return;
		}

		if (!counselorId) {
			scheduleLogger.error("Authentication required");
			res.status(401).json({ error: "Authentication required" });
			return;
		}

		const updateFields = { ...req.body };
		delete updateFields.id;
		delete updateFields.counselorId;
		delete updateFields.createdAt;
		delete updateFields.updatedAt;

		if (Object.keys(updateFields).length === 0) {
			scheduleLogger.error("No update fields provided");
			res.status(400).json({ error: "At least one field is required for update" });
			return;
		}

		try {
			// Check if schedule exists and belongs to counselor
			const existingSchedule = await prisma.schedule.findFirst({
				where: {
					id,
					counselorId,
					isDeleted: false,
				},
			});

			if (!existingSchedule) {
				scheduleLogger.error(`Schedule not found: ${id}`);
				res.status(404).json({ error: "Schedule not found" });
				return;
			}

			// Convert datetime strings to Date objects
			if (updateFields.startTime) {
				updateFields.startTime = new Date(updateFields.startTime);
			}
			if (updateFields.endTime) {
				updateFields.endTime = new Date(updateFields.endTime);
			}

			// Validate time range if updating times
			if (updateFields.startTime || updateFields.endTime) {
				const startTime = updateFields.startTime || existingSchedule.startTime;
				const endTime = updateFields.endTime || existingSchedule.endTime;

				if (endTime <= startTime) {
					scheduleLogger.error("End time must be after start time");
					res.status(400).json({ error: "End time must be after start time" });
					return;
				}
			}

			const updatedSchedule = await prisma.schedule.update({
				where: { id },
				data: updateFields,
				include: {
					counselor: {
						select: {
							id: true,
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
			});

			scheduleLogger.info(`Schedule updated: ${updatedSchedule.id}`);

			// Create notification for schedule update
			try {
				let notificationAction: "UPDATED" | "CANCELLED" | "AVAILABLE" | "BOOKED" =
					"UPDATED";
				if (status) {
					switch (status) {
						case "cancelled":
							notificationAction = "CANCELLED";
							break;
						case "available":
							notificationAction = "AVAILABLE";
							break;
						case "booked":
							notificationAction = "BOOKED";
							break;
						default:
							notificationAction = "UPDATED";
					}
				}

				await notificationHelper.createScheduleNotification(
					notificationAction,
					updatedSchedule.counselorId,
					updatedSchedule.id,
					{
						startTime: updatedSchedule.startTime,
						endTime: updatedSchedule.endTime,
						location: updatedSchedule.location,
						status: updatedSchedule.status,
						maxSlots: updatedSchedule.maxSlots,
						bookedSlots: updatedSchedule.bookedSlots,
					},
				);
			} catch (notificationError) {
				scheduleLogger.warn(
					`Failed to create schedule update notification: ${notificationError}`,
				);
			}

			res.status(200).json(updatedSchedule);
		} catch (error) {
			scheduleLogger.error(`Error updating schedule: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	const remove = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const counselorId = req.userId;

		if (!id) {
			scheduleLogger.error("Missing schedule ID");
			res.status(400).json({ error: "Schedule ID is required" });
			return;
		}

		if (!counselorId) {
			scheduleLogger.error("Authentication required");
			res.status(401).json({ error: "Authentication required" });
			return;
		}

		try {
			// Check if schedule exists and belongs to counselor
			const existingSchedule = await prisma.schedule.findFirst({
				where: {
					id,
					counselorId,
					isDeleted: false,
				},
				include: {
					appointments: {
						where: {
							isDeleted: false,
							status: { in: ["pending", "confirmed"] },
						},
					},
				},
			});

			if (!existingSchedule) {
				scheduleLogger.error(`Schedule not found: ${id}`);
				res.status(404).json({ error: "Schedule not found" });
				return;
			}

			// Check if there are active appointments
			if (existingSchedule.appointments.length > 0) {
				scheduleLogger.error("Cannot delete schedule with active appointments");
				res.status(400).json({
					error: "Cannot delete schedule with active appointments. Cancel appointments first.",
				});
				return;
			}

			await prisma.schedule.update({
				where: { id },
				data: {
					isDeleted: true,
					status: "cancelled",
				},
			});

			scheduleLogger.info(`Schedule deleted: ${id}`);
			res.status(200).json({ message: "Schedule deleted successfully" });
		} catch (error) {
			scheduleLogger.error(`Error deleting schedule: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	const getAvailable = requireAnyRole(
		async (req: AuthRequest, res: Response, _next: NextFunction) => {
			const { counselorId, from, to } = req.query;

			try {
				// Use Philippines timezone for date comparison
				const philippinesToday = getPhilippinesStartOfDay();

				const whereClause: Prisma.ScheduleWhereInput = {
					status: "available",
					isDeleted: false,
					startTime: { gte: philippinesToday }, // Only schedules from today onwards (Philippines time)
				};

				if (counselorId && typeof counselorId === "string") {
					whereClause.counselorId = counselorId;
				}

				if (from || to) {
					whereClause.AND = [];
					if (from && typeof from === "string") {
						whereClause.AND.push({ startTime: { gte: new Date(from) } });
					}
					if (to && typeof to === "string") {
						whereClause.AND.push({ endTime: { lte: new Date(to) } });
					}
				}

				const schedules = await prisma.schedule.findMany({
					where: whereClause,
					include: {
						counselor: {
							select: {
								id: true,
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
					orderBy: { startTime: "asc" },
				});

				// Filter out fully booked schedules (bookedSlots >= maxSlots)
				const available = schedules.filter(
					(s: any) => (s.bookedSlots ?? 0) < (s.maxSlots ?? 0),
				);

				scheduleLogger.info(`Retrieved ${available.length} available schedules`);
				// Return an array to match frontend expectations
				res.status(200).json(available);
			} catch (error) {
				scheduleLogger.error(`Error getting available schedules: ${error}`);
				res.status(500).json({ error: "Internal server error" });
			}
		},
	);

	return {
		getById,
		getAll,
		create,
		update,
		remove,
		getAvailable,
	};
};
