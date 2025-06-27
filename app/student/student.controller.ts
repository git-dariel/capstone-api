import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/error.config";
import { controller as personController } from "../person/person.controller";

const logger = getLogger();
const studentLogger = logger.child({ module: "student" });

export const controller = (prisma: PrismaClient) => {
	const personCtrl = personController(prisma);

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
								{ person: { firstName: { contains: String(query) } } },
								{ person: { lastName: { contains: String(query) } } },
								{ person: { email: { contains: String(query) } } },
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

	const create = async (req: Request, res: Response, next: NextFunction) => {
		const {
			studentNumber,
			program,
			year,
			personId,
			firstName,
			lastName,
			middleName,
			suffix,
			contactNumber,
			email,
			gender,
			birthDate,
			birthPlace,
			age,
			religion,
			civilStatus,
			address,
			...otherData
		} = req.body;

		// Validate required fields
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

		// Only require firstName and lastName if we're creating a new person
		if (!personId && (!firstName || !lastName)) {
			studentLogger.error("First name and last name are required when creating a new person");
			res.status(400).json({
				error: "First name and last name are required when creating a new person",
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

			// If personId is provided, verify the person exists
			if (personId) {
				const existingPerson = await prisma.person.findFirst({
					where: {
						id: personId,
						isDeleted: false,
					},
				});

				if (!existingPerson) {
					studentLogger.error(`Person not found with ID: ${personId}`);
					res.status(404).json({
						error: "Person not found",
					});
					return;
				}
			}
			// Check if email already exists (if provided and creating new person)
			else if (email) {
				const existingPerson = await prisma.person.findFirst({
					where: {
						email,
						isDeleted: false,
					},
				});

				if (existingPerson) {
					studentLogger.error(`Person with this email already exists: ${email}`);
					res.status(400).json({
						error: "Person with this email already exists",
					});
					return;
				}
			}

			const result = await prisma.$transaction(async (tx) => {
				let person;

				if (personId) {
					// If personId is provided, use existing person
					person = await tx.person.findUnique({
						where: { id: personId },
					});

					if (!person) {
						throw new Error("Person not found");
					}
				} else {
					// Create person if no personId provided
					const mockReq = {
						body: {
							firstName,
							lastName,
							...(middleName ? { middleName } : {}),
							...(suffix ? { suffix } : {}),
							...(email ? { email } : {}),
							...(contactNumber ? { contactNumber } : {}),
							...(gender ? { gender } : {}),
							...(birthDate && { birthDate: new Date(birthDate) }),
							...(birthPlace ? { birthPlace } : {}),
							...(age ? { age } : {}),
							...(religion ? { religion } : {}),
							...(civilStatus ? { civilStatus } : {}),
							...(address ? { address } : {}),
							...otherData,
						},
					} as Request;

					const mockRes = {
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
					} as any;

					await personCtrl.create(mockReq, mockRes, next);

					if (mockRes.statusCode !== 201) {
						throw new Error("Failed to create person");
					}

					person = mockRes.data;
				}

				// Create student record
				const student = await tx.student.create({
					data: {
						studentNumber,
						program,
						year,
						person: {
							connect: {
								id: person.id,
							},
						},
					},
					include: {
						person: true,
					},
				});

				return student;
			});

			studentLogger.info(`${config.SUCCESS.STUDENT.CREATED}: ${result.id}`);
			res.status(201).json({
				message: "Student created successfully",
				...result,
			});
		} catch (error) {
			studentLogger.error(`${config.ERROR.STUDENT.INTERNAL_SERVER_ERROR}: ${error}`);
			res.status(500).json({ error: config.ERROR.STUDENT.INTERNAL_SERVER_ERROR });
		}
	};

	const update = async (req: Request, res: Response, next: NextFunction) => {
		const { id } = req.params;
		const { studentNumber, program, year, person } = req.body;

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
					person: true,
				},
			});

			if (!existingStudent) {
				studentLogger.error(`${config.ERROR.STUDENT.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.STUDENT.NOT_FOUND });
				return;
			}

			if (!existingStudent.person) {
				studentLogger.error(`Student person data not found: ${id}`);
				res.status(400).json({ error: "Student person data not found" });
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
				// Update student fields
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

				// Update person fields
				if (person) {
					const { address: newAddress, ...personData } = person;

					if (newAddress) {
						const existingPerson = await tx.person.findUnique({
							where: { id: existingStudent.person!.id },
							select: { address: true },
						});

						const mergedAddress = {
							...existingPerson?.address,
							...newAddress,
						};

						await tx.person.update({
							where: { id: existingStudent.person!.id },
							data: {
								...personData,
								address: {
									set: mergedAddress,
								},
							},
						});
					} else {
						await tx.person.update({
							where: { id: existingStudent.person!.id },
							data: personData,
						});
					}
				}
			});

			const updatedStudent = await prisma.student.findUnique({
				where: { id },
				include: {
					person: true,
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
					person: true,
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
