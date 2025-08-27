import { NextFunction, Request, Response } from "express";
import { Prisma, PrismaClient } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";

const logger = getLogger();
const appointmentLogger = logger.child({ module: "appointment" });

export const controller = (prisma: PrismaClient) => {
	// Get appointment by ID
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		if (!id) {
			appointmentLogger.error("Missing appointment ID");
			res.status(400).json({ error: "Appointment ID is required" });
			return;
		}

		appointmentLogger.info(`Getting appointment by ID: ${id}`);

		try {
			const query: Prisma.AppointmentFindFirstArgs = {
				where: {
					id,
					isDeleted: false,
				},
				include: {
					student: {
						include: {
							person: true,
						},
					},
					counselor: {
						include: {
							person: true,
						},
					},
					schedule: true,
				},
			};

			if (fields && typeof fields === "string") {
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

			const appointment = await prisma.appointment.findFirst(query);

			if (!appointment) {
				appointmentLogger.error(`Appointment not found: ${id}`);
				res.status(404).json({ error: "Appointment not found" });
				return;
			}

			appointmentLogger.info(`Retrieved appointment: ${appointment.id}`);
			res.status(200).json(appointment);
		} catch (error) {
			appointmentLogger.error(`Error getting appointment: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	// Get all appointments with filtering and pagination
	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		const {
			page = 1,
			limit = 10,
			sort,
			fields,
			query,
			order = "desc",
			status,
			studentId,
			counselorId,
			dateFrom,
			dateTo,
			type,
		} = req.query;

		if (isNaN(Number(page)) || Number(page) < 1) {
			appointmentLogger.error(`Invalid page: ${page}`);
			res.status(400).json({ error: "Invalid page number" });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			appointmentLogger.error(`Invalid limit: ${limit}`);
			res.status(400).json({ error: "Invalid limit" });
			return;
		}

		const skip = (Number(page) - 1) * Number(limit);

		appointmentLogger.info(
			`Getting all appointments, page: ${page}, limit: ${limit}, query: ${query}`,
		);

		try {
			const whereClause: Prisma.AppointmentWhereInput = {
				isDeleted: false,
				...(status && { status: status as any }),
				...(studentId && { studentId: String(studentId) }),
				...(counselorId && { counselorId: String(counselorId) }),
				...(type && { appointmentType: type as any }),
				...(dateFrom || dateTo
					? {
							requestedDate: {
								...(dateFrom && { gte: new Date(String(dateFrom)) }),
								...(dateTo && { lte: new Date(String(dateTo)) }),
							},
						}
					: {}),
				...(query
					? {
							OR: [
								{ title: { contains: String(query), mode: "insensitive" } },
								{ description: { contains: String(query), mode: "insensitive" } },
								{
									student: {
										person: {
											firstName: {
												contains: String(query),
												mode: "insensitive",
											},
										},
									},
								},
								{
									student: {
										person: {
											lastName: {
												contains: String(query),
												mode: "insensitive",
											},
										},
									},
								},
								{
									counselor: {
										person: {
											firstName: {
												contains: String(query),
												mode: "insensitive",
											},
										},
									},
								},
								{
									counselor: {
										person: {
											lastName: {
												contains: String(query),
												mode: "insensitive",
											},
										},
									},
								},
							],
						}
					: {}),
			};

			const findManyQuery: Prisma.AppointmentFindManyArgs = {
				where: whereClause,
				skip,
				take: Number(limit),
				orderBy: sort
					? typeof sort === "string" && !sort.startsWith("{")
						? { [sort as string]: order }
						: JSON.parse(sort as string)
					: { createdAt: order as Prisma.SortOrder },
				include: {
					student: {
						include: {
							person: true,
						},
					},
					counselor: {
						include: {
							person: true,
						},
					},
					schedule: true,
				},
			};

			if (fields && typeof fields === "string") {
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

			const [appointments, total] = await Promise.all([
				prisma.appointment.findMany(findManyQuery),
				prisma.appointment.count({ where: whereClause }),
			]);

			appointmentLogger.info(`Retrieved ${appointments.length} appointments`);
			res.status(200).json({
				appointments,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			appointmentLogger.error(`Error getting appointments: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	// Create a new appointment request
	const create = async (req: Request, res: Response, _next: NextFunction) => {
		const {
			studentId,
			counselorId,
			scheduleId,
			title,
			description,
			appointmentType,
			requestedDate,
			priority,
			location,
			duration,
			attachments,
		} = req.body;

		if (!studentId || !counselorId || !scheduleId || !requestedDate) {
			appointmentLogger.error("Missing required fields");
			res.status(400).json({
				error: "Student ID, Counselor ID, Schedule ID, and Requested Date are required",
			});
			return;
		}

		appointmentLogger.info(`Creating appointment for student: ${studentId}`);

		try {
			// Verify student exists and is of type 'student'
			const student = await prisma.user.findFirst({
				where: {
					id: studentId,
					type: "student",
					isDeleted: false,
				},
			});

			if (!student) {
				appointmentLogger.error(`Student not found: ${studentId}`);
				res.status(404).json({ error: "Student not found" });
				return;
			}

			// Verify counselor exists and is of type 'guidance'
			const counselor = await prisma.user.findFirst({
				where: {
					id: counselorId,
					type: "guidance",
					isDeleted: false,
				},
			});

			if (!counselor) {
				appointmentLogger.error(`Counselor not found: ${counselorId}`);
				res.status(404).json({ error: "Counselor not found" });
				return;
			}

			// Verify schedule exists and is available
			const schedule = await prisma.schedule.findFirst({
				where: {
					id: scheduleId,
					counselorId,
					status: "available",
					isDeleted: false,
				},
			});

			if (!schedule) {
				appointmentLogger.error(`Schedule not available: ${scheduleId}`);
				res.status(404).json({ error: "Schedule not found or not available" });
				return;
			}

			// Check if schedule has available slots
			if (schedule.bookedSlots >= schedule.maxSlots) {
				appointmentLogger.error(`Schedule is fully booked: ${scheduleId}`);
				res.status(400).json({ error: "Schedule is fully booked" });
				return;
			}

			// Check if requested date is within schedule time range
			const requestDate = new Date(requestedDate);
			if (requestDate < schedule.startTime || requestDate > schedule.endTime) {
				appointmentLogger.error(`Requested date outside schedule range`);
				res.status(400).json({
					error: "Requested date must be within the schedule time range",
				});
				return;
			}

			const result = await prisma.$transaction(async (tx) => {
				// Create the appointment
				const appointment = await tx.appointment.create({
					data: {
						studentId,
						counselorId,
						scheduleId,
						title,
						description,
						appointmentType: appointmentType || "consultation",
						requestedDate: new Date(requestedDate),
						priority: priority || "normal",
						location: location || schedule.location,
						duration: duration || 60,
						attachments: attachments || [],
					},
					include: {
						student: {
							include: {
								person: true,
							},
						},
						counselor: {
							include: {
								person: true,
							},
						},
						schedule: true,
					},
				});

				// Update schedule booked slots
				await tx.schedule.update({
					where: { id: scheduleId },
					data: {
						bookedSlots: {
							increment: 1,
						},
						// If fully booked, change status
						...(schedule.bookedSlots + 1 >= schedule.maxSlots && {
							status: "booked",
						}),
					},
				});

				return appointment;
			});

			appointmentLogger.info(`Appointment created: ${result.id}`);
			res.status(201).json({
				message: "Appointment request created successfully",
				...result,
			});
		} catch (error) {
			appointmentLogger.error(`Error creating appointment: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	// Update appointment status or details
	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const {
			status,
			title,
			description,
			appointmentType,
			requestedDate,
			priority,
			location,
			duration,
			cancellationReason,
			completionNotes,
			followUpRequired,
			followUpDate,
			attachments,
		} = req.body;

		if (!id) {
			appointmentLogger.error("Missing appointment ID");
			res.status(400).json({ error: "Appointment ID is required" });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			appointmentLogger.error("No update fields provided");
			res.status(400).json({
				error: "At least one field is required for update",
			});
			return;
		}

		appointmentLogger.info(`Updating appointment: ${id}`);

		try {
			const existingAppointment = await prisma.appointment.findFirst({
				where: {
					id,
					isDeleted: false,
				},
				include: {
					schedule: true,
				},
			});

			if (!existingAppointment) {
				appointmentLogger.error(`Appointment not found: ${id}`);
				res.status(404).json({ error: "Appointment not found" });
				return;
			}

			const result = await prisma.$transaction(async (tx) => {
				// Handle status change logic
				if (status && status !== existingAppointment.status) {
					// If cancelling or marking as no_show, free up the schedule slot
					if (
						(status === "cancelled" || status === "no_show") &&
						existingAppointment.status === "confirmed"
					) {
						await tx.schedule.update({
							where: { id: existingAppointment.scheduleId },
							data: {
								bookedSlots: {
									decrement: 1,
								},
								status: "available", // Make schedule available again
							},
						});
					}
				}

				// Update the appointment
				const updatedAppointment = await tx.appointment.update({
					where: { id },
					data: {
						...(status && { status }),
						...(title && { title }),
						...(description && { description }),
						...(appointmentType && { appointmentType }),
						...(requestedDate && { requestedDate: new Date(requestedDate) }),
						...(priority && { priority }),
						...(location && { location }),
						...(duration && { duration }),
						...(cancellationReason && { cancellationReason }),
						...(completionNotes && { completionNotes }),
						...(followUpRequired !== undefined && { followUpRequired }),
						...(followUpDate && { followUpDate: new Date(followUpDate) }),
						...(attachments && { attachments }),
					},
					include: {
						student: {
							include: {
								person: true,
							},
						},
						counselor: {
							include: {
								person: true,
							},
						},
						schedule: true,
					},
				});

				return updatedAppointment;
			});

			appointmentLogger.info(`Appointment updated: ${result.id}`);
			res.status(200).json(result);
		} catch (error) {
			appointmentLogger.error(`Error updating appointment: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	// Soft delete appointment
	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			appointmentLogger.error("Missing appointment ID");
			res.status(400).json({ error: "Appointment ID is required" });
			return;
		}

		appointmentLogger.info(`Soft deleting appointment: ${id}`);

		try {
			const existingAppointment = await prisma.appointment.findUnique({
				where: { id },
				include: {
					schedule: true,
				},
			});

			if (!existingAppointment) {
				appointmentLogger.error(`Appointment not found: ${id}`);
				res.status(404).json({ error: "Appointment not found" });
				return;
			}

			await prisma.$transaction(async (tx) => {
				// Free up schedule slot if appointment was confirmed
				if (existingAppointment.status === "confirmed") {
					await tx.schedule.update({
						where: { id: existingAppointment.scheduleId },
						data: {
							bookedSlots: {
								decrement: 1,
							},
							status: "available",
						},
					});
				}

				// Soft delete the appointment
				await tx.appointment.update({
					where: { id },
					data: { isDeleted: true },
				});
			});

			appointmentLogger.info(`Appointment deleted: ${id}`);
			res.status(200).json({ message: "Appointment deleted successfully" });
		} catch (error) {
			appointmentLogger.error(`Error deleting appointment: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	// Get appointments by student ID
	const getByStudentId = async (req: Request, res: Response, _next: NextFunction) => {
		const { studentId } = req.params;
		const { page = 1, limit = 10, status, dateFrom, dateTo } = req.query;

		if (!studentId) {
			appointmentLogger.error("Missing student ID");
			res.status(400).json({ error: "Student ID is required" });
			return;
		}

		const skip = (Number(page) - 1) * Number(limit);

		try {
			const whereClause: Prisma.AppointmentWhereInput = {
				studentId,
				isDeleted: false,
				...(status && { status: status as any }),
				...(dateFrom || dateTo
					? {
							requestedDate: {
								...(dateFrom && { gte: new Date(String(dateFrom)) }),
								...(dateTo && { lte: new Date(String(dateTo)) }),
							},
						}
					: {}),
			};

			const [appointments, total] = await Promise.all([
				prisma.appointment.findMany({
					where: whereClause,
					skip,
					take: Number(limit),
					orderBy: { createdAt: "desc" },
					include: {
						counselor: {
							include: {
								person: true,
							},
						},
						schedule: true,
					},
				}),
				prisma.appointment.count({ where: whereClause }),
			]);

			res.status(200).json({
				appointments,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			appointmentLogger.error(`Error getting student appointments: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	// Get appointments by counselor ID
	const getByCounselorId = async (req: Request, res: Response, _next: NextFunction) => {
		const { counselorId } = req.params;
		const { page = 1, limit = 10, status, dateFrom, dateTo } = req.query;

		if (!counselorId) {
			appointmentLogger.error("Missing counselor ID");
			res.status(400).json({ error: "Counselor ID is required" });
			return;
		}

		const skip = (Number(page) - 1) * Number(limit);

		try {
			const whereClause: Prisma.AppointmentWhereInput = {
				counselorId,
				isDeleted: false,
				...(status && { status: status as any }),
				...(dateFrom || dateTo
					? {
							requestedDate: {
								...(dateFrom && { gte: new Date(String(dateFrom)) }),
								...(dateTo && { lte: new Date(String(dateTo)) }),
							},
						}
					: {}),
			};

			const [appointments, total] = await Promise.all([
				prisma.appointment.findMany({
					where: whereClause,
					skip,
					take: Number(limit),
					orderBy: { createdAt: "desc" },
					include: {
						student: {
							include: {
								person: true,
							},
						},
						schedule: true,
					},
				}),
				prisma.appointment.count({ where: whereClause }),
			]);

			res.status(200).json({
				appointments,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			appointmentLogger.error(`Error getting counselor appointments: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	return {
		getById,
		getAll,
		create,
		update,
		remove,
		getByStudentId,
		getByCounselorId,
	};
};
