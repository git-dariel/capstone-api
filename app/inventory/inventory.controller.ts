import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/error.config";
import { mentalHealthPredictor, StudentData } from "../../helper/ml.helper";
import { createNotificationHelper } from "../../helper/notification.helper";

const logger = getLogger();
const inventoryLogger = logger.child({ module: "inventory" });

export const controller = (prisma: PrismaClient) => {
	const notificationHelper = createNotificationHelper(prisma);
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

			const inventory = await prisma.individualInventory.findFirst({
				...query,
				include: {
					student: {
						include: {
							person: true,
						},
					},
				},
			});

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

			const inventory = await prisma.individualInventory.findFirst({
				...query,
				include: {
					student: {
						include: {
							person: true,
						},
					},
				},
			});

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

		// Note: sleep_duration, stress_level, and academic_performance_change are no longer part of IIF validation

		// Note: Individual Inventory Form validation is handled by Prisma schema constraints

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
				// Note: sleep_duration, stress_level, and academic_performance_change removed from IIF
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

			// Create notification for inventory creation
			try {
				await notificationHelper.createInventoryNotification(
					"CREATED",
					inventory.studentId,
					inventory.id,
					{
						height: inventory.height,
						weight: inventory.weight,
						studentName: inventory.student?.person
							? `${inventory.student.person.firstName} ${inventory.student.person.lastName}`
							: "Unknown Student",
					},
				);
			} catch (notificationError) {
				inventoryLogger.warn(
					`Failed to create inventory notification: ${notificationError}`,
				);
			}

			// Automatically run mental health prediction after inventory creation
			try {
				// Prepare data for prediction using inventory data and student info
				const studentData: Partial<StudentData> = {
					gender: inventory.student?.person?.gender
						? inventory.student.person.gender.charAt(0).toUpperCase() +
							inventory.student.person.gender.slice(1)
						: "Other",
					age: inventory.student?.person?.age || 20,
					// Educational background from inventory
					highSchoolAverage:
						parseFloat(inventory.educational_background?.honors_received || "85") || 85,
					natureOfSchooling: inventory.nature_of_schooling?.continuous
						? "continuous"
						: "interrupted",
					// Home and family background
					parentsMaritalRelationship:
						inventory.home_and_family_background?.parents_martial_relationship ||
						"others",
					numberOfChildren:
						inventory.home_and_family_background
							?.number_of_children_in_the_family_including_yourself || 1,
					ordinalPosition:
						inventory.home_and_family_background?.ordinal_position || "1st child",
					whoFinancesYourSchooling:
						inventory.home_and_family_background?.who_finances_your_schooling ||
						"parents",
					parentsTotalMonthlyIncome:
						inventory.home_and_family_background?.parents_total_montly_income?.income ||
						"below_five_thousand",
					quietPlaceToStudy:
						inventory.home_and_family_background?.do_you_have_quiet_place_to_study ===
						"yes"
							? "yes"
							: "no",
					natureOfResidence:
						inventory.home_and_family_background
							?.nature_of_residence_while_attending_school || "family_home",
					// Health status
					visionProblems: inventory.health?.physical?.your_vision ? "yes" : "no",
					generalHealthProblems: inventory.health?.physical?.your_general_health
						? "yes"
						: "no",
					psychologicalConsultation:
						inventory.health?.psychological?.status === "yes" ? "yes" : "no",
					// Interest and hobbies
					favoriteSubject: inventory.interest_and_hobbies?.favorite_subject || "Math",
					leastFavoriteSubject:
						inventory.interest_and_hobbies?.favorite_least_subject || "Math",
					academicOrganizations:
						inventory.interest_and_hobbies?.academic === "match_club"
							? "math_club"
							: inventory.interest_and_hobbies?.academic === "debating_club"
								? "debating_club"
								: inventory.interest_and_hobbies?.academic === "science_club"
									? "science_club"
									: inventory.interest_and_hobbies?.academic === "quizzers_club"
										? "quizzers_club"
										: "none",
					organizationPosition:
						inventory.interest_and_hobbies?.occupational_position_organization ===
						"officer"
							? "officer"
							: "member",
				};

				// Call the mental health predictor
				const prediction = await mentalHealthPredictor.predictMentalHealthRisk(studentData);

				inventoryLogger.info(
					`Mental health prediction for new inventory ${inventory.id}: ${prediction.prediction} (confidence: ${prediction.confidence})`,
				);

				// Prepare prediction data for storage
				const predictionData = {
					academicPerformanceOutlook: prediction.prediction.toLowerCase() as
						| "improved"
						| "same"
						| "declined",
					confidence: prediction.confidence,
					modelAccuracy: {
						decisionTree: prediction.modelAccuracy.decisionTree,
						randomForest: prediction.modelAccuracy.randomForest,
					},
					riskFactors: prediction.riskFactors,
					mentalHealthRisk: {
						level: prediction.mentalHealthRisk.level.toLowerCase() as
							| "low"
							| "moderate"
							| "high"
							| "critical",
						description: prediction.mentalHealthRisk.description,
						needsAttention: prediction.mentalHealthRisk.needsAttention,
						urgency: prediction.mentalHealthRisk.urgency.toLowerCase() as
							| "none"
							| "monitor"
							| "schedule"
							| "immediate",
						assessmentSummary: prediction.mentalHealthRisk.needsAttention
							? `⚠️ ATTENTION NEEDED: ${prediction.mentalHealthRisk.description}`
							: `✅ LOW RISK: ${prediction.mentalHealthRisk.description}`,
						disclaimer:
							"⚠️ IMPORTANT: This is only a prediction based on preliminary data. If you want to determine if you really have mental health issues, please continue to answer our comprehensive resources available for professional mental health assessments.",
					},
					inputData: studentData,
					recommendations: generateRecommendations(prediction),
					predictionDate: new Date(),
				};

				// Update inventory with prediction results
				const updatedInventory = await prisma.individualInventory.update({
					where: { id: inventory.id },
					data: {
						mentalHealthPrediction: predictionData,
						predictionGenerated: true,
						predictionUpdatedAt: new Date(),
					},
					include: {
						student: {
							include: {
								person: true,
							},
						},
					},
				});

				// Return inventory data with prediction results
				res.status(201).json({
					message:
						"Individual inventory created successfully with mental health prediction",
					disclaimer:
						"⚠️ IMPORTANT NOTICE: This mental health prediction is for screening purposes only and should not be considered a professional diagnosis. For accurate mental health assessment, please utilize our comprehensive resources and consult with qualified mental health professionals.",
					inventory: updatedInventory,
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

		// Note: Individual Inventory Form validation is handled by Prisma schema constraints

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

			// Create notification for inventory update
			try {
				await notificationHelper.createInventoryNotification(
					"UPDATED",
					updatedInventory.studentId,
					updatedInventory.id,
					{
						height: updatedInventory.height,
						weight: updatedInventory.weight,
						studentName: updatedInventory.student?.person
							? `${updatedInventory.student.person.firstName} ${updatedInventory.student.person.lastName}`
							: "Unknown Student",
					},
				);
			} catch (notificationError) {
				inventoryLogger.warn(
					`Failed to create inventory update notification: ${notificationError}`,
				);
			}

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
			highSchoolAverage,
			natureOfSchooling,
			parentsMaritalRelationship,
			numberOfChildren,
			ordinalPosition,
			whoFinancesYourSchooling,
			parentsTotalMonthlyIncome,
			quietPlaceToStudy,
			natureOfResidence,
			visionProblems,
			generalHealthProblems,
			psychologicalConsultation,
			favoriteSubject,
			leastFavoriteSubject,
			academicOrganizations,
			organizationPosition,
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
				// Educational background from inventory or request body
				highSchoolAverage:
					highSchoolAverage ||
					parseFloat(existingInventory.educational_background?.honors_received || "85") ||
					85,
				natureOfSchooling:
					natureOfSchooling ||
					(existingInventory.nature_of_schooling?.continuous
						? "continuous"
						: "interrupted"),
				// Home and family background
				parentsMaritalRelationship:
					parentsMaritalRelationship ||
					existingInventory.home_and_family_background?.parents_martial_relationship ||
					"others",
				numberOfChildren:
					numberOfChildren ||
					existingInventory.home_and_family_background
						?.number_of_children_in_the_family_including_yourself ||
					1,
				ordinalPosition:
					ordinalPosition ||
					existingInventory.home_and_family_background?.ordinal_position ||
					"1st child",
				whoFinancesYourSchooling:
					whoFinancesYourSchooling ||
					existingInventory.home_and_family_background?.who_finances_your_schooling ||
					"parents",
				parentsTotalMonthlyIncome:
					parentsTotalMonthlyIncome ||
					existingInventory.home_and_family_background?.parents_total_montly_income
						?.income ||
					"below_five_thousand",
				quietPlaceToStudy:
					quietPlaceToStudy ||
					(existingInventory.home_and_family_background
						?.do_you_have_quiet_place_to_study === "yes"
						? "yes"
						: "no"),
				natureOfResidence:
					natureOfResidence ||
					existingInventory.home_and_family_background
						?.nature_of_residence_while_attending_school ||
					"family_home",
				// Health status
				visionProblems:
					visionProblems ||
					(existingInventory.health?.physical?.your_vision ? "yes" : "no"),
				generalHealthProblems:
					generalHealthProblems ||
					(existingInventory.health?.physical?.your_general_health ? "yes" : "no"),
				psychologicalConsultation:
					psychologicalConsultation ||
					(existingInventory.health?.psychological?.status === "yes" ? "yes" : "no"),
				// Interest and hobbies
				favoriteSubject:
					favoriteSubject ||
					existingInventory.interest_and_hobbies?.favorite_subject ||
					"Math",
				leastFavoriteSubject:
					leastFavoriteSubject ||
					existingInventory.interest_and_hobbies?.favorite_least_subject ||
					"Math",
				academicOrganizations:
					academicOrganizations ||
					(existingInventory.interest_and_hobbies?.academic === "match_club"
						? "math_club"
						: existingInventory.interest_and_hobbies?.academic === "debating_club"
							? "debating_club"
							: existingInventory.interest_and_hobbies?.academic === "science_club"
								? "science_club"
								: existingInventory.interest_and_hobbies?.academic ===
									  "quizzers_club"
									? "quizzers_club"
									: "none"),
				organizationPosition:
					organizationPosition ||
					(existingInventory.interest_and_hobbies?.occupational_position_organization ===
					"officer"
						? "officer"
						: "member"),
			};

			// Validate input data
			if (studentData.age && (studentData.age < 10 || studentData.age > 100)) {
				inventoryLogger.error(`Invalid age: ${studentData.age}`);
				res.status(400).json({ error: "Age must be between 10 and 100" });
				return;
			}

			if (
				studentData.highSchoolAverage &&
				(studentData.highSchoolAverage < 60 || studentData.highSchoolAverage > 100)
			) {
				inventoryLogger.error(
					`Invalid high school average: ${studentData.highSchoolAverage}`,
				);
				res.status(400).json({ error: "High school average must be between 60 and 100" });
				return;
			}

			const validSchoolingTypes = ["continuous", "interrupted"];
			if (
				studentData.natureOfSchooling &&
				!validSchoolingTypes.includes(studentData.natureOfSchooling)
			) {
				inventoryLogger.error(
					`Invalid nature of schooling: ${studentData.natureOfSchooling}`,
				);
				res.status(400).json({
					error: "Nature of schooling must be one of: continuous, interrupted",
				});
				return;
			}

			if (
				studentData.numberOfChildren &&
				(studentData.numberOfChildren < 1 || studentData.numberOfChildren > 20)
			) {
				inventoryLogger.error(
					`Invalid number of children: ${studentData.numberOfChildren}`,
				);
				res.status(400).json({ error: "Number of children must be between 1 and 20" });
				return;
			}

			// Call the mental health predictor
			const prediction = await mentalHealthPredictor.predictMentalHealthRisk(studentData);

			inventoryLogger.info(
				`Mental health prediction for student ${studentId}: ${prediction.prediction} (confidence: ${prediction.confidence})`,
			);

			// Prepare prediction data for storage
			const predictionData = {
				academicPerformanceOutlook: prediction.prediction.toLowerCase() as
					| "improved"
					| "same"
					| "declined",
				confidence: prediction.confidence,
				modelAccuracy: {
					decisionTree: prediction.modelAccuracy.decisionTree,
					randomForest: prediction.modelAccuracy.randomForest,
				},
				riskFactors: prediction.riskFactors,
				mentalHealthRisk: {
					level: prediction.mentalHealthRisk.level.toLowerCase() as
						| "low"
						| "moderate"
						| "high"
						| "critical",
					description: prediction.mentalHealthRisk.description,
					needsAttention: prediction.mentalHealthRisk.needsAttention,
					urgency: prediction.mentalHealthRisk.urgency.toLowerCase() as
						| "none"
						| "monitor"
						| "schedule"
						| "immediate",
					assessmentSummary: prediction.mentalHealthRisk.needsAttention
						? `⚠️ ATTENTION NEEDED: ${prediction.mentalHealthRisk.description}`
						: `✅ LOW RISK: ${prediction.mentalHealthRisk.description}`,
					disclaimer:
						"⚠️ IMPORTANT: This is only a prediction based on preliminary data. If you want to determine if you really have mental health issues, please continue to answer our comprehensive resources available for professional mental health assessments.",
				},
				inputData: studentData,
				recommendations: generateRecommendations(prediction),
				predictionDate: new Date(),
			};

			// Update existing inventory with new prediction results
			const updatedInventory = await prisma.individualInventory.update({
				where: { id: existingInventory.id },
				data: {
					mentalHealthPrediction: predictionData,
					predictionGenerated: true,
					predictionUpdatedAt: new Date(),
				},
				include: {
					student: {
						include: {
							person: true,
						},
					},
				},
			});

			res.status(200).json({
				message: "Mental health prediction completed successfully",
				disclaimer:
					"⚠️ IMPORTANT NOTICE: This mental health prediction is for screening purposes only and should not be considered a professional diagnosis. For accurate mental health assessment, please utilize our comprehensive resources and consult with qualified mental health professionals.",
				studentId,
				inventory: updatedInventory,
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

		// Base recommendations based on academic performance prediction
		if (prediction.prediction === "Declined") {
			recommendations.push(
				"Schedule a consultation with an academic counselor to develop a personalized study plan",
			);
			recommendations.push("Consider tutoring or additional academic support services");
			recommendations.push("Evaluate and improve study environment and habits");
			recommendations.push("Explore stress management and time management techniques");
		} else if (prediction.prediction === "Same") {
			recommendations.push("Maintain current academic practices and study habits");
			recommendations.push("Continue regular monitoring of academic progress");
			recommendations.push("Consider gradual improvements to study techniques");
			recommendations.push("Stay engaged with academic support services");
		} else {
			recommendations.push("Continue with current successful academic strategies");
			recommendations.push("Consider peer tutoring or mentoring opportunities");
			recommendations.push("Maintain balanced approach to academics and personal well-being");
			recommendations.push("Share successful study techniques with fellow students");
		}

		// Add specific recommendations based on IIF risk factors
		if (
			prediction.riskFactors.some((factor: string) => factor.includes("academic performance"))
		) {
			recommendations.push(
				"Focus on academic skill building and seek subject-specific tutoring",
			);
		}

		if (
			prediction.riskFactors.some((factor: string) =>
				factor.includes("interrupted schooling"),
			)
		) {
			recommendations.push("Work with academic advisors to address any educational gaps");
		}

		if (
			prediction.riskFactors.some((factor: string) =>
				factor.includes("financial constraints"),
			)
		) {
			recommendations.push(
				"Explore financial aid, scholarships, and student support programs",
			);
		}

		if (prediction.riskFactors.some((factor: string) => factor.includes("study environment"))) {
			recommendations.push(
				"Identify and utilize quiet study spaces on campus or in the library",
			);
		}

		if (
			prediction.riskFactors.some((factor: string) => factor.includes("housing instability"))
		) {
			recommendations.push(
				"Connect with student housing services for stable accommodation options",
			);
		}

		if (prediction.riskFactors.some((factor: string) => factor.includes("health challenges"))) {
			recommendations.push(
				"Utilize campus health services and seek appropriate medical support",
			);
		}

		if (
			prediction.riskFactors.some((factor: string) =>
				factor.includes("psychological consultation"),
			)
		) {
			recommendations.push(
				"Continue or establish regular check-ins with mental health professionals",
			);
		}

		if (prediction.riskFactors.some((factor: string) => factor.includes("social engagement"))) {
			recommendations.push("Join academic clubs, study groups, or student organizations");
		}

		if (prediction.riskFactors.some((factor: string) => factor.includes("family structure"))) {
			recommendations.push(
				"Consider family counseling resources and develop strong support networks",
			);
		}

		if (prediction.riskFactors.some((factor: string) => factor.includes("large family"))) {
			recommendations.push(
				"Develop time management skills to balance family and academic responsibilities",
			);
		}

		return recommendations;
	};

	const getPredictionByStudentId = async (req: Request, res: Response, _next: NextFunction) => {
		const { studentId } = req.params;

		if (!studentId) {
			inventoryLogger.error("Student ID is required");
			res.status(400).json({ error: "Student ID is required" });
			return;
		}

		inventoryLogger.info(`Getting prediction data for student ID: ${studentId}`);

		try {
			const inventory = await prisma.individualInventory.findFirst({
				where: {
					studentId,
					isDeleted: false,
					predictionGenerated: true,
				},
				select: {
					id: true,
					studentId: true,
					mentalHealthPrediction: true,
					predictionGenerated: true,
					predictionUpdatedAt: true,
					student: {
						select: {
							studentNumber: true,
							program: true,
							person: {
								select: {
									firstName: true,
									lastName: true,
									middleName: true,
								},
							},
						},
					},
				},
			});

			if (!inventory) {
				inventoryLogger.info(`No prediction data found for student ID: ${studentId}`);
				res.status(404).json({
					error: "Mental health prediction not found for this student",
					message:
						"This student either doesn't have an inventory or hasn't generated a prediction yet",
				});
				return;
			}

			inventoryLogger.info(`Prediction data retrieved for student: ${inventory.id}`);
			res.status(200).json({
				message: "Mental health prediction retrieved successfully",
				studentId,
				studentInfo: {
					studentNumber: inventory.student?.studentNumber,
					program: inventory.student?.program,
					name: `${inventory.student?.person?.firstName || ""} ${inventory.student?.person?.lastName || ""}`.trim(),
				},
				prediction: inventory.mentalHealthPrediction,
				predictionGenerated: inventory.predictionGenerated,
				predictionUpdatedAt: inventory.predictionUpdatedAt,
			});
		} catch (error) {
			inventoryLogger.error(`Error getting prediction for student ID: ${error}`);
			res.status(500).json({ error: config.ERROR.INVENTORY.INTERNAL_SERVER_ERROR });
		}
	};

	return {
		getById,
		getByStudentId,
		getAll,
		create,
		update,
		remove,
		predictMentalHealth,
		getPredictionByStudentId,
	};
};
