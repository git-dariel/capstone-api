import bcrypt from "bcrypt";
import { NextFunction, Response } from "express";
import { config } from "../../config/error.config";
import { Prisma, PrismaClient, Role } from "../../generated/prisma";
import { exportStudentDataCsv } from "../../helper/csv.helper";
import { getLogger } from "../../helper/logger";
import { requireAdmin, requireAnyRole } from "../../middleware/rbac";
import { AuthRequest } from "../../middleware/verifyToken";

const logger = getLogger();
const userLogger = logger.child({ module: "user" });

export const controller = (prisma: PrismaClient) => {
	const getById = requireAnyRole(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		if (!id) {
			userLogger.error(config.ERROR.USER.MISSING_ID);
			res.status(400).json({ error: config.ERROR.USER.USER_ID_REQUIRED });
			return;
		}

		if (fields && typeof fields !== "string") {
			userLogger.error(`${config.ERROR.USER.INVALID_POPULATE}: ${fields}`);
			res.status(400).json({ error: config.ERROR.USER.POPULATE_MUST_BE_STRING });
			return;
		}

		// Business logic: users can only view their own profile unless they're admin
		if (req.role === Role.user && id !== req.userId) {
			userLogger.warn(`User ${req.userId} attempted to access user ${id}`);
			res.status(403).json({ error: "You can only view your own profile" });
			return;
		}

		userLogger.info(`${config.SUCCESS.USER.GETTING_USER_BY_ID}: ${id}`);

		try {
			const query: Prisma.UserFindFirstArgs = {
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
			} else {
				// Default include person when no specific fields are requested
				query.include = {
					person: true,
				};
			}

			const user = await prisma.user.findFirst(query);

			if (!user) {
				userLogger.error(`${config.ERROR.USER.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.USER.NOT_FOUND });
				return;
			}

			userLogger.info(`${config.SUCCESS.USER.RETRIEVED}: ${user.id}`);
			res.status(200).json(user);
		} catch (error) {
			userLogger.error(`${config.ERROR.USER.ERROR_GETTING_USER}: ${error}`);
			res.status(500).json({ error: config.ERROR.USER.INTERNAL_SERVER_ERROR });
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
			userId,
			type,
		} = req.query;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (isNaN(Number(page)) || Number(page) < 1) {
			userLogger.error(`${config.ERROR.USER.INVALID_PAGE}: ${page}`);
			res.status(400).json({ error: config.ERROR.USER.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			userLogger.error(`${config.ERROR.USER.INVALID_LIMIT}: ${limit}`);
			res.status(400).json({ error: config.ERROR.USER.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			userLogger.error(`${config.ERROR.USER.INVALID_ORDER}: ${order}`);
			res.status(400).json({ error: config.ERROR.USER.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			userLogger.error(`${config.ERROR.USER.INVALID_POPULATE}: ${fields}`);
			res.status(400).json({ error: config.ERROR.USER.POPULATE_MUST_BE_STRING });
			return;
		}

		if (type && !["student", "guidance"].includes(String(type))) {
			userLogger.error(`Invalid user type filter: ${type}`);
			res.status(400).json({ error: "Type must be either 'student' or 'guidance'" });
			return;
		}

		if (sort) {
			if (typeof sort === "string" && sort.startsWith("{")) {
				try {
					JSON.parse(sort);
				} catch (error) {
					userLogger.error(`${config.ERROR.USER.INVALID_SORT}: ${sort}`);
					res.status(400).json({
						error: config.ERROR.USER.SORT_MUST_BE_STRING,
					});
					return;
				}
			}
		}

		const skip = (Number(page) - 1) * Number(limit);

		userLogger.info(
			`${config.SUCCESS.USER.GETTING_ALL_USERS}, page: ${page}, limit: ${limit}, query: ${query}, type: ${type}, order: ${order}, requestingUser: ${requestingUserId}, role: ${userRole}`,
		);

		try {
			const whereClause: Prisma.UserWhereInput = {
				isDeleted: false,
				...(type && { type: String(type) as any }), // Filter by user type (student, guidance)
				...(query
					? {
							OR: [
								{
									person: {
										OR: [
											{ firstName: { contains: String(query) } },
											{ lastName: { contains: String(query) } },
											{ contactNumber: { contains: String(query) } },
										],
									},
								},
								{ userName: { contains: String(query) } },
							],
						}
					: {}),
			};

			// Role-based access control
			if (userRole === Role.user) {
				// Regular users can see their own data OR guidance counselors (for booking appointments)
				if (type === "guidance") {
					// Allow students to view guidance counselors for appointment booking
					// The type filter is already applied above, so no additional restriction needed
				} else {
					// For other queries, users can only see their own data
					whereClause.id = requestingUserId;
				}
			} else if (userRole === Role.admin || userRole === Role.super_admin) {
				// Admins can see all users, but can also filter by specific userId if provided
				if (userId) {
					whereClause.id = String(userId);
				}
			}

			const findManyQuery: Prisma.UserFindManyArgs = {
				where: whereClause,
				skip,
				take: Number(limit),
				orderBy: sort
					? typeof sort === "string" && !sort.startsWith("{")
						? { [sort as string]: order }
						: JSON.parse(sort as string)
					: { id: order as Prisma.SortOrder },
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
			} else {
				// Default include person when no specific fields are requested
				findManyQuery.include = {
					person: true,
				};
			}

			const [users, total] = await Promise.all([
				prisma.user.findMany(findManyQuery),
				prisma.user.count({ where: whereClause }),
			]);

			userLogger.info(`Retrieved ${users.length} users`);
			res.status(200).json({
				users,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			userLogger.error(`${config.ERROR.USER.ERROR_GETTING_USER}: ${error}`);
			res.status(500).json({ error: config.ERROR.USER.INTERNAL_SERVER_ERROR });
		}
	});

	const update = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { userName, role, type, status, password, ...personData } = req.body;

		if (!id) {
			userLogger.error(config.ERROR.USER.MISSING_ID);
			res.status(400).json({ error: config.ERROR.USER.USER_ID_REQUIRED });
			return;
		}

		if (req.role === Role.user && id !== req.userId) {
			userLogger.warn(`User ${req.userId} attempted to update user ${id}`);
			res.status(403).json({ error: "You can only update your own profile" });
			return;
		}

		if (req.role === Role.user && (role || type || status)) {
			userLogger.warn(`User ${req.userId} attempted to update restricted fields`);
			res.status(403).json({ error: "You cannot update role, type, or status" });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			userLogger.error(config.ERROR.USER.NO_UPDATE_FIELDS);
			res.status(400).json({
				error: config.ERROR.USER.AT_LEAST_ONE_FIELD_REQUIRED,
			});
			return;
		}

		if (personData.contactNumber) {
			// More flexible phone regex that allows:
			// - Optional + at start
			// - Digits 0-9 (including leading zeros for local formats)
			// - 7-15 digits total (standard phone number length range)
			// - Optional spaces, dashes, parentheses for formatting
			const phoneRegex = /^\+?[\d\s\-\(\)]{7,20}$/;
			const cleanedPhone = personData.contactNumber.replace(/[\s\-\(\)]/g, "");

			if (
				!phoneRegex.test(personData.contactNumber) ||
				cleanedPhone.length < 7 ||
				cleanedPhone.length > 15
			) {
				userLogger.error(`${config.ERROR.USER.INVALID_PHONE}: ${personData.contactNumber}`);
				res.status(400).json({ error: config.ERROR.USER.INVALID_PHONE });
				return;
			}

			const userWithPhone = await prisma.user.findFirst({
				where: {
					person: {
						contactNumber: personData.contactNumber,
					},
					id: { not: id },
					isDeleted: false,
				},
			});

			if (userWithPhone) {
				userLogger.error(
					`${config.ERROR.USER.PHONE_ALREADY_IN_USE}: ${personData.contactNumber}`,
				);
				res.status(400).json({ error: config.ERROR.USER.PHONE_ALREADY_IN_USE });
				return;
			}
		}

		userLogger.info(`Updating user: ${id}`);

		try {
			const existingUser = await prisma.user.findUnique({
				where: { id },
				include: { person: true },
			});

			if (!existingUser) {
				userLogger.error(`${config.ERROR.USER.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.USER.NOT_FOUND });
				return;
			}

			// Hash password if provided
			let hashedPassword = null;
			if (password) {
				hashedPassword = await bcrypt.hash(password, 10);
				userLogger.info(`Password hashed for user: ${id}`);
			}

			const [updatedUser] = await prisma.$transaction([
				prisma.user.update({
					where: { id },
					data: {
						...(userName && { userName }),
						...(role && { role }),
						...(type && { type }),
						...(status && { status }),
						...(hashedPassword && { password: hashedPassword }),
					},
					include: {
						person: true,
					},
				}),
				...(Object.keys(personData).length > 0
					? [
							prisma.person.update({
								where: { id: existingUser.person?.id },
								data: personData,
							}),
						]
					: []),
			]);

			userLogger.info(`${config.SUCCESS.USER.UPDATE}: ${updatedUser.id}`);
			res.status(200).json(updatedUser);
		} catch (error) {
			userLogger.error(`${config.ERROR.USER.ERROR_UPDATING_USER}: ${error}`);
			res.status(500).json({ error: config.ERROR.USER.INTERNAL_SERVER_ERROR });
		}
	};

	const remove = requireAdmin(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			userLogger.error(config.ERROR.USER.MISSING_ID);
			res.status(400).json({ error: config.ERROR.USER.USER_ID_REQUIRED });
			return;
		}

		userLogger.info(`${config.SUCCESS.USER.SOFT_DELETING}: ${id}`);

		try {
			const existingUser = await prisma.user.findUnique({
				where: { id },
				include: { person: true },
			});

			if (!existingUser) {
				userLogger.error(`${config.ERROR.USER.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.USER.NOT_FOUND });
				return;
			}

			await prisma.$transaction([
				prisma.user.update({
					where: { id },
					data: { isDeleted: true },
				}),
				prisma.person.update({
					where: { id: existingUser.person?.id },
					data: { isDeleted: true },
				}),
			]);

			userLogger.info(`${config.SUCCESS.USER.DELETED}: ${id}`);
			res.status(200).json({ message: config.SUCCESS.USER.DELETED });
		} catch (error) {
			userLogger.error(`${config.ERROR.USER.ERROR_DELETING_USER}: ${error}`);
			res.status(500).json({ error: config.ERROR.USER.INTERNAL_SERVER_ERROR });
		}
	});

	const exportCsv = requireAdmin(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		userLogger.info("CSV export requested");

		try {
			const csvContent = await exportStudentDataCsv(prisma);

			// Set headers for CSV download
			res.setHeader("Content-Type", "text/csv");
			res.setHeader(
				"Content-Disposition",
				'attachment; filename="student_mental_health_data.csv"',
			);

			userLogger.info("CSV export completed successfully");
			res.status(200).send(csvContent);
		} catch (error) {
			userLogger.error(`Error exporting CSV: ${error}`);
			res.status(500).json({ error: "Failed to export CSV data" });
		}
	});

	return {
		getById,
		getAll,
		update,
		remove,
		exportCsv,
	};
};
