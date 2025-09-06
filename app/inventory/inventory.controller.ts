import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/error.config";

const logger = getLogger();
const inventoryLogger = logger.child({ module: "inventory" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		if (!id) {
			inventoryLogger.error(config.ERROR.INVENTORY.MISSING_ID);
			res.status(400).json({ error: config.ERROR.INVENTORY.MISSING_ID });
			return;
		}

		if (fields && typeof fields !== "string") {
			inventoryLogger.error(`${config.ERROR.INVENTORY.INVALID_POPULATE}: ${fields}`);
			res.status(400).json({ error: config.ERROR.INVENTORY.POPULATE_MUST_BE_STRING });
			return;
		}

		inventoryLogger.info(`${config.SUCCESS.INVENTORY.GETTING_BY_ID}: ${id}`);

		try {
			const query: Prisma.IndividualInventoryFindFirstArgs = {
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

			const inventory = await prisma.individualInventory.findFirst(query);

			if (!inventory) {
				inventoryLogger.error(`${config.ERROR.INVENTORY.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.INVENTORY.NOT_FOUND });
				return;
			}

			inventoryLogger.info(`${config.SUCCESS.INVENTORY.RETRIEVED}: ${inventory.id}`);
			res.status(200).json(inventory);
		} catch (error) {
			inventoryLogger.error(`${config.ERROR.INVENTORY.ERROR_GETTING_INVENTORY}: ${error}`);
			res.status(500).json({ error: config.ERROR.INVENTORY.INTERNAL_SERVER_ERROR });
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		const { page = 1, limit = 10, sort, fields, query, order = "desc" } = req.query;

		if (isNaN(Number(page)) || Number(page) < 1) {
			inventoryLogger.error(`${config.ERROR.INVENTORY.INVALID_PAGE}: ${page}`);
			res.status(400).json({ error: config.ERROR.INVENTORY.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			inventoryLogger.error(`${config.ERROR.INVENTORY.INVALID_LIMIT}: ${limit}`);
			res.status(400).json({ error: config.ERROR.INVENTORY.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			inventoryLogger.error(`${config.ERROR.INVENTORY.INVALID_ORDER}: ${order}`);
			res.status(400).json({ error: config.ERROR.INVENTORY.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			inventoryLogger.error(`${config.ERROR.INVENTORY.INVALID_POPULATE}: ${fields}`);
			res.status(400).json({ error: config.ERROR.INVENTORY.POPULATE_MUST_BE_STRING });
			return;
		}

		if (sort) {
			if (typeof sort === "string" && sort.startsWith("{")) {
				try {
					JSON.parse(sort);
				} catch (error) {
					inventoryLogger.error(`${config.ERROR.INVENTORY.INVALID_SORT}: ${sort}`);
					res.status(400).json({
						error: config.ERROR.INVENTORY.SORT_MUST_BE_STRING,
					});
					return;
				}
			}
		}

		const skip = (Number(page) - 1) * Number(limit);

		inventoryLogger.info(
			`${config.SUCCESS.INVENTORY.GETTING_ALL}, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
		);

		try {
			const whereClause: Prisma.IndividualInventoryWhereInput = {
				isDeleted: false,
				...(query
					? {
							OR: [
								{ height: { contains: String(query) } },
								{ weight: { contains: String(query) } },
								{ coplexion: { contains: String(query) } },
								{ student: { studentNumber: { contains: String(query) } } },
								{ student: { program: { contains: String(query) } } },
								{ student: { person: { firstName: { contains: String(query) } } } },
								{ student: { person: { lastName: { contains: String(query) } } } },
							],
						}
					: {}),
			};

			const findManyQuery: Prisma.IndividualInventoryFindManyArgs = {
				where: whereClause,
				skip,
				take: Number(limit),
				orderBy: sort
					? typeof sort === "string" && !sort.startsWith("{")
						? { [sort as string]: order }
						: JSON.parse(sort as string)
					: { id: order as Prisma.SortOrder },
				include: {
					student: {
						include: {
							person: true,
						},
					},
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

				findManyQuery.select = fieldSelections;
				delete findManyQuery.include;
			}

			const [inventories, total] = await Promise.all([
				prisma.individualInventory.findMany(findManyQuery),
				prisma.individualInventory.count({ where: whereClause }),
			]);

			inventoryLogger.info(`Retrieved ${inventories.length} inventories`);
			res.status(200).json({
				inventories,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			inventoryLogger.error(`${config.ERROR.INVENTORY.ERROR_GETTING_INVENTORY}: ${error}`);
			res.status(500).json({ error: config.ERROR.INVENTORY.INTERNAL_SERVER_ERROR });
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		const {
			studentId,
			height,
			weight,
			coplexion,
			person_to_be_contacted_in_case_of_accident_or_illness,
			educational_background,
			nature_of_schooling,
			home_and_family_background,
			health,
			interest_and_hobbies,
			test_results,
			significant_notes_councilor_only,
			student_signature,
		} = req.body;

		// Validate required fields
		if (!studentId) {
			inventoryLogger.error(config.ERROR.INVENTORY.STUDENT_ID_REQUIRED);
			res.status(400).json({
				error: config.ERROR.INVENTORY.STUDENT_ID_REQUIRED,
			});
			return;
		}

		if (!height) {
			inventoryLogger.error(config.ERROR.INVENTORY.HEIGHT_REQUIRED);
			res.status(400).json({
				error: config.ERROR.INVENTORY.HEIGHT_REQUIRED,
			});
			return;
		}

		if (!weight) {
			inventoryLogger.error(config.ERROR.INVENTORY.WEIGHT_REQUIRED);
			res.status(400).json({
				error: config.ERROR.INVENTORY.WEIGHT_REQUIRED,
			});
			return;
		}

		if (!coplexion) {
			inventoryLogger.error(config.ERROR.INVENTORY.COMPLEXION_REQUIRED);
			res.status(400).json({
				error: config.ERROR.INVENTORY.COMPLEXION_REQUIRED,
			});
			return;
		}

		if (!student_signature) {
			inventoryLogger.error(config.ERROR.INVENTORY.STUDENT_SIGNATURE_REQUIRED);
			res.status(400).json({
				error: config.ERROR.INVENTORY.STUDENT_SIGNATURE_REQUIRED,
			});
			return;
		}

		try {
			// Check if student exists
			const existingStudent = await prisma.student.findFirst({
				where: {
					id: studentId,
					isDeleted: false,
				},
			});

			if (!existingStudent) {
				inventoryLogger.error(`${config.ERROR.INVENTORY.STUDENT_NOT_FOUND}: ${studentId}`);
				res.status(404).json({
					error: config.ERROR.INVENTORY.STUDENT_NOT_FOUND,
				});
				return;
			}

			// Check if inventory already exists for this student
			const existingInventory = await prisma.individualInventory.findFirst({
				where: {
					studentId,
					isDeleted: false,
				},
			});

			if (existingInventory) {
				inventoryLogger.error(`${config.ERROR.INVENTORY.EXISTING_INVENTORY}: ${studentId}`);
				res.status(400).json({
					error: config.ERROR.INVENTORY.EXISTING_INVENTORY,
				});
				return;
			}

			const inventory = await prisma.individualInventory.create({
				data: {
					studentId,
					height,
					weight,
					coplexion,
					person_to_be_contacted_in_case_of_accident_or_illness,
					educational_background,
					nature_of_schooling,
					home_and_family_background,
					health,
					interest_and_hobbies,
					test_results,
					significant_notes_councilor_only,
					student_signature,
				},
				include: {
					student: {
						include: {
							person: true,
						},
					},
				},
			});

			inventoryLogger.info(`${config.SUCCESS.INVENTORY.CREATED}: ${inventory.id}`);
			res.status(201).json({
				message: "Individual inventory created successfully",
				...inventory,
			});
		} catch (error) {
			inventoryLogger.error(`${config.ERROR.INVENTORY.INTERNAL_SERVER_ERROR}: ${error}`);
			res.status(500).json({ error: config.ERROR.INVENTORY.INTERNAL_SERVER_ERROR });
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const {
			height,
			weight,
			coplexion,
			person_to_be_contacted_in_case_of_accident_or_illness,
			educational_background,
			nature_of_schooling,
			home_and_family_background,
			health,
			interest_and_hobbies,
			test_results,
			significant_notes_councilor_only,
			student_signature,
		} = req.body;

		if (!id) {
			inventoryLogger.error(config.ERROR.INVENTORY.MISSING_ID);
			res.status(400).json({ error: config.ERROR.INVENTORY.MISSING_ID });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			inventoryLogger.error(config.ERROR.INVENTORY.NO_UPDATE_FIELDS);
			res.status(400).json({
				error: config.ERROR.INVENTORY.AT_LEAST_ONE_FIELD_REQUIRED,
			});
			return;
		}

		inventoryLogger.info(`Updating inventory: ${id}`);

		try {
			const existingInventory = await prisma.individualInventory.findFirst({
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
				},
			});

			if (!existingInventory) {
				inventoryLogger.error(`${config.ERROR.INVENTORY.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.INVENTORY.NOT_FOUND });
				return;
			}

			const updatedInventory = await prisma.individualInventory.update({
				where: { id },
				data: {
					...(height && { height }),
					...(weight && { weight }),
					...(coplexion && { coplexion }),
					...(person_to_be_contacted_in_case_of_accident_or_illness && {
						person_to_be_contacted_in_case_of_accident_or_illness,
					}),
					...(educational_background && { educational_background }),
					...(nature_of_schooling && { nature_of_schooling }),
					...(home_and_family_background && { home_and_family_background }),
					...(health && { health }),
					...(interest_and_hobbies && { interest_and_hobbies }),
					...(test_results && { test_results }),
					...(significant_notes_councilor_only && { significant_notes_councilor_only }),
					...(student_signature && { student_signature }),
				},
				include: {
					student: {
						include: {
							person: true,
						},
					},
				},
			});

			inventoryLogger.info(`${config.SUCCESS.INVENTORY.UPDATE}: ${updatedInventory.id}`);
			res.status(200).json(updatedInventory);
		} catch (error) {
			inventoryLogger.error(`${config.ERROR.INVENTORY.ERROR_UPDATING_INVENTORY}: ${error}`);
			res.status(500).json({ error: config.ERROR.INVENTORY.INTERNAL_SERVER_ERROR });
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			inventoryLogger.error(config.ERROR.INVENTORY.MISSING_ID);
			res.status(400).json({ error: config.ERROR.INVENTORY.MISSING_ID });
			return;
		}

		inventoryLogger.info(`${config.SUCCESS.INVENTORY.SOFT_DELETING}: ${id}`);

		try {
			const existingInventory = await prisma.individualInventory.findUnique({
				where: { id },
				include: {
					student: {
						include: {
							person: true,
						},
					},
				},
			});

			if (!existingInventory) {
				inventoryLogger.error(`${config.ERROR.INVENTORY.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.INVENTORY.NOT_FOUND });
				return;
			}

			await prisma.individualInventory.update({
				where: { id },
				data: { isDeleted: true },
			});

			inventoryLogger.info(`${config.SUCCESS.INVENTORY.DELETED}: ${id}`);
			res.status(200).json({ message: config.SUCCESS.INVENTORY.DELETED });
		} catch (error) {
			inventoryLogger.error(`${config.ERROR.INVENTORY.ERROR_DELETING_INVENTORY}: ${error}`);
			res.status(500).json({ error: config.ERROR.INVENTORY.INTERNAL_SERVER_ERROR });
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
