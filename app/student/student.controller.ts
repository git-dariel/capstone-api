import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/error.config";
import { controller as authController } from "../auth/auth.controller";
import bcrypt from "bcrypt";

const logger = getLogger();
const studentLogger = logger.child({ module: "student" });

export const controller = (prisma: PrismaClient) => {
	const authCtrl = authController(prisma);

	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		if (!id) {
			studentLogger.error(config.ERROR.STUDENT.MISSING_ID);
			res.status(400).json({ error: config.ERROR.STUDENT.USER_ID_REQUIRED });
			return;
		}

		if (fields && typeof fields !== "string") {
			studentLogger.error(`${config.ERROR.STUDENT.INVALID_POPULATE}: ${fields}`);
			res.status(400).json({ error: config.ERROR.STUDENT.POPULATE_MUST_BE_STRING });
			return;
		}

		studentLogger.info(`${config.SUCCESS.STUDENT.GETTING_USER_BY_ID}: ${id}`);

		try {
			const query: Prisma.StudentFindFirstArgs = {
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

			const student = await prisma.student.findFirst(query);

			if (!student) {
				studentLogger.error(`${config.ERROR.STUDENT.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.STUDENT.NOT_FOUND });
				return;
			}

			studentLogger.info(`${config.SUCCESS.STUDENT.RETRIEVED}: ${student.id}`);
			res.status(200).json(student);
		} catch (error) {
			studentLogger.error(`${config.ERROR.STUDENT.ERROR_GETTING_USER}: ${error}`);
			res.status(500).json({ error: config.ERROR.STUDENT.INTERNAL_SERVER_ERROR });
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		const { page = 1, limit = 10, sort, fields, query, order = "desc" } = req.query;

		if (isNaN(Number(page)) || Number(page) < 1) {
			studentLogger.error(`${config.ERROR.STUDENT.INVALID_PAGE}: ${page}`);
			res.status(400).json({ error: config.ERROR.STUDENT.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			studentLogger.error(`${config.ERROR.STUDENT.INVALID_LIMIT}: ${limit}`);
			res.status(400).json({ error: config.ERROR.STUDENT.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			studentLogger.error(`${config.ERROR.STUDENT.INVALID_ORDER}: ${order}`);
			res.status(400).json({ error: config.ERROR.STUDENT.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			studentLogger.error(`${config.ERROR.STUDENT.INVALID_POPULATE}: ${fields}`);
			res.status(400).json({ error: config.ERROR.STUDENT.POPULATE_MUST_BE_STRING });
			return;
		}

		if (sort) {
			if (typeof sort === "string" && sort.startsWith("{")) {
				try {
					JSON.parse(sort);
				} catch (error) {
					studentLogger.error(`${config.ERROR.STUDENT.INVALID_SORT}: ${sort}`);
					res.status(400).json({
						error: config.ERROR.STUDENT.SORT_MUST_BE_STRING,
					});
					return;
				}
			}
		}

		const skip = (Number(page) - 1) * Number(limit);

		studentLogger.info(
			`${config.SUCCESS.STUDENT.GETTING_ALL_USERS}, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
		);

		try {
			const whereClause: Prisma.StudentWhereInput = {
				isDeleted: false,
				...(query
					? {
							OR: [
								{ studentNumber: { contains: String(query) } },
								{ program: { contains: String(query) } },
								{ year: { contains: String(query) } },
							],
						}
					: {}),
			};

			const findManyQuery: Prisma.StudentFindManyArgs = {
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
			}

			const [students, total] = await Promise.all([
				prisma.student.findMany(findManyQuery),
				prisma.student.count({ where: whereClause }),
			]);

			studentLogger.info(`Retrieved ${students.length} students`);
			res.status(200).json({
				students,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			studentLogger.error(`${config.ERROR.STUDENT.ERROR_GETTING_USER}: ${error}`);
			res.status(500).json({ error: config.ERROR.STUDENT.INTERNAL_SERVER_ERROR });
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		const { studentNumber, program, year, user } = req.body;

		if (!studentNumber) {
			studentLogger.error(config.ERROR.STUDENT.STUDENT_NUMBER_REQUIRED);
			res.status(400).json({
				error: config.ERROR.STUDENT.STUDENT_NUMBER_REQUIRED,
			});
			return;
		}

		if (!program) {
			studentLogger.error(config.ERROR.STUDENT.PROGRAM_REQUIRED);
			res.status(400).json({
				error: config.ERROR.STUDENT.PROGRAM_REQUIRED,
			});
			return;
		}

		if (!year) {
			studentLogger.error(config.ERROR.STUDENT.YEAR_REQUIRED);
			res.status(400).json({
				error: config.ERROR.STUDENT.YEAR_REQUIRED,
			});
			return;
		}

		if (!user || !user.person || !user.person.email) {
			studentLogger.error(config.ERROR.STUDENT.INVALID_USER_DATA);
			res.status(400).json({
				error: config.ERROR.STUDENT.INVALID_USER_DATA,
			});
			return;
		}

		try {
			// Check if student number already exists
			const existingStudentNumber = await prisma.student.findFirst({
				where: {
					studentNumber,
					isDeleted: false,
				},
			});

			if (existingStudentNumber) {
				studentLogger.error(
					`${config.ERROR.STUDENT.STUDENT_NUMBER_EXISTS}: ${studentNumber}`,
				);
				res.status(400).json({
					error: config.ERROR.STUDENT.STUDENT_NUMBER_EXISTS,
				});
				return;
			}

			const existingUser = await prisma.user.findFirst({
				where: {
					person: {
						email: user.person.email,
					},
					isDeleted: false,
				},
			});

			if (existingUser) {
				const existingStudent = await prisma.student.findFirst({
					where: {
						userId: existingUser.id,
						isDeleted: false,
					},
					include: {
						user: {
							include: {
								person: true,
							},
						},
					},
				});

				if (existingStudent) {
					studentLogger.info(
						`${config.SUCCESS.STUDENT.RETRIEVED}: ${existingStudent.id}`,
					);
					res.status(200).json({
						...existingStudent,
						message: config.ERROR.STUDENT.EXISTING_STUDENT,
					});
					return;
				}
			}

			const { person, ...userData } = user;
			const { firstName, lastName, email, ...otherPersonData } = person;

			const mockAuthReq = {
				body: {
					...userData,
					firstName,
					lastName,
					email,
					type: "client",
					role: "user",
					...otherPersonData,
				},
			} as Request;

			const mockAuthRes = {
				statusCode: 0,
				data: null,
				status: function (code: number) {
					this.statusCode = code;
					return this;
				},
				json: function (data: any) {
					this.data = data;
					return this;
				},
				cookie: function () {
					return this;
				},
			} as any;

			await authCtrl.register(mockAuthReq, mockAuthRes, _next);

			if (mockAuthRes.statusCode !== 201 || !mockAuthRes.data.user) {
				throw new Error("Failed to create user");
			}

			const createdUser = mockAuthRes.data.user;

			const newStudent = await prisma.student.create({
				data: {
					studentNumber,
					program,
					year,
					user: {
						connect: {
							id: createdUser.id,
						},
					},
				},
				include: {
					user: {
						include: {
							person: true,
						},
					},
				},
			});

			studentLogger.info(`${config.SUCCESS.STUDENT.CREATED}: ${newStudent.id}`);
			res.status(201).json(newStudent);
		} catch (error) {
			studentLogger.error(`${config.ERROR.STUDENT.INTERNAL_SERVER_ERROR}: ${error}`);
			res.status(500).json({ error: config.ERROR.STUDENT.INTERNAL_SERVER_ERROR });
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { studentNumber, program, year, user } = req.body;

		if (!id) {
			studentLogger.error(config.ERROR.STUDENT.MISSING_ID);
			res.status(400).json({ error: config.ERROR.STUDENT.USER_ID_REQUIRED });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			studentLogger.error(config.ERROR.STUDENT.NO_UPDATE_FIELDS);
			res.status(400).json({
				error: config.ERROR.STUDENT.AT_LEAST_ONE_FIELD_REQUIRED,
			});
			return;
		}

		studentLogger.info(`Updating student: ${id}`);

		try {
			const existingStudent = await prisma.student.findFirst({
				where: {
					id,
					isDeleted: false,
				},
				include: {
					user: {
						include: {
							person: true,
						},
					},
				},
			});

			if (!existingStudent) {
				studentLogger.error(`${config.ERROR.STUDENT.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.STUDENT.NOT_FOUND });
				return;
			}

			if (!existingStudent.user || !existingStudent.user.person) {
				studentLogger.error(`Student user or person data not found: ${id}`);
				res.status(400).json({ error: "Student user or person data not found" });
				return;
			}

			// Check if student number already exists (if updating student number)
			if (studentNumber && studentNumber !== existingStudent.studentNumber) {
				const existingStudentNumber = await prisma.student.findFirst({
					where: {
						studentNumber,
						isDeleted: false,
						id: { not: id },
					},
				});

				if (existingStudentNumber) {
					studentLogger.error(
						`${config.ERROR.STUDENT.STUDENT_NUMBER_EXISTS}: ${studentNumber}`,
					);
					res.status(400).json({
						error: config.ERROR.STUDENT.STUDENT_NUMBER_EXISTS,
					});
					return;
				}
			}

			await prisma.$transaction(async (tx) => {
				if (studentNumber || program || year) {
					await tx.student.update({
						where: { id },
						data: {
							...(studentNumber && { studentNumber }),
							...(program && { program }),
							...(year && { year }),
						},
					});
				}

				if (user) {
					const { person, password, ...userData } = user;

					let hashedPassword = null;
					if (password) {
						hashedPassword = await bcrypt.hash(password, 10);
						studentLogger.info(`Password hashed for user: ${existingStudent.user!.id}`);
					}

					if (Object.keys(userData).length > 0 || hashedPassword) {
						await tx.user.update({
							where: { id: existingStudent.user!.id },
							data: {
								...userData,
								...(hashedPassword && { password: hashedPassword }),
							},
						});
					}

					if (person) {
						const { address: newAddress, ...personData } = person;

						if (newAddress) {
							const existingPerson = await tx.person.findUnique({
								where: { id: existingStudent.user!.person!.id },
								select: { address: true },
							});

							const mergedAddress = {
								...existingPerson?.address,
								...newAddress,
							};

							await tx.person.update({
								where: { id: existingStudent.user!.person!.id },
								data: {
									...personData,
									address: {
										set: mergedAddress,
									},
								},
							});
						} else {
							await tx.person.update({
								where: { id: existingStudent.user!.person!.id },
								data: personData,
							});
						}
					}
				}
			});

			const updatedStudent = await prisma.student.findUnique({
				where: { id },
				include: {
					user: {
						include: {
							person: true,
						},
					},
				},
			});

			studentLogger.info(`${config.SUCCESS.STUDENT.UPDATE}: ${updatedStudent!.id}`);
			res.status(200).json(updatedStudent);
		} catch (error) {
			studentLogger.error(`${config.ERROR.STUDENT.ERROR_UPDATING_USER}: ${error}`);
			res.status(500).json({ error: config.ERROR.STUDENT.INTERNAL_SERVER_ERROR });
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			studentLogger.error(config.ERROR.STUDENT.MISSING_ID);
			res.status(400).json({ error: config.ERROR.STUDENT.USER_ID_REQUIRED });
			return;
		}

		studentLogger.info(`${config.SUCCESS.STUDENT.SOFT_DELETING}: ${id}`);

		try {
			const existingStudent = await prisma.student.findUnique({
				where: { id },
				include: {
					user: {
						include: {
							person: true,
						},
					},
				},
			});

			if (!existingStudent) {
				studentLogger.error(`${config.ERROR.STUDENT.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.STUDENT.NOT_FOUND });
				return;
			}

			await prisma.student.update({
				where: { id },
				data: { isDeleted: true },
			});

			studentLogger.info(`${config.SUCCESS.STUDENT.DELETED}: ${id}`);
			res.status(200).json({ message: config.SUCCESS.STUDENT.DELETED });
		} catch (error) {
			studentLogger.error(`${config.ERROR.STUDENT.ERROR_DELETING_USER}: ${error}`);
			res.status(500).json({ error: config.ERROR.STUDENT.INTERNAL_SERVER_ERROR });
		}
	};

	return {
		getById,
		getAll,
		create,
		update,
		remove,
	};
};
