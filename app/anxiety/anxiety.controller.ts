import { NextFunction, Response } from "express";
import { config } from "../../config/error.config";
import { Prisma, PrismaClient, Role } from "../../generated/prisma";
import {
	calculateTotalScore,
	createAnalysisResult,
	createDetailedAnalysisResult,
	determineSeverityLevel,
	formatCooldownMessage,
	getCooldownStatus,
	getPhilippinesTime,
	validateAnxietyLevel,
	validateDifficultyLevel,
} from "../../helper/anxiety.helper";
import { getLogger } from "../../helper/logger";
import { AuthRequest } from "../../middleware/verifyToken";

const logger = getLogger();
const anxietyLogger = logger.child({ module: "anxiety" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (!id) {
			anxietyLogger.error(config.ERROR.ANXIETY.MISSING_ID);
			res.status(400).json({ error: config.ERROR.ANXIETY.MISSING_ID });
			return;
		}

		if (fields && typeof fields !== "string") {
			anxietyLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.ANXIETY.POPULATE_MUST_BE_STRING });
			return;
		}

		anxietyLogger.info(`${config.SUCCESS.ANXIETY.GETTING_BY_ID}: ${id}`);

		try {
			const query: Prisma.AnxietyAssessmentFindFirstArgs = {
				where: {
					id,
					isDeleted: false,
				},
			};

			// Role-based access control: Regular users can only access their own assessments
			if (userRole === Role.user) {
				query.where!.userId = requestingUserId;
			}
			// Admins and super_admins can access all assessments (no additional filter needed)

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

			const assessment = await prisma.anxietyAssessment.findFirst(query);

			if (!assessment) {
				anxietyLogger.error(`${config.ERROR.ANXIETY.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.ANXIETY.NOT_FOUND });
				return;
			}

			// Add analysis to response
			const analysisResult = createAnalysisResult(
				assessment.totalScore,
				assessment.severityLevel,
			);

			anxietyLogger.info(`${config.SUCCESS.ANXIETY.RETRIEVED}: ${assessment.id}`);
			res.status(200).json({
				...assessment,
				analysis: analysisResult,
			});
		} catch (error) {
			anxietyLogger.error(`${config.ERROR.ANXIETY.ERROR_GETTING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.ANXIETY.INTERNAL_SERVER_ERROR });
		}
	};

	const getAll = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { page = 1, limit = 10, sort, fields, query, order = "desc", userId } = req.query;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (isNaN(Number(page)) || Number(page) < 1) {
			anxietyLogger.error(`${config.ERROR.ANXIETY.INVALID_PAGE}: ${page}`);
			res.status(400).json({ error: config.ERROR.ANXIETY.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			anxietyLogger.error(`${config.ERROR.ANXIETY.INVALID_LIMIT}: ${limit}`);
			res.status(400).json({ error: config.ERROR.ANXIETY.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			anxietyLogger.error(`${config.ERROR.ANXIETY.ORDER_MUST_BE_ASC_OR_DESC}: ${order}`);
			res.status(400).json({ error: config.ERROR.ANXIETY.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			anxietyLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.ANXIETY.POPULATE_MUST_BE_STRING });
			return;
		}

		const skip = (Number(page) - 1) * Number(limit);

		anxietyLogger.info(
			`${config.SUCCESS.ANXIETY.GETTING_ALL}, page: ${page}, limit: ${limit}, userId: ${userId}, order: ${order}, requestingUser: ${requestingUserId}, role: ${userRole}`,
		);

		try {
			const whereClause: Prisma.AnxietyAssessmentWhereInput = {
				isDeleted: false,
				...(query
					? {
							OR: [
								{ user: { userName: { contains: String(query) } } },
								{ user: { person: { firstName: { contains: String(query) } } } },
								{ user: { person: { lastName: { contains: String(query) } } } },
							],
						}
					: {}),
			};

			// Role-based access control
			if (userRole === Role.user) {
				// Regular users can only see their own assessments
				whereClause.userId = requestingUserId;
			} else if (userRole === Role.admin || userRole === Role.super_admin) {
				// Admins can see all assessments, but can also filter by specific userId if provided
				if (userId) {
					whereClause.userId = String(userId);
				}
			}

			const findManyQuery: Prisma.AnxietyAssessmentFindManyArgs = {
				where: whereClause,
				skip,
				take: Number(limit),
				orderBy: sort
					? typeof sort === "string" && !sort.startsWith("{")
						? { [sort as string]: order }
						: JSON.parse(sort as string)
					: { assessmentDate: order as Prisma.SortOrder },
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

			const [assessments, total] = await Promise.all([
				prisma.anxietyAssessment.findMany(findManyQuery),
				prisma.anxietyAssessment.count({ where: whereClause }),
			]);

			// Add analysis to each assessment
			const assessmentsWithAnalysis = assessments.map((assessment) => ({
				...assessment,
				analysis: createAnalysisResult(assessment.totalScore, assessment.severityLevel),
			}));

			anxietyLogger.info(
				`Retrieved ${assessments.length} anxiety assessments for role: ${userRole}`,
			);
			res.status(200).json({
				assessments: assessmentsWithAnalysis,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			anxietyLogger.error(`${config.ERROR.ANXIETY.ERROR_GETTING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.ANXIETY.INTERNAL_SERVER_ERROR });
		}
	};

	const create = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const {
			feeling_nervous_anxious_edge,
			not_able_stop_control_worrying,
			worrying_too_much_different_things,
			trouble_relaxing,
			restless_hard_sit_still,
			easily_annoyed_irritable,
			feeling_afraid_awful_happen,
			difficulty_level,
			assessmentDate,
		} = req.body;

		// Get userId from authenticated user
		const userId = req.userId;

		// Validation
		if (!userId) {
			anxietyLogger.error("User not authenticated");
			res.status(401).json({ error: "User not authenticated" });
			return;
		}

		const requiredResponses = [
			feeling_nervous_anxious_edge,
			not_able_stop_control_worrying,
			worrying_too_much_different_things,
			trouble_relaxing,
			restless_hard_sit_still,
			easily_annoyed_irritable,
			feeling_afraid_awful_happen,
		];

		if (requiredResponses.some((response) => response === undefined || response === null)) {
			anxietyLogger.error(config.ERROR.ANXIETY.GAD7_RESPONSES_REQUIRED);
			res.status(400).json({ error: config.ERROR.ANXIETY.GAD7_RESPONSES_REQUIRED });
			return;
		}

		// Validate anxiety level values
		if (!requiredResponses.every((response) => validateAnxietyLevel(response))) {
			anxietyLogger.error(config.ERROR.ANXIETY.INVALID_GAD7_RESPONSE);
			res.status(400).json({ error: config.ERROR.ANXIETY.INVALID_GAD7_RESPONSE });
			return;
		}

		// Validate difficulty level if provided
		if (difficulty_level && !validateDifficultyLevel(difficulty_level)) {
			anxietyLogger.error(config.ERROR.ANXIETY.INVALID_DIFFICULTY_LEVEL);
			res.status(400).json({ error: config.ERROR.ANXIETY.INVALID_DIFFICULTY_LEVEL });
			return;
		}

		try {
			// Check if user exists
			const user = await prisma.user.findUnique({
				where: { id: userId, isDeleted: false },
				include: { person: true },
			});

			if (!user) {
				anxietyLogger.error(`${config.ERROR.ANXIETY.USER_NOT_FOUND}: ${userId}`);
				res.status(404).json({ error: config.ERROR.ANXIETY.USER_NOT_FOUND });
				return;
			}

			// Check for existing assessments and cooldown period
			const mostRecentAssessment = await prisma.anxietyAssessment.findFirst({
				where: {
					userId,
					isDeleted: false,
				},
				orderBy: {
					assessmentDate: "desc",
				},
			});

			if (mostRecentAssessment) {
				const cooldownStatus = getCooldownStatus(
					mostRecentAssessment.assessmentDate,
					mostRecentAssessment.severityLevel,
				);

				// Log timezone debug information
				const currentPhTime = getPhilippinesTime();
				anxietyLogger.info(
					`${config.SUCCESS.ANXIETY.COOLDOWN_CHECKED} for user: ${userId}`,
					{
						lastAssessmentDate: mostRecentAssessment.assessmentDate,
						currentPhilippinesTime: currentPhTime,
						nextAvailableDate: cooldownStatus.nextAvailableDate,
						daysRemaining: cooldownStatus.daysRemaining,
						isActive: cooldownStatus.isActive,
						debugInfo: cooldownStatus.debugInfo,
					},
				);

				// Check both time-based cooldown AND manual cooldown flag
				const isCooldownActive =
					mostRecentAssessment.cooldownActive && cooldownStatus.isActive;

				if (isCooldownActive) {
					const cooldownMessage = formatCooldownMessage(
						mostRecentAssessment.severityLevel,
						cooldownStatus.daysRemaining,
						cooldownStatus.nextAvailableDate,
					);

					anxietyLogger.error(
						`${config.ERROR.ANXIETY.COOLDOWN_ACTIVE}: ${userId} - ${cooldownStatus.daysRemaining} days remaining`,
					);
					res.status(429).json({
						error: config.ERROR.ANXIETY.COOLDOWN_ACTIVE,
						message: cooldownMessage,
						cooldownInfo: {
							isActive: true,
							daysRemaining: cooldownStatus.daysRemaining,
							nextAvailableDate: cooldownStatus.nextAvailableDate,
							lastAssessmentDate: mostRecentAssessment.assessmentDate,
							lastSeverityLevel: mostRecentAssessment.severityLevel,
							cooldownPeriodDays: cooldownStatus.cooldownPeriodDays,
							manuallyDeactivated: !mostRecentAssessment.cooldownActive,
							currentPhilippinesTime: cooldownStatus.currentPhilippinesTime,
							debugInfo: cooldownStatus.debugInfo,
						},
					});
					return;
				} else {
					if (!mostRecentAssessment.cooldownActive) {
						anxietyLogger.info(
							`${config.SUCCESS.ANXIETY.COOLDOWN_DEACTIVATED_BY_ADMIN} for user: ${userId}`,
						);
					} else {
						anxietyLogger.info(
							`${config.SUCCESS.ANXIETY.COOLDOWN_EXPIRED} for user: ${userId}`,
						);
					}
				}
			}

			// Calculate score and severity
			const responses = {
				feeling_nervous_anxious_edge,
				not_able_stop_control_worrying,
				worrying_too_much_different_things,
				trouble_relaxing,
				restless_hard_sit_still,
				easily_annoyed_irritable,
				feeling_afraid_awful_happen,
			};

			const totalScore = calculateTotalScore(responses);
			const severityLevel = determineSeverityLevel(totalScore);

			anxietyLogger.info(`${config.SUCCESS.ANXIETY.SCORE_CALCULATED}: ${totalScore}`);
			anxietyLogger.info(`${config.SUCCESS.ANXIETY.SEVERITY_DETERMINED}: ${severityLevel}`);

			const newAssessment = await prisma.anxietyAssessment.create({
				data: {
					user: {
						connect: { id: userId },
					},
					feeling_nervous_anxious_edge,
					not_able_stop_control_worrying,
					worrying_too_much_different_things,
					trouble_relaxing,
					restless_hard_sit_still,
					easily_annoyed_irritable,
					feeling_afraid_awful_happen,
					totalScore,
					severityLevel,
					difficulty_level: difficulty_level || null,
					assessmentDate: assessmentDate ? new Date(assessmentDate) : new Date(),
					cooldownActive: true, // New assessments start with cooldown active
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

			// Create response with analysis
			const analysisResult = createDetailedAnalysisResult(
				responses,
				totalScore,
				severityLevel,
			);

			// Add cooldown information to response
			const cooldownStatus = getCooldownStatus(
				newAssessment.assessmentDate,
				newAssessment.severityLevel,
			);

			anxietyLogger.info(`${config.SUCCESS.ANXIETY.CREATED}: ${newAssessment.id}`);
			res.status(201).json({
				...newAssessment,
				analysis: analysisResult,
				cooldownInfo: {
					isActive: true, // New assessments always start with active cooldown
					daysRemaining: cooldownStatus.daysRemaining,
					nextAvailableDate: cooldownStatus.nextAvailableDate,
					cooldownPeriodDays: cooldownStatus.cooldownPeriodDays,
					manuallyDeactivated: false,
					currentPhilippinesTime: cooldownStatus.currentPhilippinesTime,
					debugInfo: cooldownStatus.debugInfo,
				},
			});
		} catch (error) {
			anxietyLogger.error(`${config.ERROR.ANXIETY.ERROR_GETTING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.ANXIETY.INTERNAL_SERVER_ERROR });
		}
	};

	const update = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const {
			feeling_nervous_anxious_edge,
			not_able_stop_control_worrying,
			worrying_too_much_different_things,
			trouble_relaxing,
			restless_hard_sit_still,
			easily_annoyed_irritable,
			feeling_afraid_awful_happen,
			difficulty_level,
			assessmentDate,
			cooldownActive,
		} = req.body;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (!id) {
			anxietyLogger.error(config.ERROR.ANXIETY.MISSING_ID);
			res.status(400).json({ error: config.ERROR.ANXIETY.MISSING_ID });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			anxietyLogger.error("No update fields provided");
			res.status(400).json({
				error: config.ERROR.ANXIETY.AT_LEAST_ONE_FIELD_REQUIRED,
			});
			return;
		}

		// Validate anxiety level values if provided
		const anxietyResponses = [
			feeling_nervous_anxious_edge,
			not_able_stop_control_worrying,
			worrying_too_much_different_things,
			trouble_relaxing,
			restless_hard_sit_still,
			easily_annoyed_irritable,
			feeling_afraid_awful_happen,
		].filter((response) => response !== undefined);

		if (anxietyResponses.some((response) => !validateAnxietyLevel(response))) {
			anxietyLogger.error(config.ERROR.ANXIETY.INVALID_GAD7_RESPONSE);
			res.status(400).json({ error: config.ERROR.ANXIETY.INVALID_GAD7_RESPONSE });
			return;
		}

		// Validate difficulty level if provided
		if (difficulty_level && !validateDifficultyLevel(difficulty_level)) {
			anxietyLogger.error(config.ERROR.ANXIETY.INVALID_DIFFICULTY_LEVEL);
			res.status(400).json({ error: config.ERROR.ANXIETY.INVALID_DIFFICULTY_LEVEL });
			return;
		}

		// Validate cooldown update permissions - only admins can modify cooldown status
		if (cooldownActive !== undefined && userRole === Role.user) {
			anxietyLogger.error(
				`User ${requestingUserId} attempted to modify cooldown status without admin privileges`,
			);
			res.status(403).json({
				error: "Insufficient permissions to modify cooldown status",
				message: "Only admin and guidance personnel can modify assessment cooldown periods",
			});
			return;
		}

		// Validate cooldownActive value if provided
		if (cooldownActive !== undefined && typeof cooldownActive !== "boolean") {
			anxietyLogger.error(`Invalid cooldownActive value: ${cooldownActive}`);
			res.status(400).json({
				error: "Invalid cooldownActive value - must be true or false",
			});
			return;
		}

		anxietyLogger.info(`Updating anxiety assessment: ${id}`);

		try {
			// First check if assessment exists and apply role-based access control
			const whereClause: any = { id };

			// Regular users can only update their own assessments
			if (userRole === Role.user) {
				whereClause.userId = requestingUserId;
			}
			// Admins can update any assessment (no additional filter needed)

			const existingAssessment = await prisma.anxietyAssessment.findUnique({
				where: whereClause,
			});

			if (!existingAssessment) {
				anxietyLogger.error(`${config.ERROR.ANXIETY.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.ANXIETY.NOT_FOUND });
				return;
			}

			const updateData: Prisma.AnxietyAssessmentUpdateInput = {
				updatedAt: new Date(),
			};

			// Update individual responses
			if (feeling_nervous_anxious_edge !== undefined)
				updateData.feeling_nervous_anxious_edge = feeling_nervous_anxious_edge;
			if (not_able_stop_control_worrying !== undefined)
				updateData.not_able_stop_control_worrying = not_able_stop_control_worrying;
			if (worrying_too_much_different_things !== undefined)
				updateData.worrying_too_much_different_things = worrying_too_much_different_things;
			if (trouble_relaxing !== undefined) updateData.trouble_relaxing = trouble_relaxing;
			if (restless_hard_sit_still !== undefined)
				updateData.restless_hard_sit_still = restless_hard_sit_still;
			if (easily_annoyed_irritable !== undefined)
				updateData.easily_annoyed_irritable = easily_annoyed_irritable;
			if (feeling_afraid_awful_happen !== undefined)
				updateData.feeling_afraid_awful_happen = feeling_afraid_awful_happen;
			if (difficulty_level !== undefined) updateData.difficulty_level = difficulty_level;
			if (assessmentDate !== undefined) updateData.assessmentDate = new Date(assessmentDate);
			if (cooldownActive !== undefined) updateData.cooldownActive = cooldownActive;

			// Recalculate score if any GAD-7 responses were updated
			const hasGad7Updates = [
				feeling_nervous_anxious_edge,
				not_able_stop_control_worrying,
				worrying_too_much_different_things,
				trouble_relaxing,
				restless_hard_sit_still,
				easily_annoyed_irritable,
				feeling_afraid_awful_happen,
			].some((response) => response !== undefined);

			if (hasGad7Updates) {
				// Get current values merged with updates
				const currentResponses = {
					feeling_nervous_anxious_edge:
						feeling_nervous_anxious_edge ??
						existingAssessment.feeling_nervous_anxious_edge,
					not_able_stop_control_worrying:
						not_able_stop_control_worrying ??
						existingAssessment.not_able_stop_control_worrying,
					worrying_too_much_different_things:
						worrying_too_much_different_things ??
						existingAssessment.worrying_too_much_different_things,
					trouble_relaxing: trouble_relaxing ?? existingAssessment.trouble_relaxing,
					restless_hard_sit_still:
						restless_hard_sit_still ?? existingAssessment.restless_hard_sit_still,
					easily_annoyed_irritable:
						easily_annoyed_irritable ?? existingAssessment.easily_annoyed_irritable,
					feeling_afraid_awful_happen:
						feeling_afraid_awful_happen ??
						existingAssessment.feeling_afraid_awful_happen,
				};

				const newTotalScore = calculateTotalScore(currentResponses);
				const newSeverityLevel = determineSeverityLevel(newTotalScore);

				updateData.totalScore = newTotalScore;
				updateData.severityLevel = newSeverityLevel;

				anxietyLogger.info(`${config.SUCCESS.ANXIETY.SCORE_CALCULATED}: ${newTotalScore}`);
				anxietyLogger.info(
					`${config.SUCCESS.ANXIETY.SEVERITY_DETERMINED}: ${newSeverityLevel}`,
				);
			}

			// Log cooldown status changes
			if (
				cooldownActive !== undefined &&
				cooldownActive !== existingAssessment.cooldownActive
			) {
				const action = cooldownActive ? "activated" : "deactivated";
				anxietyLogger.info(
					`Cooldown ${action} for assessment ${id} by ${userRole} user ${requestingUserId}`,
				);
			}

			const updatedAssessment = await prisma.anxietyAssessment.update({
				where: { id },
				data: updateData,
				include: {
					user: {
						include: {
							person: true,
						},
					},
				},
			});

			// Add analysis to response
			const analysisResult = createAnalysisResult(
				updatedAssessment.totalScore,
				updatedAssessment.severityLevel,
			);

			// Add cooldown information to response
			const cooldownStatus = getCooldownStatus(
				updatedAssessment.assessmentDate,
				updatedAssessment.severityLevel,
			);

			anxietyLogger.info(`${config.SUCCESS.ANXIETY.UPDATE}: ${updatedAssessment.id}`);
			res.status(200).json({
				...updatedAssessment,
				analysis: analysisResult,
				cooldownInfo: {
					isActive: updatedAssessment.cooldownActive && cooldownStatus.isActive,
					daysRemaining: updatedAssessment.cooldownActive
						? cooldownStatus.daysRemaining
						: 0,
					nextAvailableDate: cooldownStatus.nextAvailableDate,
					cooldownPeriodDays: cooldownStatus.cooldownPeriodDays,
					manuallyDeactivated:
						!updatedAssessment.cooldownActive && cooldownStatus.isActive,
					currentPhilippinesTime: cooldownStatus.currentPhilippinesTime,
					debugInfo: cooldownStatus.debugInfo,
				},
			});
		} catch (error) {
			anxietyLogger.error(`${config.ERROR.ANXIETY.ERROR_UPDATING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.ANXIETY.INTERNAL_SERVER_ERROR });
		}
	};

	const remove = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (!id) {
			anxietyLogger.error("Missing anxiety assessment ID");
			res.status(400).json({ error: config.ERROR.ANXIETY.MISSING_ID });
			return;
		}

		anxietyLogger.info(`${config.SUCCESS.ANXIETY.SOFT_DELETING}: ${id}`);

		try {
			// First check if assessment exists and apply role-based access control
			const whereClause: any = { id };

			// Regular users can only delete their own assessments
			if (userRole === Role.user) {
				whereClause.userId = requestingUserId;
			}
			// Admins can delete any assessment (no additional filter needed)

			const existingAssessment = await prisma.anxietyAssessment.findUnique({
				where: whereClause,
			});

			if (!existingAssessment) {
				anxietyLogger.error(`${config.ERROR.ANXIETY.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.ANXIETY.NOT_FOUND });
				return;
			}

			await prisma.anxietyAssessment.update({
				where: { id },
				data: {
					isDeleted: true,
					updatedAt: new Date(),
				},
			});

			anxietyLogger.info(`${config.SUCCESS.ANXIETY.DELETED}: ${id}`);
			res.status(200).json({ message: "Anxiety assessment deleted successfully" });
		} catch (error) {
			anxietyLogger.error(`${config.ERROR.ANXIETY.ERROR_DELETING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.ANXIETY.INTERNAL_SERVER_ERROR });
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
