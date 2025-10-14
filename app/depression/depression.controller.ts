import { NextFunction, Response } from "express";
import { config } from "../../config/error.config";
import { Prisma, PrismaClient, Role } from "../../generated/prisma";
import {
	calculateTotalScore,
	createAnalysisResult,
	createDetailedAnalysisResult,
	determineSeverityLevel,
	validateDepressionFrequency,
	validateDifficultyLevel,
	checkSuicidalIdeation,
	getCooldownStatus,
	formatCooldownMessage,
	getPhilippinesTime,
} from "../../helper/depression.helper";
import { getLogger } from "../../helper/logger";
import { createNotificationHelper } from "../../helper/notification.helper";
import { AuthRequest } from "../../middleware/verifyToken";

const logger = getLogger();
const depressionLogger = logger.child({ module: "depression" });

export const controller = (prisma: PrismaClient) => {
	const notificationHelper = createNotificationHelper(prisma);
	const getById = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (!id) {
			depressionLogger.error(config.ERROR.DEPRESSION.MISSING_ID);
			res.status(400).json({ error: config.ERROR.DEPRESSION.MISSING_ID });
			return;
		}

		if (fields && typeof fields !== "string") {
			depressionLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.DEPRESSION.POPULATE_MUST_BE_STRING });
			return;
		}

		depressionLogger.info(`${config.SUCCESS.DEPRESSION.GETTING_BY_ID}: ${id}`);

		try {
			const query: Prisma.DepressionAssessmentFindFirstArgs = {
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

			const assessment = await prisma.depressionAssessment.findFirst(query);

			if (!assessment) {
				depressionLogger.error(`${config.ERROR.DEPRESSION.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.DEPRESSION.NOT_FOUND });
				return;
			}

			// Add analysis to response
			const analysisResult = createAnalysisResult(
				assessment.totalScore,
				assessment.severityLevel,
			);

			depressionLogger.info(`${config.SUCCESS.DEPRESSION.RETRIEVED}: ${assessment.id}`);
			res.status(200).json({
				...assessment,
				analysis: analysisResult,
			});
		} catch (error) {
			depressionLogger.error(`${config.ERROR.DEPRESSION.ERROR_GETTING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.DEPRESSION.INTERNAL_SERVER_ERROR });
		}
	};

	const getAll = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { page = 1, limit = 10, sort, fields, query, order = "desc", userId } = req.query;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (isNaN(Number(page)) || Number(page) < 1) {
			depressionLogger.error(`${config.ERROR.DEPRESSION.INVALID_PAGE}: ${page}`);
			res.status(400).json({ error: config.ERROR.DEPRESSION.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			depressionLogger.error(`${config.ERROR.DEPRESSION.INVALID_LIMIT}: ${limit}`);
			res.status(400).json({ error: config.ERROR.DEPRESSION.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			depressionLogger.error(
				`${config.ERROR.DEPRESSION.ORDER_MUST_BE_ASC_OR_DESC}: ${order}`,
			);
			res.status(400).json({ error: config.ERROR.DEPRESSION.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			depressionLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.DEPRESSION.POPULATE_MUST_BE_STRING });
			return;
		}

		const skip = (Number(page) - 1) * Number(limit);

		depressionLogger.info(
			`${config.SUCCESS.DEPRESSION.GETTING_ALL}, page: ${page}, limit: ${limit}, userId: ${userId}, order: ${order}, requestingUser: ${requestingUserId}, role: ${userRole}`,
		);

		try {
			const whereClause: Prisma.DepressionAssessmentWhereInput = {
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

			const findManyQuery: Prisma.DepressionAssessmentFindManyArgs = {
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
				prisma.depressionAssessment.findMany(findManyQuery),
				prisma.depressionAssessment.count({ where: whereClause }),
			]);

			// Add analysis to each assessment
			const assessmentsWithAnalysis = assessments.map((assessment) => ({
				...assessment,
				analysis: createAnalysisResult(assessment.totalScore, assessment.severityLevel),
			}));

			depressionLogger.info(
				`Retrieved ${assessments.length} depression assessments for role: ${userRole}`,
			);
			res.status(200).json({
				assessments: assessmentsWithAnalysis,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			depressionLogger.error(`${config.ERROR.DEPRESSION.ERROR_GETTING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.DEPRESSION.INTERNAL_SERVER_ERROR });
		}
	};

	const create = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const {
			little_interest_pleasure_doing_things,
			feeling_down_depressed_hopeless,
			trouble_falling_staying_asleep_too_much,
			feeling_tired_having_little_energy,
			poor_appetite_overeating,
			feeling_bad_about_yourself_failure,
			trouble_concentrating_things,
			moving_speaking_slowly_fidgety_restless,
			thoughts_better_off_dead_hurting_yourself,
			difficulty_level,
			assessmentDate,
		} = req.body;

		// Get userId from authenticated user
		const userId = req.userId;

		// Validation
		if (!userId) {
			depressionLogger.error("User not authenticated");
			res.status(401).json({ error: "User not authenticated" });
			return;
		}

		const requiredResponses = [
			little_interest_pleasure_doing_things,
			feeling_down_depressed_hopeless,
			trouble_falling_staying_asleep_too_much,
			feeling_tired_having_little_energy,
			poor_appetite_overeating,
			feeling_bad_about_yourself_failure,
			trouble_concentrating_things,
			moving_speaking_slowly_fidgety_restless,
			thoughts_better_off_dead_hurting_yourself,
		];

		if (requiredResponses.some((response) => response === undefined || response === null)) {
			depressionLogger.error(config.ERROR.DEPRESSION.PHQ9_RESPONSES_REQUIRED);
			res.status(400).json({ error: config.ERROR.DEPRESSION.PHQ9_RESPONSES_REQUIRED });
			return;
		}

		// Validate depression frequency values
		if (!requiredResponses.every((response) => validateDepressionFrequency(response))) {
			depressionLogger.error(config.ERROR.DEPRESSION.INVALID_PHQ9_RESPONSE);
			res.status(400).json({ error: config.ERROR.DEPRESSION.INVALID_PHQ9_RESPONSE });
			return;
		}

		// Validate difficulty level if provided
		if (difficulty_level && !validateDifficultyLevel(difficulty_level)) {
			depressionLogger.error(config.ERROR.DEPRESSION.INVALID_DIFFICULTY_LEVEL);
			res.status(400).json({ error: config.ERROR.DEPRESSION.INVALID_DIFFICULTY_LEVEL });
			return;
		}

		try {
			// Check if user exists
			const user = await prisma.user.findUnique({
				where: { id: userId, isDeleted: false },
				include: { person: true },
			});

			if (!user) {
				depressionLogger.error(`${config.ERROR.DEPRESSION.USER_NOT_FOUND}: ${userId}`);
				res.status(404).json({ error: config.ERROR.DEPRESSION.USER_NOT_FOUND });
				return;
			}

			// Check for existing assessments and cooldown period
			const mostRecentAssessment = await prisma.depressionAssessment.findFirst({
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
				depressionLogger.info(
					`${config.SUCCESS.DEPRESSION.COOLDOWN_CHECKED} for user: ${userId}`,
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

					depressionLogger.error(
						`${config.ERROR.DEPRESSION.COOLDOWN_ACTIVE}: ${userId} - ${cooldownStatus.daysRemaining} days remaining`,
					);
					res.status(429).json({
						error: config.ERROR.DEPRESSION.COOLDOWN_ACTIVE,
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
						depressionLogger.info(
							`${config.SUCCESS.DEPRESSION.COOLDOWN_DEACTIVATED_BY_ADMIN} for user: ${userId}`,
						);
					} else {
						depressionLogger.info(
							`${config.SUCCESS.DEPRESSION.COOLDOWN_EXPIRED} for user: ${userId}`,
						);
					}
				}
			}

			// Calculate score and severity
			const responses = {
				little_interest_pleasure_doing_things,
				feeling_down_depressed_hopeless,
				trouble_falling_staying_asleep_too_much,
				feeling_tired_having_little_energy,
				poor_appetite_overeating,
				feeling_bad_about_yourself_failure,
				trouble_concentrating_things,
				moving_speaking_slowly_fidgety_restless,
				thoughts_better_off_dead_hurting_yourself,
			};

			const totalScore = calculateTotalScore(responses);
			const severityLevel = determineSeverityLevel(totalScore);

			depressionLogger.info(`${config.SUCCESS.DEPRESSION.SCORE_CALCULATED}: ${totalScore}`);
			depressionLogger.info(
				`${config.SUCCESS.DEPRESSION.SEVERITY_DETERMINED}: ${severityLevel}`,
			);

			// Check for suicidal ideation
			const hasSuicidalIdeation = checkSuicidalIdeation(
				thoughts_better_off_dead_hurting_yourself,
			);
			if (hasSuicidalIdeation) {
				depressionLogger.warn(
					`${config.SUCCESS.DEPRESSION.SUICIDAL_IDEATION_FLAGGED}: User ${userId}`,
				);
			}

			const newAssessment = await prisma.depressionAssessment.create({
				data: {
					user: {
						connect: { id: userId },
					},
					little_interest_pleasure_doing_things,
					feeling_down_depressed_hopeless,
					trouble_falling_staying_asleep_too_much,
					feeling_tired_having_little_energy,
					poor_appetite_overeating,
					feeling_bad_about_yourself_failure,
					trouble_concentrating_things,
					moving_speaking_slowly_fidgety_restless,
					thoughts_better_off_dead_hurting_yourself,
					totalScore,
					severityLevel,
					...(difficulty_level !== undefined && { difficulty_level }),
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

			depressionLogger.info(`${config.SUCCESS.DEPRESSION.CREATED}: ${newAssessment.id}`);

			// Create notification for depression assessment completion
			try {
				await notificationHelper.createAssessmentNotification(
					"DEPRESSION",
					"CREATED",
					newAssessment.userId,
					newAssessment.id,
					newAssessment.severityLevel,
					{
						totalScore: newAssessment.totalScore,
						severityLevel: newAssessment.severityLevel,
						assessmentDate: newAssessment.assessmentDate,
						hasSuicidalIdeation,
					},
				);
			} catch (notificationError) {
				depressionLogger.warn(
					`Failed to create depression assessment notification: ${notificationError}`,
				);
			}

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
			depressionLogger.error(`${config.ERROR.DEPRESSION.ERROR_GETTING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.DEPRESSION.INTERNAL_SERVER_ERROR });
		}
	};

	const update = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const {
			little_interest_pleasure_doing_things,
			feeling_down_depressed_hopeless,
			trouble_falling_staying_asleep_too_much,
			feeling_tired_having_little_energy,
			poor_appetite_overeating,
			feeling_bad_about_yourself_failure,
			trouble_concentrating_things,
			moving_speaking_slowly_fidgety_restless,
			thoughts_better_off_dead_hurting_yourself,
			difficulty_level,
			assessmentDate,
			cooldownActive,
		} = req.body;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (!id) {
			depressionLogger.error(config.ERROR.DEPRESSION.MISSING_ID);
			res.status(400).json({ error: config.ERROR.DEPRESSION.MISSING_ID });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			depressionLogger.error("No update fields provided");
			res.status(400).json({
				error: config.ERROR.DEPRESSION.AT_LEAST_ONE_FIELD_REQUIRED,
			});
			return;
		}

		// Validate depression frequency values if provided
		const depressionResponses = [
			little_interest_pleasure_doing_things,
			feeling_down_depressed_hopeless,
			trouble_falling_staying_asleep_too_much,
			feeling_tired_having_little_energy,
			poor_appetite_overeating,
			feeling_bad_about_yourself_failure,
			trouble_concentrating_things,
			moving_speaking_slowly_fidgety_restless,
			thoughts_better_off_dead_hurting_yourself,
		].filter((response) => response !== undefined);

		if (depressionResponses.some((response) => !validateDepressionFrequency(response))) {
			depressionLogger.error(config.ERROR.DEPRESSION.INVALID_PHQ9_RESPONSE);
			res.status(400).json({ error: config.ERROR.DEPRESSION.INVALID_PHQ9_RESPONSE });
			return;
		}

		// Validate difficulty level if provided
		if (difficulty_level && !validateDifficultyLevel(difficulty_level)) {
			depressionLogger.error(config.ERROR.DEPRESSION.INVALID_DIFFICULTY_LEVEL);
			res.status(400).json({ error: config.ERROR.DEPRESSION.INVALID_DIFFICULTY_LEVEL });
			return;
		}

		// Validate cooldown update permissions - only admins can modify cooldown status
		if (cooldownActive !== undefined && userRole === Role.user) {
			depressionLogger.error(
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
			depressionLogger.error(`Invalid cooldownActive value: ${cooldownActive}`);
			res.status(400).json({
				error: "Invalid cooldownActive value - must be true or false",
			});
			return;
		}

		depressionLogger.info(`Updating depression assessment: ${id}`);

		try {
			// First check if assessment exists and apply role-based access control
			const whereClause: any = { id };

			// Regular users can only update their own assessments
			if (userRole === Role.user) {
				whereClause.userId = requestingUserId;
			}
			// Admins can update any assessment (no additional filter needed)

			const existingAssessment = await prisma.depressionAssessment.findUnique({
				where: whereClause,
			});

			if (!existingAssessment) {
				depressionLogger.error(`${config.ERROR.DEPRESSION.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.DEPRESSION.NOT_FOUND });
				return;
			}

			const updateData: Prisma.DepressionAssessmentUpdateInput = {
				updatedAt: new Date(),
			};

			// Update individual responses
			if (little_interest_pleasure_doing_things !== undefined)
				updateData.little_interest_pleasure_doing_things =
					little_interest_pleasure_doing_things;
			if (feeling_down_depressed_hopeless !== undefined)
				updateData.feeling_down_depressed_hopeless = feeling_down_depressed_hopeless;
			if (trouble_falling_staying_asleep_too_much !== undefined)
				updateData.trouble_falling_staying_asleep_too_much =
					trouble_falling_staying_asleep_too_much;
			if (feeling_tired_having_little_energy !== undefined)
				updateData.feeling_tired_having_little_energy = feeling_tired_having_little_energy;
			if (poor_appetite_overeating !== undefined)
				updateData.poor_appetite_overeating = poor_appetite_overeating;
			if (feeling_bad_about_yourself_failure !== undefined)
				updateData.feeling_bad_about_yourself_failure = feeling_bad_about_yourself_failure;
			if (trouble_concentrating_things !== undefined)
				updateData.trouble_concentrating_things = trouble_concentrating_things;
			if (moving_speaking_slowly_fidgety_restless !== undefined)
				updateData.moving_speaking_slowly_fidgety_restless =
					moving_speaking_slowly_fidgety_restless;
			if (thoughts_better_off_dead_hurting_yourself !== undefined)
				updateData.thoughts_better_off_dead_hurting_yourself =
					thoughts_better_off_dead_hurting_yourself;
			if (difficulty_level !== undefined) updateData.difficulty_level = difficulty_level;
			if (assessmentDate !== undefined) updateData.assessmentDate = new Date(assessmentDate);
			if (cooldownActive !== undefined) updateData.cooldownActive = cooldownActive;

			// Recalculate score if any PHQ-9 responses were updated
			const hasPhq9Updates = [
				little_interest_pleasure_doing_things,
				feeling_down_depressed_hopeless,
				trouble_falling_staying_asleep_too_much,
				feeling_tired_having_little_energy,
				poor_appetite_overeating,
				feeling_bad_about_yourself_failure,
				trouble_concentrating_things,
				moving_speaking_slowly_fidgety_restless,
				thoughts_better_off_dead_hurting_yourself,
			].some((response) => response !== undefined);

			if (hasPhq9Updates) {
				// Get current values merged with updates
				const currentResponses = {
					little_interest_pleasure_doing_things:
						little_interest_pleasure_doing_things ??
						existingAssessment.little_interest_pleasure_doing_things,
					feeling_down_depressed_hopeless:
						feeling_down_depressed_hopeless ??
						existingAssessment.feeling_down_depressed_hopeless,
					trouble_falling_staying_asleep_too_much:
						trouble_falling_staying_asleep_too_much ??
						existingAssessment.trouble_falling_staying_asleep_too_much,
					feeling_tired_having_little_energy:
						feeling_tired_having_little_energy ??
						existingAssessment.feeling_tired_having_little_energy,
					poor_appetite_overeating:
						poor_appetite_overeating ?? existingAssessment.poor_appetite_overeating,
					feeling_bad_about_yourself_failure:
						feeling_bad_about_yourself_failure ??
						existingAssessment.feeling_bad_about_yourself_failure,
					trouble_concentrating_things:
						trouble_concentrating_things ??
						existingAssessment.trouble_concentrating_things,
					moving_speaking_slowly_fidgety_restless:
						moving_speaking_slowly_fidgety_restless ??
						existingAssessment.moving_speaking_slowly_fidgety_restless,
					thoughts_better_off_dead_hurting_yourself:
						thoughts_better_off_dead_hurting_yourself ??
						existingAssessment.thoughts_better_off_dead_hurting_yourself,
				};

				const newTotalScore = calculateTotalScore(currentResponses);
				const newSeverityLevel = determineSeverityLevel(newTotalScore);

				updateData.totalScore = newTotalScore;
				updateData.severityLevel = newSeverityLevel;

				depressionLogger.info(
					`${config.SUCCESS.DEPRESSION.SCORE_CALCULATED}: ${newTotalScore}`,
				);
				depressionLogger.info(
					`${config.SUCCESS.DEPRESSION.SEVERITY_DETERMINED}: ${newSeverityLevel}`,
				);

				// Check for suicidal ideation
				const hasSuicidalIdeation = checkSuicidalIdeation(
					currentResponses.thoughts_better_off_dead_hurting_yourself,
				);
				if (hasSuicidalIdeation) {
					depressionLogger.warn(
						`${config.SUCCESS.DEPRESSION.SUICIDAL_IDEATION_FLAGGED}: User ${requestingUserId}`,
					);
				}
			}

			// Log cooldown status changes
			if (
				cooldownActive !== undefined &&
				cooldownActive !== existingAssessment.cooldownActive
			) {
				const action = cooldownActive ? "activated" : "deactivated";
				depressionLogger.info(
					`Cooldown ${action} for assessment ${id} by ${userRole} user ${requestingUserId}`,
				);
			}

			const updatedAssessment = await prisma.depressionAssessment.update({
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

			depressionLogger.info(`${config.SUCCESS.DEPRESSION.UPDATE}: ${updatedAssessment.id}`);

			// Create notification for depression assessment update (only for significant changes)
			try {
				if (hasPhq9Updates) {
					await notificationHelper.createAssessmentNotification(
						"DEPRESSION",
						"UPDATED",
						updatedAssessment.userId,
						updatedAssessment.id,
						updatedAssessment.severityLevel,
						{
							totalScore: updatedAssessment.totalScore,
							severityLevel: updatedAssessment.severityLevel,
							assessmentDate: updatedAssessment.assessmentDate,
						},
					);
				}
			} catch (notificationError) {
				depressionLogger.warn(
					`Failed to create depression assessment update notification: ${notificationError}`,
				);
			}

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
			depressionLogger.error(
				`${config.ERROR.DEPRESSION.ERROR_UPDATING_ASSESSMENT}: ${error}`,
			);
			res.status(500).json({ error: config.ERROR.DEPRESSION.INTERNAL_SERVER_ERROR });
		}
	};

	const remove = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (!id) {
			depressionLogger.error("Missing depression assessment ID");
			res.status(400).json({ error: config.ERROR.DEPRESSION.MISSING_ID });
			return;
		}

		depressionLogger.info(`${config.SUCCESS.DEPRESSION.SOFT_DELETING}: ${id}`);

		try {
			// First check if assessment exists and apply role-based access control
			const whereClause: any = { id };

			// Regular users can only delete their own assessments
			if (userRole === Role.user) {
				whereClause.userId = requestingUserId;
			}
			// Admins can delete any assessment (no additional filter needed)

			const existingAssessment = await prisma.depressionAssessment.findUnique({
				where: whereClause,
			});

			if (!existingAssessment) {
				depressionLogger.error(`${config.ERROR.DEPRESSION.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.DEPRESSION.NOT_FOUND });
				return;
			}

			await prisma.depressionAssessment.update({
				where: { id },
				data: {
					isDeleted: true,
					updatedAt: new Date(),
				},
			});

			depressionLogger.info(`${config.SUCCESS.DEPRESSION.DELETED}: ${id}`);
			res.status(200).json({ message: "Depression assessment deleted successfully" });
		} catch (error) {
			depressionLogger.error(
				`${config.ERROR.DEPRESSION.ERROR_DELETING_ASSESSMENT}: ${error}`,
			);
			res.status(500).json({ error: config.ERROR.DEPRESSION.INTERNAL_SERVER_ERROR });
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
