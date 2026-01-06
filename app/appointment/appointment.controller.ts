import { NextFunction, Request, Response } from "express";
import { Prisma, PrismaClient } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { createNotificationHelper } from "../../helper/notification.helper";

const logger = getLogger();
const appointmentLogger = logger.child({ module: "appointment" });

/**
 * Helper function to calculate appointment priority based on student's inventory mental health predictions
 * @param studentId - The ID of the student
 * @returns Priority level: "urgent", "high", "normal", or "low"
 */
const calculatePriorityFromInventory = async (
	prisma: PrismaClient,
	userId: string,
): Promise<string> => {
	try {
		// First, get the User to find their personId
		const user = await prisma.user.findFirst({
			where: {
				id: userId,
				type: "student",
				isDeleted: false,
			},
			select: {
				personId: true,
			},
		});

		if (!user) {
			appointmentLogger.warn(`User not found for priority calculation: ${userId}`);
			return "normal";
		}

		// Then, get the Student record using the personId
		const student = await prisma.student.findFirst({
			where: {
				personId: user.personId,
				isDeleted: false,
			},
			select: {
				id: true,
			},
		});

		if (!student) {
			appointmentLogger.warn(`Student record not found for personId: ${user.personId}`);
			return "normal";
		}

		// Now fetch the student's inventory with latest mental health predictions using the Student record ID
		const inventory = await prisma.individualInventory.findFirst({
			where: {
				studentId: student.id,
				isDeleted: false,
			},
			include: {
				mentalHealthPredictions: {
					where: {
						isDeleted: false,
					},
					orderBy: {
						predictionDate: "desc",
					},
					take: 1, // Get only the latest prediction
				},
			},
		});

		// If no inventory or predictions exist, return normal priority
		if (!inventory || !inventory.mentalHealthPredictions.length) {
			return "normal";
		}

		const latestPrediction = inventory.mentalHealthPredictions[0];
		const mentalHealthRisk = latestPrediction.mentalHealthRisk;

		// Determine priority based on risk level
		switch (mentalHealthRisk.level) {
			case "critical":
				return "urgent";
			case "high":
				return "high";
			case "moderate":
				return "normal";
			case "low":
				return "low";
			default:
				return "normal";
		}
	} catch (error) {
		appointmentLogger.error(`Error calculating priority from inventory: ${error}`);
		// Default to normal priority if there's an error
		return "normal";
	}
};

export const controller = (prisma: PrismaClient) => {
	const notificationHelper = createNotificationHelper(prisma);
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

			// Enhanced sorting logic to support alphabetical sorting by student name
			let orderByClause:
				| Prisma.AppointmentOrderByWithRelationInput
				| Prisma.AppointmentOrderByWithRelationInput[];

			if (sort === "studentName") {
				// Sort by student's first name, then last name alphabetically
				orderByClause = [
					{ student: { person: { firstName: order as Prisma.SortOrder } } },
					{ student: { person: { lastName: order as Prisma.SortOrder } } },
				];
			} else if (sort === "priority") {
				// Sort by priority (urgent > high > normal > low)
				orderByClause = { priority: order as Prisma.SortOrder };
			} else if (sort && typeof sort === "string" && !sort.startsWith("{")) {
				orderByClause = { [sort as string]: order };
			} else if (sort && typeof sort === "string" && sort.startsWith("{")) {
				orderByClause = JSON.parse(sort as string);
			} else {
				orderByClause = { createdAt: order as Prisma.SortOrder };
			}

			const findManyQuery: Prisma.AppointmentFindManyArgs = {
				where: whereClause,
				skip,
				take: Number(limit),
				orderBy: orderByClause,
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
			status,
			priority,
			location,
			duration,
			attachments,
		} = req.body;

		// Get the authenticated user from the request (set by auth middleware)
		const authenticatedUser = (req as any).user;

		if (!studentId || !counselorId || !requestedDate) {
			appointmentLogger.error("Missing required fields");
			res.status(400).json({
				error: "Student ID, Counselor ID, and Requested Date are required",
			});
			return;
		}

		appointmentLogger.info(`Creating appointment for student: ${studentId}`);

		try {
			// Verify student user exists and is of type 'student' (studentId is the User ID)
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

			// Calculate priority based on inventory if not explicitly provided
			// Pass the User ID to calculatePriorityFromInventory
			let appointmentPriority = priority || "normal";
			if (!priority) {
				appointmentPriority = await calculatePriorityFromInventory(prisma, studentId);
				appointmentLogger.info(
					`Auto-calculated priority for user ${studentId}: ${appointmentPriority}`,
				);
			}

			// Check for appointment conflicts (double-booking)
			const requestDate = new Date(requestedDate);
			const appointmentDuration = duration || 60; // Default to 60 minutes
			const appointmentEndTime = new Date(
				requestDate.getTime() + appointmentDuration * 60000,
			);

			// Check if student already has an appointment at this time
			const studentConflict = await prisma.appointment.findFirst({
				where: {
					studentId,
					isDeleted: false,
					status: {
						notIn: ["cancelled", "no_show"], // Ignore cancelled and no-show appointments
					},
					OR: [
						{
							// New appointment starts during existing appointment
							AND: [
								{ requestedDate: { lte: requestDate } },
								{
									requestedDate: {
										gte: new Date(requestDate.getTime() - 120 * 60000), // Check 2 hours before
									},
								},
							],
						},
					],
				},
				include: {
					counselor: {
						include: {
							person: true,
						},
					},
				},
			});

			if (studentConflict) {
				// Calculate conflict end time
				const conflictEndTime = new Date(
					studentConflict.requestedDate.getTime() +
						(studentConflict.duration || 60) * 60000,
				);

				// Check if there's an actual overlap
				const hasOverlap =
					(requestDate >= studentConflict.requestedDate &&
						requestDate < conflictEndTime) ||
					(appointmentEndTime > studentConflict.requestedDate &&
						appointmentEndTime <= conflictEndTime) ||
					(requestDate <= studentConflict.requestedDate &&
						appointmentEndTime >= conflictEndTime);

				if (hasOverlap) {
					const conflictCounselor = studentConflict.counselor?.person
						? `${studentConflict.counselor.person.firstName} ${studentConflict.counselor.person.lastName}`
						: "Unknown";
					appointmentLogger.error(
						`Student already has an appointment at this time: ${studentConflict.id}`,
					);
					res.status(409).json({
						error: "Student already has an appointment at this time",
						conflictDetails: {
							appointmentId: studentConflict.id,
							date: studentConflict.requestedDate,
							duration: studentConflict.duration,
							counselor: conflictCounselor,
						},
					});
					return;
				}
			}

			// Check if counselor already has an appointment at this time
			const counselorConflict = await prisma.appointment.findFirst({
				where: {
					counselorId,
					isDeleted: false,
					status: {
						notIn: ["cancelled", "no_show"],
					},
					OR: [
						{
							AND: [
								{ requestedDate: { lte: requestDate } },
								{
									requestedDate: {
										gte: new Date(requestDate.getTime() - 120 * 60000),
									},
								},
							],
						},
					],
				},
				include: {
					student: {
						include: {
							person: true,
						},
					},
				},
			});

			if (counselorConflict) {
				const conflictEndTime = new Date(
					counselorConflict.requestedDate.getTime() +
						(counselorConflict.duration || 60) * 60000,
				);

				const hasOverlap =
					(requestDate >= counselorConflict.requestedDate &&
						requestDate < conflictEndTime) ||
					(appointmentEndTime > counselorConflict.requestedDate &&
						appointmentEndTime <= conflictEndTime) ||
					(requestDate <= counselorConflict.requestedDate &&
						appointmentEndTime >= conflictEndTime);

				if (hasOverlap) {
					const conflictStudent = counselorConflict.student?.person
						? `${counselorConflict.student.person.firstName} ${counselorConflict.student.person.lastName}`
						: "Unknown";
					appointmentLogger.error(
						`Counselor already has an appointment at this time: ${counselorConflict.id}`,
					);
					res.status(409).json({
						error: "Counselor already has an appointment at this time",
						conflictDetails: {
							appointmentId: counselorConflict.id,
							date: counselorConflict.requestedDate,
							duration: counselorConflict.duration,
							student: conflictStudent,
						},
					});
					return;
				}
			}

			// Verify schedule exists and is available (only if scheduleId is provided)
			let schedule = null;
			if (scheduleId) {
				schedule = await prisma.schedule.findFirst({
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
				if (requestDate < schedule.startTime || requestDate > schedule.endTime) {
					appointmentLogger.error(`Requested date outside schedule range`);
					res.status(400).json({
						error: "Requested date must be within the schedule time range",
					});
					return;
				}
			}

			// Determine appointment status based on who is creating it
			// If guidance counselor is creating the appointment, auto-confirm
			// If student is creating (requesting), set as pending
			let appointmentStatus = status || "pending";
			if (!status) {
				// Check if the authenticated user is the counselor
				if (authenticatedUser && authenticatedUser.id === counselorId) {
					appointmentStatus = "confirmed";
					appointmentLogger.info(
						`Auto-confirming appointment created by counselor: ${counselorId}`,
					);
				} else {
					appointmentStatus = "pending";
				}
			}

			const result = await prisma.$transaction(async (tx) => {
				// Create the appointment with calculated priority
				const appointment = await tx.appointment.create({
					data: {
						studentId,
						counselorId,
						...(scheduleId && { scheduleId }),
						title,
						description,
						appointmentType: appointmentType || "general_information",
						requestedDate: new Date(requestedDate),
						status: appointmentStatus,
						priority: appointmentPriority,
						location: location || schedule?.location,
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

				// Update schedule booked slots (only if scheduleId is provided)
				if (scheduleId && schedule) {
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
				}

				return appointment;
			});

			appointmentLogger.info(`Appointment created: ${result.id}`);

			// Create notification for appointment creation
			try {
				await notificationHelper.createAppointmentNotification(
					"CREATED",
					result.studentId,
					result.id,
					{
						appointmentType: result.appointmentType,
						requestedDate: result.requestedDate,
						counselorName: result.counselor?.person
							? `${result.counselor.person.firstName} ${result.counselor.person.lastName}`
							: "Unknown Counselor",
					},
				);
			} catch (notificationError) {
				appointmentLogger.warn(
					`Failed to create appointment notification: ${notificationError}`,
				);
			}

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
					// This should work for any active appointment status (pending, confirmed)
					// Only if the appointment has a scheduleId
					if (
						(status === "cancelled" || status === "no_show") &&
						(existingAppointment.status === "pending" ||
							existingAppointment.status === "confirmed") &&
						existingAppointment.scheduleId
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

			// Create notification for appointment update
			try {
				let notificationAction: "UPDATED" | "CANCELLED" | "CONFIRMED" | "COMPLETED" =
					"UPDATED";
				if (status) {
					switch (status) {
						case "cancelled":
							notificationAction = "CANCELLED";
							break;
						case "confirmed":
							notificationAction = "CONFIRMED";
							break;
						case "completed":
							notificationAction = "COMPLETED";
							break;
						default:
							notificationAction = "UPDATED";
					}
				}

				await notificationHelper.createAppointmentNotification(
					notificationAction,
					result.studentId,
					result.id,
					{
						status: result.status,
						appointmentType: result.appointmentType,
						requestedDate: result.requestedDate,
						counselorName: result.counselor?.person
							? `${result.counselor.person.firstName} ${result.counselor.person.lastName}`
							: "Unknown Counselor",
					},
				);
			} catch (notificationError) {
				appointmentLogger.warn(
					`Failed to create appointment update notification: ${notificationError}`,
				);
			}

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
				// Free up schedule slot if appointment was active (pending or confirmed)
				// Only if the appointment has a scheduleId
				if (
					(existingAppointment.status === "pending" ||
						existingAppointment.status === "confirmed") &&
					existingAppointment.scheduleId
				) {
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
