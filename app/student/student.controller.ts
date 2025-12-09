import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/error.config";
import { controller as personController } from "../person/person.controller";
import { updateStudentYearLevels } from "../../services/student-year-level-cron.service";
import { parse } from "csv-parse/sync";

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
				// Filter out userId from fields since it's not a database field
				const filteredFields = fields
					.split(",")
					.filter((field) => field.trim() !== "userId");

				const fieldSelections = filteredFields.reduce(
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

			// Get user IDs for each student by matching personId
			const studentsWithUserIds = await Promise.all(
				students.map(async (student) => {
					const user = await prisma.user.findFirst({
						where: {
							personId: student.personId,
							type: "student",
							isDeleted: false,
						},
						select: { id: true },
					});
					return {
						...student,
						userId: user?.id || null,
					};
				}),
			);

			studentLogger.info(`Retrieved ${studentsWithUserIds.length} students`);
			res.status(200).json({
				students: studentsWithUserIds,
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
			status,
			notes,
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

		// Validate status if provided
		if (status && !["freshman", "sophomore", "junior", "senior"].includes(status)) {
			studentLogger.error(`Invalid academic status: ${status}`);
			res.status(400).json({
				error: "Status must be one of: freshman, sophomore, junior, senior",
			});
			return;
		}

		// Validate notes array if provided
		if (notes && !Array.isArray(notes)) {
			studentLogger.error(`Invalid notes format: ${notes}`);
			res.status(400).json({
				error: "Notes must be an array",
			});
			return;
		}

		if (notes && Array.isArray(notes)) {
			for (const note of notes) {
				if (typeof note !== "object" || note === null) {
					studentLogger.error(`Invalid note format: ${note}`);
					res.status(400).json({
						error: "Each note must be an object",
					});
					return;
				}

				if (note.title && typeof note.title !== "string") {
					studentLogger.error(`Invalid note title: ${note.title}`);
					res.status(400).json({
						error: "Note title must be a string",
					});
					return;
				}

				if (note.content && typeof note.content !== "string") {
					studentLogger.error(`Invalid note content: ${note.content}`);
					res.status(400).json({
						error: "Note content must be a string",
					});
					return;
				}

				// Validate and normalize createdAt if provided
				if (note.createdAt !== undefined && note.createdAt !== null) {
					// Try to parse as Date to ensure it's valid
					const dateValue = new Date(note.createdAt);
					if (isNaN(dateValue.getTime())) {
						studentLogger.error(`Invalid note createdAt: ${note.createdAt}`);
						res.status(400).json({
							error: "Note createdAt must be a valid date",
						});
						return;
					}
					// Convert to ISO string to ensure proper format
					note.createdAt = dateValue.toISOString();
				}
			}
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
						...(status && { status }),
						...(notes && Array.isArray(notes) && { notes }),
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
		const { studentNumber, program, year, status, notes, person } = req.body;

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

		// Validate status if provided
		if (status && !["freshman", "sophomore", "junior", "senior"].includes(status)) {
			studentLogger.error(`Invalid academic status: ${status}`);
			res.status(400).json({
				error: "Status must be one of: freshman, sophomore, junior, senior",
			});
			return;
		}

		// Validate notes array if provided
		if (notes && !Array.isArray(notes)) {
			studentLogger.error(`Invalid notes format: ${notes}`);
			res.status(400).json({
				error: "Notes must be an array",
			});
			return;
		}

		if (notes && Array.isArray(notes)) {
			for (const note of notes) {
				if (typeof note !== "object" || note === null) {
					studentLogger.error(`Invalid note format: ${note}`);
					res.status(400).json({
						error: "Each note must be an object",
					});
					return;
				}

				if (note.title && typeof note.title !== "string") {
					studentLogger.error(`Invalid note title: ${note.title}`);
					res.status(400).json({
						error: "Note title must be a string",
					});
					return;
				}

				if (note.content && typeof note.content !== "string") {
					studentLogger.error(`Invalid note content: ${note.content}`);
					res.status(400).json({
						error: "Note content must be a string",
					});
					return;
				}

				// Validate and normalize createdAt if provided
				if (note.createdAt !== undefined && note.createdAt !== null) {
					// Try to parse as Date to ensure it's valid
					const dateValue = new Date(note.createdAt);
					if (isNaN(dateValue.getTime())) {
						studentLogger.error(`Invalid note createdAt: ${note.createdAt}`);
						res.status(400).json({
							error: "Note createdAt must be a valid date",
						});
						return;
					}
					// Convert to ISO string to ensure proper format
					note.createdAt = dateValue.toISOString();
				}
			}
		}

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
				if (studentNumber || program || year || status || notes) {
					await tx.student.update({
						where: { id },
						data: {
							...(studentNumber && { studentNumber }),
							...(program && { program }),
							...(year && { year }),
							...(status && { status }),
							...(notes && Array.isArray(notes) && { notes }),
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

	const updateYearLevels = async (req: Request, res: Response, _next: NextFunction) => {
		studentLogger.info("Manual year level update requested");

		try {
			const result = await updateStudentYearLevels(prisma);

			studentLogger.info(
				`Year level update completed. Updated: ${result.updated}, Skipped: ${result.skipped}, Errors: ${result.errors}`,
			);

			res.status(200).json({
				message: "Student year levels updated successfully",
				...result,
			});
		} catch (error) {
			studentLogger.error(`Failed to update student year levels: ${error}`);
			res.status(500).json({
				error: "Failed to update student year levels",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const uploadStudentsCSV = async (req: Request, res: Response, _next: NextFunction) => {
		studentLogger.info("CSV upload request received");

		// Verify user type is guidance (admin/super_admin users are guidance users)
		const authReq = req as any;
		if (!authReq.userId) {
			studentLogger.error("User not authenticated");
			res.status(401).json({ error: "Authentication required" });
			return;
		}

		// Check if user is guidance type
		const user = await prisma.user.findUnique({
			where: { id: authReq.userId },
			select: { type: true, role: true },
		});

		if (!user || user.type !== "guidance") {
			studentLogger.error(`Access denied for user type: ${user?.type}`);
			res.status(403).json({ error: "Only guidance users can upload student CSV files" });
			return;
		}

		if (!req.file) {
			studentLogger.error("No CSV file provided");
			res.status(400).json({ error: "CSV file is required" });
			return;
		}

		if (req.file.mimetype !== "text/csv") {
			studentLogger.error(`Invalid file type: ${req.file.mimetype}`);
			res.status(400).json({ error: "File must be a CSV" });
			return;
		}

		try {
			const csvContent = req.file.buffer.toString("utf-8");

			// Parse CSV with validation
			const records = parse(csvContent, {
				columns: true,
				skip_empty_lines: true,
				trim: true,
			}) as any[];

			if (records.length === 0) {
				studentLogger.error("CSV file is empty or contains no valid records");
				res.status(400).json({ error: "CSV file contains no valid records" });
				return;
			}

			// Validate CSV format - should have STUDENT NUMBER, FIRSTNAME, and LASTNAME columns
			const requiredColumns = ["STUDENT NUMBER", "FIRSTNAME", "LASTNAME"];
			const csvColumns = Object.keys(records[0]);

			const missingColumns = requiredColumns.filter((col) => !csvColumns.includes(col));
			if (missingColumns.length > 0) {
				studentLogger.error(`Missing required columns: ${missingColumns.join(", ")}`);
				res.status(400).json({
					error: `CSV must contain the following columns: ${requiredColumns.join(", ")}. MIDDLENAME is optional.`,
					missingColumns,
				});
				return;
			}

			const results = {
				total: 0,
				successful: 0,
				skipped: 0,
				errors: [] as any[],
			};

			// Process records in batches for better performance
			const batchSize = 50;
			for (let i = 0; i < records.length; i += batchSize) {
				const batch = records.slice(i, i + batchSize);

				await prisma.$transaction(
					async (tx) => {
						for (const record of batch) {
							results.total++;

							const studentNumber = record["STUDENT NUMBER"]?.trim();
							const firstName = record["FIRSTNAME"]?.trim();
							const lastName = record["LASTNAME"]?.trim();
							const middleName = record["MIDDLENAME"]?.trim() || null;

							// Skip empty rows - require student number, first name, and last name
							if (!studentNumber || !firstName || !lastName) {
								results.skipped++;
								continue;
							}

							try {
								// Check if student already exists
								const existingStudent = await tx.student.findFirst({
									where: {
										studentNumber,
										isDeleted: false,
									},
								});

								if (existingStudent) {
									results.skipped++;
									studentLogger.info(
										`Student ${studentNumber} already exists, skipping`,
									);
									continue;
								}

								// Create person record
								const person = await tx.person.create({
									data: {
										firstName,
										lastName,
										middleName: middleName || null,
										isDeleted: false,
									},
								});

								// Create student record
								await tx.student.create({
									data: {
										studentNumber,
										program: "To be assigned", // Default program
										year: "1st", // Default year for first year students
										status: "freshman",
										person: {
											connect: {
												id: person.id,
											},
										},
										isDeleted: false,
									},
								});

								results.successful++;
								studentLogger.info(
									`Successfully created student: ${studentNumber} - ${firstName} ${middleName || ""} ${lastName}`
										.trim()
										.replace(/\s+/g, " "),
								);
							} catch (error) {
								results.errors.push({
									studentNumber,
									firstName,
									lastName,
									middleName,
									error: error instanceof Error ? error.message : String(error),
								});
								studentLogger.error(
									`Failed to create student ${studentNumber}: ${error}`,
								);
							}
						}
					},
					{
						timeout: 60000, // 60 second timeout for large batches
					},
				);
			}

			studentLogger.info(
				`CSV upload completed. Total: ${results.total}, Successful: ${results.successful}, Skipped: ${results.skipped}, Errors: ${results.errors.length}`,
			);

			res.status(200).json({
				message: "CSV upload completed",
				results,
			});
		} catch (error) {
			studentLogger.error(`CSV upload failed: ${error}`);
			res.status(500).json({
				error: "Failed to process CSV file",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	};

	return {
		getById,
		getAll,
		create,
		update,
		remove,
		updateYearLevels,
		uploadStudentsCSV,
	};
};
