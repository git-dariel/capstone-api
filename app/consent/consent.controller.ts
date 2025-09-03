import { NextFunction, Request, Response } from "express";
import { config } from "../../config/error.config";
import {
	Financial,
	Live,
	PerformanceChange,
	PhysicalProblem,
	PhysicalSymptoms,
	Prisma,
	PrismaClient,
	Referred,
	Services,
	StressLevel,
} from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { mentalHealthPredictor, StudentData } from "../../helper/ml.helper";

const logger = getLogger();
const consentLogger = logger.child({ module: "consent" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		if (!id) {
			consentLogger.error(config.ERROR.CONSENT.MISSING_ID);
			res.status(400).json({ error: config.ERROR.CONSENT.MISSING_ID });
			return;
		}

		if (fields && typeof fields !== "string") {
			consentLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.CONSENT.POPULATE_MUST_BE_STRING });
			return;
		}

		consentLogger.info(`${config.SUCCESS.CONSENT.GETTING_BY_ID}: ${id}`);

		try {
			const query: Prisma.ConsentFindFirstArgs = {
				where: {
					id,
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
			} else {
				// Default include student with person when no specific fields are requested
				query.include = {
					student: {
						include: {
							person: true,
						},
					},
				};
			}

			const consent = await prisma.consent.findFirst(query);

			if (!consent) {
				consentLogger.error(`${config.ERROR.CONSENT.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.CONSENT.NOT_FOUND });
				return;
			}

			consentLogger.info(`${config.SUCCESS.CONSENT.RETRIEVED}: ${consent.id}`);
			res.status(200).json(consent);
		} catch (error) {
			consentLogger.error(`${config.ERROR.CONSENT.ERROR_GETTING_CONSENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.CONSENT.INTERNAL_SERVER_ERROR });
		}
	};

	const getByStudentId = async (req: Request, res: Response, _next: NextFunction) => {
		const { studentId } = req.params;
		const { fields } = req.query;

		if (!studentId) {
			consentLogger.error(config.ERROR.CONSENT.STUDENT_ID_REQUIRED);
			res.status(400).json({ error: config.ERROR.CONSENT.STUDENT_ID_REQUIRED });
			return;
		}

		if (fields && typeof fields !== "string") {
			consentLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.CONSENT.POPULATE_MUST_BE_STRING });
			return;
		}

		consentLogger.info(`Getting consent by student ID: ${studentId}`);

		try {
			const query: Prisma.ConsentFindFirstArgs = {
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
			} else {
				// Default include student with person when no specific fields are requested
				query.include = {
					student: {
						include: {
							person: true,
						},
					},
				};
			}

			const consent = await prisma.consent.findFirst(query);

			if (!consent) {
				consentLogger.error(`Consent not found for student: ${studentId}`);
				res.status(404).json({ error: config.ERROR.CONSENT.NOT_FOUND });
				return;
			}

			consentLogger.info(`${config.SUCCESS.CONSENT.RETRIEVED}: ${consent.id}`);
			res.status(200).json(consent);
		} catch (error) {
			consentLogger.error(`${config.ERROR.CONSENT.ERROR_GETTING_CONSENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.CONSENT.INTERNAL_SERVER_ERROR });
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		const { page = 1, limit = 10, sort, fields, query, order = "desc" } = req.query;

		if (isNaN(Number(page)) || Number(page) < 1) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_PAGE}: ${page}`);
			res.status(400).json({ error: config.ERROR.CONSENT.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_LIMIT}: ${limit}`);
			res.status(400).json({ error: config.ERROR.CONSENT.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_ORDER}: ${order}`);
			res.status(400).json({ error: config.ERROR.CONSENT.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			consentLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.CONSENT.POPULATE_MUST_BE_STRING });
			return;
		}

		const skip = (Number(page) - 1) * Number(limit);

		consentLogger.info(
			`${config.SUCCESS.CONSENT.GETTING_ALL}, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
		);

		try {
			const whereClause: Prisma.ConsentWhereInput = {
				isDeleted: false,
				student: {
					isDeleted: false,
				},
				...(query
					? {
							OR: [
								{ student: { studentNumber: { contains: String(query) } } },
								{ student: { person: { firstName: { contains: String(query) } } } },
								{ student: { person: { lastName: { contains: String(query) } } } },
								{ what_brings_you_to_guidance: { contains: String(query) } },
								{ sleep_duration: { contains: String(query) } },
							],
						}
					: {}),
			};

			const findManyQuery: Prisma.ConsentFindManyArgs = {
				where: whereClause,
				skip,
				take: Number(limit),
				orderBy: sort
					? typeof sort === "string" && !sort.startsWith("{")
						? { [sort as string]: order }
						: JSON.parse(sort as string)
					: { createdAt: order as Prisma.SortOrder },
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
				// Default include student with person when no specific fields are requested
				findManyQuery.include = {
					student: {
						include: {
							person: true,
						},
					},
				};
			}

			const [consents, total] = await Promise.all([
				prisma.consent.findMany(findManyQuery),
				prisma.consent.count({ where: whereClause }),
			]);

			consentLogger.info(`Retrieved ${consents.length} consents`);
			res.status(200).json({
				consents,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			consentLogger.error(`${config.ERROR.CONSENT.ERROR_GETTING_CONSENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.CONSENT.INTERNAL_SERVER_ERROR });
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		const {
			studentId,
			referred,
			with_whom_do_you_live,
			financial_status,
			what_brings_you_to_guidance,
			physical_problem,
			physical_symptoms,
			concerns,
			services,
			sleep_duration,
			stress_level,
			academic_performance_change,
		} = req.body;

		if (!studentId) {
			consentLogger.error(config.ERROR.CONSENT.STUDENT_ID_REQUIRED);
			res.status(400).json({
				error: config.ERROR.CONSENT.STUDENT_ID_REQUIRED,
			});
			return;
		}

		if (!financial_status) {
			consentLogger.error("Financial status is required");
			res.status(400).json({
				error: "Financial status is required",
			});
			return;
		}

		if (!physical_problem) {
			consentLogger.error("Physical problem status is required");
			res.status(400).json({
				error: "Physical problem status is required",
			});
			return;
		}

		if (!physical_symptoms) {
			consentLogger.error("Physical symptoms is required");
			res.status(400).json({
				error: "Physical symptoms is required",
			});
			return;
		}

		if (!concerns) {
			consentLogger.error("Present concerns is required");
			res.status(400).json({
				error: "Present concerns is required",
			});
			return;
		}

		if (!services) {
			consentLogger.error("Services is required");
			res.status(400).json({
				error: "Services is required",
			});
			return;
		}

		if (!sleep_duration) {
			consentLogger.error("Sleep duration is required");
			res.status(400).json({
				error: "Sleep duration is required",
			});
			return;
		}

		if (!stress_level) {
			consentLogger.error("Stress level is required");
			res.status(400).json({
				error: "Stress level is required",
			});
			return;
		}

		if (!academic_performance_change) {
			consentLogger.error("Academic performance change is required");
			res.status(400).json({
				error: "Academic performance change is required",
			});
			return;
		}

		// Validate enum values
		if (referred && !Object.values(Referred).includes(referred)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_REFERRED}: ${referred}`);
			res.status(400).json({
				error: `Invalid referred value. Must be one of: ${Object.values(Referred).join(", ")}`,
			});
			return;
		}

		if (with_whom_do_you_live && !Object.values(Live).includes(with_whom_do_you_live)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_LIVE}: ${with_whom_do_you_live}`);
			res.status(400).json({
				error: `Invalid living situation. Must be one of: ${Object.values(Live).join(", ")}`,
			});
			return;
		}

		if (!Object.values(Financial).includes(financial_status)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_FINANCIAL}: ${financial_status}`);
			res.status(400).json({
				error: `Invalid financial status. Must be one of: ${Object.values(Financial).join(", ")}`,
			});
			return;
		}

		if (!Object.values(PhysicalProblem).includes(physical_problem)) {
			consentLogger.error(
				`${config.ERROR.CONSENT.INVALID_PHYSICAL_PROBLEM}: ${physical_problem}`,
			);
			res.status(400).json({
				error: `Invalid physical problem value. Must be one of: ${Object.values(PhysicalProblem).join(", ")}`,
			});
			return;
		}

		if (!Object.values(PhysicalSymptoms).includes(physical_symptoms)) {
			consentLogger.error(
				`${config.ERROR.CONSENT.INVALID_PHYSICAL_SYMPTOMS}: ${physical_symptoms}`,
			);
			res.status(400).json({
				error: `Invalid physical symptoms. Must be one of: ${Object.values(PhysicalSymptoms).join(", ")}`,
			});
			return;
		}

		if (!Object.values(Services).includes(services)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_SERVICES}: ${services}`);
			res.status(400).json({
				error: `Invalid services value. Must be one of: ${Object.values(Services).join(", ")}`,
			});
			return;
		}

		if (!Object.values(StressLevel).includes(stress_level)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_STRESS_LEVEL}: ${stress_level}`);
			res.status(400).json({
				error: `Invalid stress level. Must be one of: ${Object.values(StressLevel).join(", ")}`,
			});
			return;
		}

		if (!Object.values(PerformanceChange).includes(academic_performance_change)) {
			consentLogger.error(
				`${config.ERROR.CONSENT.INVALID_PERFORMANCE_CHANGE}: ${academic_performance_change}`,
			);
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
				consentLogger.error(`${config.ERROR.CONSENT.STUDENT_NOT_FOUND}: ${studentId}`);
				res.status(404).json({
					error: config.ERROR.CONSENT.STUDENT_NOT_FOUND,
				});
				return;
			}

			// Check if consent already exists for this student
			const existingConsent = await prisma.consent.findFirst({
				where: {
					studentId,
					isDeleted: false,
				},
			});

			if (existingConsent) {
				consentLogger.error(`${config.ERROR.CONSENT.EXISTING_CONSENT}: ${studentId}`);
				res.status(409).json({
					error: config.ERROR.CONSENT.EXISTING_CONSENT,
				});
				return;
			}

			const newConsent = await prisma.consent.create({
				data: {
					studentId,
					referred: referred || Referred.self,
					with_whom_do_you_live: with_whom_do_you_live || Live.guardians,
					financial_status,
					what_brings_you_to_guidance: what_brings_you_to_guidance || null,
					physical_problem,
					physical_symptoms,
					concerns,
					services,
					sleep_duration,
					stress_level,
					academic_performance_change,
				},
				include: {
					student: {
						include: {
							person: true,
						},
					},
				},
			});

			consentLogger.info(`${config.SUCCESS.CONSENT.CREATED}: ${newConsent.id}`);

			// Automatically run mental health prediction after consent creation
			try {
				// Prepare data for prediction using consent data and student info
				const studentData: Partial<StudentData> = {
					gender: newConsent.student?.person?.gender
						? newConsent.student.person.gender.charAt(0).toUpperCase() +
							newConsent.student.person.gender.slice(1)
						: "Other",
					age: newConsent.student?.person?.age || 20,
					educationLevel: newConsent.student?.program || "None",
					sleepDuration: parseFloat(sleep_duration) || 7,
					stressLevel:
						stress_level === StressLevel.low
							? "Low"
							: stress_level === StressLevel.medium
								? "Medium"
								: stress_level === StressLevel.high
									? "High"
									: "Medium",
				};

				// Call the mental health predictor
				const prediction = await mentalHealthPredictor.predictMentalHealthRisk(studentData);

				consentLogger.info(
					`Mental health prediction for new consent ${newConsent.id}: ${prediction.prediction} (confidence: ${prediction.confidence})`,
				);

				// Return consent data with prediction results
				res.status(201).json({
					message: "Consent created successfully with mental health prediction",
					disclaimer:
						"⚠️ IMPORTANT NOTICE: This mental health prediction is for screening purposes only and should not be considered a professional diagnosis. For accurate mental health assessment, please utilize our comprehensive resources and consult with qualified mental health professionals.",
					consent: newConsent,
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
				// If prediction fails, still return successful consent creation
				consentLogger.warn(
					`Mental health prediction failed for consent ${newConsent.id}: ${predictionError}`,
				);

				res.status(201).json({
					message: "Consent created successfully (mental health prediction unavailable)",
					consent: newConsent,
					mentalHealthPrediction: {
						error: "Prediction service temporarily unavailable",
						note: "Consent was created successfully, but mental health prediction could not be generated at this time.",
					},
				});
			}
		} catch (error) {
			consentLogger.error(`${config.ERROR.CONSENT.ERROR_GETTING_CONSENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.CONSENT.INTERNAL_SERVER_ERROR });
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const {
			referred,
			with_whom_do_you_live,
			financial_status,
			what_brings_you_to_guidance,
			physical_problem,
			physical_symptoms,
			concerns,
			services,
			sleep_duration,
			stress_level,
			academic_performance_change,
		} = req.body;

		if (!id) {
			consentLogger.error(config.ERROR.CONSENT.MISSING_ID);
			res.status(400).json({ error: config.ERROR.CONSENT.MISSING_ID });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			consentLogger.error(config.ERROR.CONSENT.NO_UPDATE_FIELDS);
			res.status(400).json({
				error: config.ERROR.CONSENT.AT_LEAST_ONE_FIELD_REQUIRED,
			});
			return;
		}

		// Validate enum values if provided
		if (referred && !Object.values(Referred).includes(referred)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_REFERRED}: ${referred}`);
			res.status(400).json({
				error: `Invalid referred value. Must be one of: ${Object.values(Referred).join(", ")}`,
			});
			return;
		}

		if (with_whom_do_you_live && !Object.values(Live).includes(with_whom_do_you_live)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_LIVE}: ${with_whom_do_you_live}`);
			res.status(400).json({
				error: `Invalid living situation. Must be one of: ${Object.values(Live).join(", ")}`,
			});
			return;
		}

		if (financial_status && !Object.values(Financial).includes(financial_status)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_FINANCIAL}: ${financial_status}`);
			res.status(400).json({
				error: `Invalid financial status. Must be one of: ${Object.values(Financial).join(", ")}`,
			});
			return;
		}

		if (physical_problem && !Object.values(PhysicalProblem).includes(physical_problem)) {
			consentLogger.error(
				`${config.ERROR.CONSENT.INVALID_PHYSICAL_PROBLEM}: ${physical_problem}`,
			);
			res.status(400).json({
				error: `Invalid physical problem value. Must be one of: ${Object.values(PhysicalProblem).join(", ")}`,
			});
			return;
		}

		if (physical_symptoms && !Object.values(PhysicalSymptoms).includes(physical_symptoms)) {
			consentLogger.error(
				`${config.ERROR.CONSENT.INVALID_PHYSICAL_SYMPTOMS}: ${physical_symptoms}`,
			);
			res.status(400).json({
				error: `Invalid physical symptoms. Must be one of: ${Object.values(PhysicalSymptoms).join(", ")}`,
			});
			return;
		}

		if (services && !Object.values(Services).includes(services)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_SERVICES}: ${services}`);
			res.status(400).json({
				error: `Invalid services value. Must be one of: ${Object.values(Services).join(", ")}`,
			});
			return;
		}

		if (stress_level && !Object.values(StressLevel).includes(stress_level)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_STRESS_LEVEL}: ${stress_level}`);
			res.status(400).json({
				error: `Invalid stress level. Must be one of: ${Object.values(StressLevel).join(", ")}`,
			});
			return;
		}

		if (
			academic_performance_change &&
			!Object.values(PerformanceChange).includes(academic_performance_change)
		) {
			consentLogger.error(
				`${config.ERROR.CONSENT.INVALID_PERFORMANCE_CHANGE}: ${academic_performance_change}`,
			);
			res.status(400).json({
				error: `Invalid performance change. Must be one of: ${Object.values(PerformanceChange).join(", ")}`,
			});
			return;
		}

		consentLogger.info(`Updating consent: ${id}`);

		try {
			const existingConsent = await prisma.consent.findFirst({
				where: {
					id,
					isDeleted: false,
				},
			});

			if (!existingConsent) {
				consentLogger.error(`${config.ERROR.CONSENT.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.CONSENT.NOT_FOUND });
				return;
			}

			const updateData: Prisma.ConsentUpdateInput = {
				updatedAt: new Date(),
			};

			if (referred !== undefined) updateData.referred = referred;
			if (with_whom_do_you_live !== undefined)
				updateData.with_whom_do_you_live = with_whom_do_you_live;
			if (financial_status !== undefined) updateData.financial_status = financial_status;
			if (what_brings_you_to_guidance !== undefined)
				updateData.what_brings_you_to_guidance = what_brings_you_to_guidance;
			if (physical_problem !== undefined) updateData.physical_problem = physical_problem;
			if (physical_symptoms !== undefined) updateData.physical_symptoms = physical_symptoms;
			if (concerns !== undefined) updateData.concerns = concerns;
			if (services !== undefined) updateData.services = services;
			if (sleep_duration !== undefined) updateData.sleep_duration = sleep_duration;
			if (stress_level !== undefined) updateData.stress_level = stress_level;
			if (academic_performance_change !== undefined)
				updateData.academic_performance_change = academic_performance_change;

			const updatedConsent = await prisma.consent.update({
				where: { id },
				data: updateData,
				include: {
					student: {
						include: {
							person: true,
						},
					},
				},
			});

			consentLogger.info(`${config.SUCCESS.CONSENT.UPDATE}: ${updatedConsent.id}`);
			res.status(200).json(updatedConsent);
		} catch (error) {
			consentLogger.error(`${config.ERROR.CONSENT.ERROR_UPDATING_CONSENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.CONSENT.INTERNAL_SERVER_ERROR });
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			consentLogger.error(config.ERROR.CONSENT.MISSING_ID);
			res.status(400).json({ error: config.ERROR.CONSENT.MISSING_ID });
			return;
		}

		consentLogger.info(`${config.SUCCESS.CONSENT.SOFT_DELETING}: ${id}`);

		try {
			const existingConsent = await prisma.consent.findFirst({
				where: {
					id,
					isDeleted: false,
				},
			});

			if (!existingConsent) {
				consentLogger.error(`${config.ERROR.CONSENT.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.CONSENT.NOT_FOUND });
				return;
			}

			await prisma.consent.update({
				where: { id },
				data: {
					isDeleted: true,
					updatedAt: new Date(),
				},
			});

			consentLogger.info(`${config.SUCCESS.CONSENT.DELETED}: ${id}`);
			res.status(200).json({ message: config.SUCCESS.CONSENT.DELETED });
		} catch (error) {
			consentLogger.error(`${config.ERROR.CONSENT.ERROR_DELETING_CONSENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.CONSENT.INTERNAL_SERVER_ERROR });
		}
	};

	const predictMentalHealth = async (req: Request, res: Response, _next: NextFunction) => {
		const { studentId } = req.params;
		const { gender, age, educationLevel, sleepDuration, stressLevel } = req.body;

		if (!studentId) {
			consentLogger.error(config.ERROR.CONSENT.STUDENT_ID_REQUIRED);
			res.status(400).json({
				error: config.ERROR.CONSENT.STUDENT_ID_REQUIRED,
			});
			return;
		}

		try {
			// Get student information with person details to enhance prediction
			const student = await prisma.student.findFirst({
				where: {
					id: studentId,
					isDeleted: false,
				},
				include: {
					person: true,
				},
			});

			if (!student) {
				consentLogger.error(`Student not found: ${studentId}`);
				res.status(404).json({ error: "Student not found" });
				return;
			}

			// Check if consent exists for this student
			const existingConsent = await prisma.consent.findFirst({
				where: {
					studentId,
					isDeleted: false,
				},
			});

			if (!existingConsent) {
				consentLogger.error(`${config.ERROR.CONSENT.NOT_FOUND}: ${studentId}`);
				res.status(404).json({ error: config.ERROR.CONSENT.NOT_FOUND });
				return;
			}

			// Prepare data for prediction using body data or defaults from student record
			const studentData: Partial<StudentData> = {
				gender:
					gender ||
					(student.person?.gender
						? student.person.gender.charAt(0).toUpperCase() +
							student.person.gender.slice(1)
						: "Other"),
				age: age || student.person?.age || 20,
				educationLevel: educationLevel || student.program || "None",
				sleepDuration: sleepDuration || 7,
				stressLevel: stressLevel || "Medium",
			};

			// Validate input data
			if (studentData.age && (studentData.age < 10 || studentData.age > 100)) {
				consentLogger.error(`Invalid age: ${studentData.age}`);
				res.status(400).json({ error: "Age must be between 10 and 100" });
				return;
			}

			if (
				studentData.sleepDuration &&
				(studentData.sleepDuration < 0 || studentData.sleepDuration > 24)
			) {
				consentLogger.error(`Invalid sleep duration: ${studentData.sleepDuration}`);
				res.status(400).json({ error: "Sleep duration must be between 0 and 24 hours" });
				return;
			}

			const validStressLevels = ["Low", "Medium", "High"];
			if (studentData.stressLevel && !validStressLevels.includes(studentData.stressLevel)) {
				consentLogger.error(`Invalid stress level: ${studentData.stressLevel}`);
				res.status(400).json({
					error: "Stress level must be one of: Low, Medium, High",
				});
				return;
			}

			// Call the mental health predictor
			const prediction = await mentalHealthPredictor.predictMentalHealthRisk(studentData);

			consentLogger.info(
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
			consentLogger.error(
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
