import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma, StressLevel, PerformanceChange } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/error.config";
import { mentalHealthPredictor, StudentData } from "../../helper/ml.helper";

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

	const getByStudentId = async (req: Request, res: Response, _next: NextFunction) => {
		const { studentId } = req.params;
		const { fields } = req.query;

		if (!studentId) {
			inventoryLogger.error("Student ID is required");
			res.status(400).json({ error: "Student ID is required" });
			return;
		}

		if (fields && typeof fields !== "string") {
			inventoryLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.INVENTORY.POPULATE_MUST_BE_STRING });
			return;
		}

		inventoryLogger.info(`Getting inventory by student ID: ${studentId}`);

		try {
			const query: Prisma.IndividualInventoryFindFirstArgs = {
				where: {
					studentId,
					isDeleted: false,
					student: {
						isDeleted: false,
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

				query.select = fieldSelections;
			}

			const inventory = await prisma.individualInventory.findFirst(query);

			if (!inventory) {
				inventoryLogger.info(`No inventory found for student ID: ${studentId}`);
				res.status(404).json({ error: "Individual inventory not found for this student" });
				return;
			}

			inventoryLogger.info(`Inventory retrieved for student: ${inventory.id}`);
			res.status(200).json(inventory);
		} catch (error) {
			inventoryLogger.error(`Error getting inventory by student ID: ${error}`);
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
			sleep_duration,
			stress_level,
			academic_performance_change,
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

		if (!sleep_duration) {
			inventoryLogger.error("Sleep duration is required");
			res.status(400).json({
				error: "Sleep duration is required",
			});
			return;
		}

		if (!stress_level) {
			inventoryLogger.error("Stress level is required");
			res.status(400).json({
				error: "Stress level is required",
			});
			return;
		}

		if (!academic_performance_change) {
			inventoryLogger.error("Academic performance change is required");
			res.status(400).json({
				error: "Academic performance change is required",
			});
			return;
		}

		// Validate enum values
		if (!Object.values(StressLevel).includes(stress_level)) {
			inventoryLogger.error(`Invalid stress level: ${stress_level}`);
			res.status(400).json({
				error: `Invalid stress level. Must be one of: ${Object.values(StressLevel).join(", ")}`,
			});
			return;
		}

		if (!Object.values(PerformanceChange).includes(academic_performance_change)) {
			inventoryLogger.error(`Invalid performance change: ${academic_performance_change}`);
			res.status(400).json({
				error: `Invalid performance change. Must be one of: ${Object.values(PerformanceChange).join(", ")}`,
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

			// Sanitize data to handle empty strings for DateTime fields
			const sanitizedData = {
				height,
				weight,
				coplexion,
				person_to_be_contacted_in_case_of_accident_or_illness,
				educational_background: {
					...educational_background,
					dates_of_attendance: educational_background?.dates_of_attendance || new Date(),
				},
				nature_of_schooling,
				home_and_family_background,
				health: health
					? {
							...health,
							psychological: health.psychological
								? {
										...health.psychological,
										when:
											health.psychological.when === ""
												? null
												: health.psychological.when,
									}
								: health.psychological,
						}
					: health,
				interest_and_hobbies,
				// Optional composite: test_results
				...(test_results &&
					(test_results.name_of_test ||
						test_results.rs ||
						test_results.pr ||
						test_results.description ||
						test_results.date) && {
						test_results: {
							set: {
								...test_results,
								date: test_results.date === "" ? null : (test_results.date ?? null),
							},
						},
					}),
				// Optional composite: significant_notes_councilor_only
				...(significant_notes_councilor_only &&
					(significant_notes_councilor_only.incident ||
						significant_notes_councilor_only.remarks ||
						significant_notes_councilor_only.date) && {
						significant_notes_councilor_only: {
							set: {
								...significant_notes_councilor_only,
								date:
									significant_notes_councilor_only.date === ""
										? null
										: (significant_notes_councilor_only.date ?? null),
							},
						},
					}),
				sleep_duration,
				stress_level,
				academic_performance_change,
				student_signature,
			};

			const inventory = await prisma.individualInventory.create({
				data: {
					...sanitizedData,
					student: {
						connect: { id: studentId },
					},
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

			// Automatically run mental health prediction after inventory creation
			try {
				// Prepare data for prediction using inventory data and student info
				const studentData: Partial<StudentData> = {
					gender: inventory.student?.person?.gender
						? inventory.student.person.gender.charAt(0).toUpperCase() +
							inventory.student.person.gender.slice(1)
						: "Other",
					age: inventory.student?.person?.age || 20,
					educationLevel: inventory.student?.program || "None",
					sleepDuration: parseFloat(sleep_duration) || 7,
					stressLevel:
						stress_level === StressLevel.low
							? "Low"
							: stress_level === StressLevel.medium
								? "Medium"
								: stress_level === StressLevel.high
									? "High"
									: "Medium",
					parentsMaritalRelationship:
						inventory.home_and_family_background?.parents_martial_relationship ||
						"others",
					whoFinancesYourSchooling:
						inventory.home_and_family_background?.who_finances_your_schooling ||
						"parents",
					parentsTotalMonthlyIncome:
						inventory.home_and_family_background?.parents_total_montly_income?.income ||
						"below_five_thousand",
				};

				// Call the mental health predictor
				const prediction = await mentalHealthPredictor.predictMentalHealthRisk(studentData);

				inventoryLogger.info(
					`Mental health prediction for new inventory ${inventory.id}: ${prediction.prediction} (confidence: ${prediction.confidence})`,
				);

				// Return inventory data with prediction results
				res.status(201).json({
					message:
						"Individual inventory created successfully with mental health prediction",
					disclaimer:
						"⚠️ IMPORTANT NOTICE: This mental health prediction is for screening purposes only and should not be considered a professional diagnosis. For accurate mental health assessment, please utilize our comprehensive resources and consult with qualified mental health professionals.",
					inventory,
					mentalHealthPrediction: {
						academicPerformanceOutlook: prediction.prediction,
						confidence: `${(prediction.confidence * 100).toFixed(1)}%`,
						modelAccuracy: {
							decisionTree: `${(prediction.modelAccuracy.decisionTree * 100).toFixed(1)}%`,
							randomForest: `${(prediction.modelAccuracy.randomForest * 100).toFixed(1)}%`,
						},
						riskFactors: prediction.riskFactors,
						mentalHealthRisk: {
							level: prediction.mentalHealthRisk.level,
							description: prediction.mentalHealthRisk.description,
							needsAttention: prediction.mentalHealthRisk.needsAttention,
							urgency: prediction.mentalHealthRisk.urgency,
							assessmentSummary: prediction.mentalHealthRisk.needsAttention
								? `⚠️ ATTENTION NEEDED: ${prediction.mentalHealthRisk.description}`
								: `✅ LOW RISK: ${prediction.mentalHealthRisk.description}`,
							disclaimer:
								"⚠️ IMPORTANT: This is only a prediction based on preliminary data. If you want to determine if you really have mental health issues, please continue to answer our comprehensive resources available for professional mental health assessments.",
						},
						inputData: studentData,
						recommendations: generateRecommendations(prediction),
					},
				});
			} catch (predictionError) {
				// If prediction fails, still return successful inventory creation
				inventoryLogger.warn(
					`Mental health prediction failed for inventory ${inventory.id}: ${predictionError}`,
				);

				res.status(201).json({
					message:
						"Individual inventory created successfully (mental health prediction unavailable)",
					inventory,
					mentalHealthPrediction: {
						error: "Prediction service temporarily unavailable",
						note: "Inventory was created successfully, but mental health prediction could not be generated at this time.",
					},
				});
			}
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
			sleep_duration,
			stress_level,
			academic_performance_change,
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

		// Validate enum values if provided
		if (stress_level && !Object.values(StressLevel).includes(stress_level)) {
			inventoryLogger.error(`Invalid stress level: ${stress_level}`);
			res.status(400).json({
				error: `Invalid stress level. Must be one of: ${Object.values(StressLevel).join(", ")}`,
			});
			return;
		}

		if (
			academic_performance_change &&
			!Object.values(PerformanceChange).includes(academic_performance_change)
		) {
			inventoryLogger.error(`Invalid performance change: ${academic_performance_change}`);
			res.status(400).json({
				error: `Invalid performance change. Must be one of: ${Object.values(PerformanceChange).join(", ")}`,
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
					...(educational_background && {
						educational_background: {
							...educational_background,
							dates_of_attendance:
								educational_background.dates_of_attendance || new Date(),
						},
					}),
					...(nature_of_schooling && { nature_of_schooling }),
					...(home_and_family_background && { home_and_family_background }),
					...(health && {
						health: {
							...health,
							psychological: health.psychological
								? {
										...health.psychological,
										when:
											health.psychological.when === ""
												? null
												: health.psychological.when,
									}
								: health.psychological,
						},
					}),
					...(interest_and_hobbies && { interest_and_hobbies }),
					...(test_results &&
						(test_results.name_of_test ||
							test_results.rs ||
							test_results.pr ||
							test_results.description ||
							test_results.date) && {
							test_results: {
								set: {
									...test_results,
									date:
										test_results.date === ""
											? null
											: (test_results.date ?? null),
								},
							},
						}),
					...(significant_notes_councilor_only &&
						(significant_notes_councilor_only.incident ||
							significant_notes_councilor_only.remarks ||
							significant_notes_councilor_only.date) && {
							significant_notes_councilor_only: {
								set: {
									...significant_notes_councilor_only,
									date:
										significant_notes_councilor_only.date === ""
											? null
											: (significant_notes_councilor_only.date ?? null),
								},
							},
						}),
					...(student_signature && { student_signature }),
					...(sleep_duration && { sleep_duration }),
					...(stress_level && { stress_level }),
					...(academic_performance_change && { academic_performance_change }),
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

	const predictMentalHealth = async (req: Request, res: Response, _next: NextFunction) => {
		const { studentId } = req.params;
		const {
			gender,
			age,
			educationLevel,
			sleepDuration,
			stressLevel,
			parentsMaritalRelationship,
			whoFinancesYourSchooling,
			parentsTotalMonthlyIncome,
		} = req.body;

		if (!studentId) {
			inventoryLogger.error(config.ERROR.INVENTORY.STUDENT_ID_REQUIRED);
			res.status(400).json({
				error: config.ERROR.INVENTORY.STUDENT_ID_REQUIRED,
			});
			return;
		}

		try {
			// Get student information with person details and inventory data to enhance prediction
			const student = await prisma.student.findFirst({
				where: {
					id: studentId,
					isDeleted: false,
				},
				include: {
					person: true,
					individualInventory: true,
				},
			});

			if (!student) {
				inventoryLogger.error(`Student not found: ${studentId}`);
				res.status(404).json({ error: "Student not found" });
				return;
			}

			// Check if inventory exists for this student
			const existingInventory = await prisma.individualInventory.findFirst({
				where: {
					studentId,
					isDeleted: false,
				},
			});

			if (!existingInventory) {
				inventoryLogger.error(`Individual inventory not found for student: ${studentId}`);
				res.status(404).json({ error: "Individual inventory not found for this student" });
				return;
			}

			// Prepare data for prediction using body data, inventory data, or defaults from student record
			const studentData: Partial<StudentData> = {
				gender:
					gender ||
					(student.person?.gender
						? student.person.gender.charAt(0).toUpperCase() +
							student.person.gender.slice(1)
						: "Other"),
				age: age || student.person?.age || 20,
				educationLevel: educationLevel || student.program || "None",
				sleepDuration: sleepDuration || parseFloat(existingInventory.sleep_duration) || 7,
				stressLevel:
					stressLevel ||
					(existingInventory.stress_level === StressLevel.low
						? "Low"
						: existingInventory.stress_level === StressLevel.medium
							? "Medium"
							: existingInventory.stress_level === StressLevel.high
								? "High"
								: "Medium"),
				parentsMaritalRelationship:
					parentsMaritalRelationship ||
					existingInventory.home_and_family_background?.parents_martial_relationship ||
					"others",
				whoFinancesYourSchooling:
					whoFinancesYourSchooling ||
					existingInventory.home_and_family_background?.who_finances_your_schooling ||
					"parents",
				parentsTotalMonthlyIncome:
					parentsTotalMonthlyIncome ||
					existingInventory.home_and_family_background?.parents_total_montly_income
						?.income ||
					"below_five_thousand",
			};

			// Validate input data
			if (studentData.age && (studentData.age < 10 || studentData.age > 100)) {
				inventoryLogger.error(`Invalid age: ${studentData.age}`);
				res.status(400).json({ error: "Age must be between 10 and 100" });
				return;
			}

			if (
				studentData.sleepDuration &&
				(studentData.sleepDuration < 0 || studentData.sleepDuration > 24)
			) {
				inventoryLogger.error(`Invalid sleep duration: ${studentData.sleepDuration}`);
				res.status(400).json({ error: "Sleep duration must be between 0 and 24 hours" });
				return;
			}

			const validStressLevels = ["Low", "Medium", "High"];
			if (studentData.stressLevel && !validStressLevels.includes(studentData.stressLevel)) {
				inventoryLogger.error(`Invalid stress level: ${studentData.stressLevel}`);
				res.status(400).json({
					error: "Stress level must be one of: Low, Medium, High",
				});
				return;
			}

			// Call the mental health predictor
			const prediction = await mentalHealthPredictor.predictMentalHealthRisk(studentData);

			inventoryLogger.info(
				`Mental health prediction for student ${studentId}: ${prediction.prediction} (confidence: ${prediction.confidence})`,
			);

			res.status(200).json({
				message: "Mental health prediction completed successfully",
				disclaimer:
					"⚠️ IMPORTANT NOTICE: This mental health prediction is for screening purposes only and should not be considered a professional diagnosis. For accurate mental health assessment, please utilize our comprehensive resources and consult with qualified mental health professionals.",
				studentId,
				prediction: {
					academicPerformanceOutlook: prediction.prediction,
					confidence: `${(prediction.confidence * 100).toFixed(1)}%`,
					modelAccuracy: {
						decisionTree: `${(prediction.modelAccuracy.decisionTree * 100).toFixed(1)}%`,
						randomForest: `${(prediction.modelAccuracy.randomForest * 100).toFixed(1)}%`,
					},
					riskFactors: prediction.riskFactors,
					mentalHealthRisk: {
						level: prediction.mentalHealthRisk.level,
						description: prediction.mentalHealthRisk.description,
						needsAttention: prediction.mentalHealthRisk.needsAttention,
						urgency: prediction.mentalHealthRisk.urgency,
						assessmentSummary: prediction.mentalHealthRisk.needsAttention
							? `⚠️ ATTENTION NEEDED: ${prediction.mentalHealthRisk.description}`
							: `✅ LOW RISK: ${prediction.mentalHealthRisk.description}`,
						disclaimer:
							"⚠️ IMPORTANT: This is only a prediction based on preliminary data. If you want to determine if you really have mental health issues, please continue to answer our comprehensive resources available for professional mental health assessments.",
					},
					inputData: studentData,
					recommendations: generateRecommendations(prediction),
				},
			});
		} catch (error) {
			inventoryLogger.error(
				`Error predicting mental health for student ${studentId}: ${error}`,
			);
			res.status(500).json({
				error: "An error occurred while predicting mental health. Please try again later.",
			});
		}
	};

	const generateRecommendations = (prediction: any): string[] => {
		const recommendations: string[] = [];

		if (prediction.prediction === "Declined") {
			recommendations.push(
				"Consider scheduling a consultation with a mental health professional",
			);
			recommendations.push(
				"Implement stress reduction techniques such as meditation or deep breathing exercises",
			);
			recommendations.push("Establish a consistent sleep schedule");
			recommendations.push("Engage in regular physical activity");
		} else if (prediction.prediction === "Same") {
			recommendations.push("Maintain current healthy habits");
			recommendations.push("Monitor stress levels regularly");
			recommendations.push("Continue with regular sleep pattern");
		} else {
			recommendations.push("Continue with current positive practices");
			recommendations.push("Consider sharing successful strategies with peers");
			recommendations.push("Maintain work-life balance");
		}

		// Add specific recommendations based on risk factors
		if (prediction.riskFactors.some((factor: string) => factor.includes("sleep"))) {
			recommendations.push(
				"Focus on improving sleep hygiene and maintaining 7-9 hours of sleep per night",
			);
		}

		if (prediction.riskFactors.some((factor: string) => factor.includes("stress"))) {
			recommendations.push(
				"Implement stress management techniques and consider counseling services",
			);
		}

		return recommendations;
	};

	return {
		getById,
		getByStudentId,
		getAll,
		create,
		update,
		remove,
		predictMentalHealth,
	};
};
