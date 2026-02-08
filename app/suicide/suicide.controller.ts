import { NextFunction, Response } from "express";
import { config } from "../../config/error.config";
import { Prisma, PrismaClient, Role } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import {
	createAnalysisResult,
	createDetailedAnalysisResult,
	determineRiskLevel,
	generateRecommendations,
	requiresImmediateIntervention,
	validateBehaviorTimeframe,
	validateSuicideResponse,
} from "../../helper/suicide.helper";
import { createNotificationHelper } from "../../helper/notification.helper";
import { AuthRequest } from "../../middleware/verifyToken";

const logger = getLogger();
const suicideLogger = logger.child({ module: "suicide" });

export const controller = (prisma: PrismaClient) => {
	const notificationHelper = createNotificationHelper(prisma);
	const getById = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (!id) {
			suicideLogger.error(config.ERROR.SUICIDE.MISSING_ID);
			res.status(400).json({ error: config.ERROR.SUICIDE.MISSING_ID });
			return;
		}

		if (fields && typeof fields !== "string") {
			suicideLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.SUICIDE.POPULATE_MUST_BE_STRING });
			return;
		}

		suicideLogger.info(`${config.SUCCESS.SUICIDE.GETTING_BY_ID}: ${id}`);

		try {
			const query: Prisma.SuicideAssessmentFindFirstArgs = {
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

				if (userRole === Role.user) {
					fieldSelections.showResultToStudent = true;
					fieldSelections.riskLevel = true;
					fieldSelections.requires_immediate_intervention = true;
				}

				query.select = fieldSelections;
			}

			const assessment = await prisma.suicideAssessment.findFirst(query);

			if (!assessment) {
				suicideLogger.error(`${config.ERROR.SUICIDE.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.SUICIDE.NOT_FOUND });
				return;
			}

			// Add analysis to response
			const analysisResult = createAnalysisResult(
				assessment.riskLevel,
				assessment.requires_immediate_intervention,
			);

			const shouldHideResults =
				userRole === Role.user && assessment.showResultToStudent === false;
			const responseAssessment = shouldHideResults
				? {
						...assessment,
						riskLevel: null,
						requires_immediate_intervention: null,
					}
				: assessment;

			suicideLogger.info(`${config.SUCCESS.SUICIDE.RETRIEVED}: ${assessment.id}`);
			res.status(200).json({
				...responseAssessment,
				analysis: analysisResult,
			});
		} catch (error) {
			suicideLogger.error(`${config.ERROR.SUICIDE.ERROR_GETTING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.SUICIDE.INTERNAL_SERVER_ERROR });
		}
	};

	const getAll = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { page = 1, limit = 10, sort, fields, query, order = "desc", userId } = req.query;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (isNaN(Number(page)) || Number(page) < 1) {
			suicideLogger.error(`${config.ERROR.SUICIDE.INVALID_PAGE}: ${page}`);
			res.status(400).json({ error: config.ERROR.SUICIDE.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			suicideLogger.error(`${config.ERROR.SUICIDE.INVALID_LIMIT}: ${limit}`);
			res.status(400).json({ error: config.ERROR.SUICIDE.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			suicideLogger.error(`${config.ERROR.SUICIDE.ORDER_MUST_BE_ASC_OR_DESC}: ${order}`);
			res.status(400).json({ error: config.ERROR.SUICIDE.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			suicideLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.SUICIDE.POPULATE_MUST_BE_STRING });
			return;
		}

		const skip = (Number(page) - 1) * Number(limit);

		suicideLogger.info(
			`${config.SUCCESS.SUICIDE.GETTING_ALL}, page: ${page}, limit: ${limit}, userId: ${userId}, order: ${order}, requestingUser: ${requestingUserId}, role: ${userRole}`,
		);

		try {
			const whereClause: Prisma.SuicideAssessmentWhereInput = {
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

			const findManyQuery: Prisma.SuicideAssessmentFindManyArgs = {
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

				if (userRole === Role.user) {
					fieldSelections.showResultToStudent = true;
					fieldSelections.riskLevel = true;
					fieldSelections.requires_immediate_intervention = true;
				}

				findManyQuery.select = fieldSelections;
			}

			const [assessments, total] = await Promise.all([
				prisma.suicideAssessment.findMany(findManyQuery),
				prisma.suicideAssessment.count({ where: whereClause }),
			]);

			// Add analysis to each assessment
			const assessmentsWithAnalysis = assessments.map((assessment) => ({
				...assessment,
				analysis: createAnalysisResult(
					assessment.riskLevel,
					assessment.requires_immediate_intervention,
				),
			}));

			const sanitizedAssessments = assessmentsWithAnalysis.map((assessment) => {
				if (userRole === Role.user && assessment.showResultToStudent === false) {
					return {
						...assessment,
						riskLevel: null,
						requires_immediate_intervention: null,
					};
				}
				return assessment;
			});

			suicideLogger.info(
				`Retrieved ${assessments.length} suicide assessments for role: ${userRole}`,
			);
			res.status(200).json({
				assessments: sanitizedAssessments,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			suicideLogger.error(`${config.ERROR.SUICIDE.ERROR_GETTING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.SUICIDE.INTERNAL_SERVER_ERROR });
		}
	};

	const create = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const {
			wished_dead_or_sleep_not_wake_up,
			actually_had_thoughts_killing_self,
			thinking_about_how_might_do_this,
			had_thoughts_and_some_intention,
			started_worked_out_details_how_kill,
			done_anything_started_prepared_end_life,
			behavior_timeframe,
			assessmentDate,
		} = req.body;

		// Get userId from authenticated user
		const userId = req.userId;

		// Validation
		if (!userId) {
			suicideLogger.error("User not authenticated");
			res.status(401).json({ error: "User not authenticated" });
			return;
		}

		// Validate required CSSRS responses (Questions 1 and 2 are always required)
		if (
			wished_dead_or_sleep_not_wake_up === undefined ||
			actually_had_thoughts_killing_self === undefined
		) {
			suicideLogger.error(config.ERROR.SUICIDE.CSSRS_RESPONSES_REQUIRED);
			res.status(400).json({ error: config.ERROR.SUICIDE.CSSRS_RESPONSES_REQUIRED });
			return;
		}

		// Validate suicide response values
		const requiredResponses = [
			wished_dead_or_sleep_not_wake_up,
			actually_had_thoughts_killing_self,
		];
		const optionalResponses = [
			thinking_about_how_might_do_this,
			had_thoughts_and_some_intention,
			started_worked_out_details_how_kill,
			done_anything_started_prepared_end_life,
		].filter((r) => r !== undefined);

		if (!requiredResponses.every((response) => validateSuicideResponse(response))) {
			suicideLogger.error(config.ERROR.SUICIDE.INVALID_CSSRS_RESPONSE);
			res.status(400).json({ error: config.ERROR.SUICIDE.INVALID_CSSRS_RESPONSE });
			return;
		}

		if (
			optionalResponses.length > 0 &&
			!optionalResponses.every((response) => validateSuicideResponse(response))
		) {
			suicideLogger.error(config.ERROR.SUICIDE.INVALID_CSSRS_RESPONSE);
			res.status(400).json({ error: config.ERROR.SUICIDE.INVALID_CSSRS_RESPONSE });
			return;
		}

		if (behavior_timeframe && !validateBehaviorTimeframe(behavior_timeframe)) {
			suicideLogger.error(config.ERROR.SUICIDE.INVALID_BEHAVIOR_TIMEFRAME);
			res.status(400).json({ error: config.ERROR.SUICIDE.INVALID_BEHAVIOR_TIMEFRAME });
			return;
		}

		try {
			// Check if user exists
			const user = await prisma.user.findUnique({
				where: { id: userId, isDeleted: false },
				include: { person: true },
			});

			if (!user) {
				suicideLogger.error(`${config.ERROR.SUICIDE.USER_NOT_FOUND}: ${userId}`);
				res.status(404).json({ error: config.ERROR.SUICIDE.USER_NOT_FOUND });
				return;
			}

			// Build responses object
			const responses = {
				wished_dead_or_sleep_not_wake_up,
				actually_had_thoughts_killing_self,
				thinking_about_how_might_do_this,
				had_thoughts_and_some_intention,
				started_worked_out_details_how_kill,
				done_anything_started_prepared_end_life,
				behavior_timeframe,
			};

			const riskLevel = determineRiskLevel(responses);
			const requiresIntervention = requiresImmediateIntervention(riskLevel, responses);

			suicideLogger.info(`${config.SUCCESS.SUICIDE.RISK_ASSESSED}: ${riskLevel}`);
			suicideLogger.info(
				`${config.SUCCESS.SUICIDE.INTERVENTION_STATUS_DETERMINED}: ${requiresIntervention}`,
			);

			// Log crisis intervention if needed
			if (requiresIntervention) {
				suicideLogger.warn(
					`${config.SUCCESS.SUICIDE.CRISIS_PROTOCOL_INITIATED} for user: ${userId}`,
				);
			}

			const newAssessment = await prisma.suicideAssessment.create({
				data: {
					user: {
						connect: { id: userId },
					},
					wished_dead_or_sleep_not_wake_up,
					actually_had_thoughts_killing_self,
					thinking_about_how_might_do_this,
					had_thoughts_and_some_intention,
					started_worked_out_details_how_kill,
					done_anything_started_prepared_end_life,
					behavior_timeframe,
					riskLevel,
					requires_immediate_intervention: requiresIntervention,
					assessmentDate: assessmentDate ? new Date(assessmentDate) : new Date(),
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
				riskLevel,
				requiresIntervention,
			);

			// Generate personalized recommendations
			const recommendations = generateRecommendations(riskLevel, requiresIntervention);

			suicideLogger.info(`${config.SUCCESS.SUICIDE.CREATED}: ${newAssessment.id}`);

			// Create notification for suicide assessment completion
			try {
				await notificationHelper.createAssessmentNotification(
					"SUICIDE",
					"CREATED",
					newAssessment.userId,
					newAssessment.id,
					newAssessment.riskLevel,
					{
						riskLevel: newAssessment.riskLevel,
						requiresIntervention: newAssessment.requires_immediate_intervention,
						assessmentDate: newAssessment.assessmentDate,
						recommendations: recommendations.slice(0, 3), // Include top 3 recommendations in notification
					},
				);
			} catch (notificationError) {
				suicideLogger.warn(
					`Failed to create suicide assessment notification: ${notificationError}`,
				);
			}

			// Set appropriate response status based on risk level
			const statusCode = requiresIntervention ? 201 : 201; // Always 201 for created, but log severity

			res.status(statusCode).json({
				...newAssessment,
				analysis: {
					...analysisResult,
					recommendations,
				},
			});
		} catch (error) {
			suicideLogger.error(`${config.ERROR.SUICIDE.ERROR_GETTING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.SUICIDE.INTERNAL_SERVER_ERROR });
		}
	};

	const update = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const {
			wished_dead_or_sleep_not_wake_up,
			actually_had_thoughts_killing_self,
			thinking_about_how_might_do_this,
			had_thoughts_and_some_intention,
			started_worked_out_details_how_kill,
			done_anything_started_prepared_end_life,
			behavior_timeframe,
			assessmentDate,
			showResultToStudent,
		} = req.body;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (!id) {
			suicideLogger.error(config.ERROR.SUICIDE.MISSING_ID);
			res.status(400).json({ error: config.ERROR.SUICIDE.MISSING_ID });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			suicideLogger.error("No update fields provided");
			res.status(400).json({
				error: config.ERROR.SUICIDE.AT_LEAST_ONE_FIELD_REQUIRED,
			});
			return;
		}

		// Validate suicide response values if provided
		const suicideResponses = [
			wished_dead_or_sleep_not_wake_up,
			actually_had_thoughts_killing_self,
			thinking_about_how_might_do_this,
			had_thoughts_and_some_intention,
			started_worked_out_details_how_kill,
			done_anything_started_prepared_end_life,
		].filter((response) => response !== undefined);

		if (suicideResponses.some((response) => !validateSuicideResponse(response))) {
			suicideLogger.error(config.ERROR.SUICIDE.INVALID_CSSRS_RESPONSE);
			res.status(400).json({ error: config.ERROR.SUICIDE.INVALID_CSSRS_RESPONSE });
			return;
		}

		if (behavior_timeframe && !validateBehaviorTimeframe(behavior_timeframe)) {
			suicideLogger.error(config.ERROR.SUICIDE.INVALID_BEHAVIOR_TIMEFRAME);
			res.status(400).json({ error: config.ERROR.SUICIDE.INVALID_BEHAVIOR_TIMEFRAME });
			return;
		}

		// Validate visibility update permissions - only admins can modify student visibility
		if (showResultToStudent !== undefined && userRole === Role.user) {
			suicideLogger.error(
				`User ${requestingUserId} attempted to modify assessment visibility without admin privileges`,
			);
			res.status(403).json({
				error: "Insufficient permissions to modify assessment visibility",
				message: "Only admin and guidance personnel can update assessment visibility",
			});
			return;
		}

		if (showResultToStudent !== undefined && typeof showResultToStudent !== "boolean") {
			suicideLogger.error(`Invalid showResultToStudent value: ${showResultToStudent}`);
			res.status(400).json({
				error: "Invalid showResultToStudent value - must be true or false",
			});
			return;
		}

		suicideLogger.info(`Updating suicide assessment: ${id}`);

		try {
			// First check if assessment exists and apply role-based access control
			const whereClause: any = { id };

			// Regular users can only update their own assessments
			if (userRole === Role.user) {
				whereClause.userId = requestingUserId;
			}
			// Admins can update any assessment (no additional filter needed)

			const existingAssessment = await prisma.suicideAssessment.findUnique({
				where: whereClause,
			});

			if (!existingAssessment) {
				suicideLogger.error(`${config.ERROR.SUICIDE.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.SUICIDE.NOT_FOUND });
				return;
			}

			const updateData: Prisma.SuicideAssessmentUpdateInput = {
				updatedAt: new Date(),
			};

			// Update individual responses
			if (wished_dead_or_sleep_not_wake_up !== undefined)
				updateData.wished_dead_or_sleep_not_wake_up = wished_dead_or_sleep_not_wake_up;
			if (actually_had_thoughts_killing_self !== undefined)
				updateData.actually_had_thoughts_killing_self = actually_had_thoughts_killing_self;
			if (thinking_about_how_might_do_this !== undefined)
				updateData.thinking_about_how_might_do_this = thinking_about_how_might_do_this;
			if (had_thoughts_and_some_intention !== undefined)
				updateData.had_thoughts_and_some_intention = had_thoughts_and_some_intention;
			if (started_worked_out_details_how_kill !== undefined)
				updateData.started_worked_out_details_how_kill =
					started_worked_out_details_how_kill;
			if (done_anything_started_prepared_end_life !== undefined)
				updateData.done_anything_started_prepared_end_life =
					done_anything_started_prepared_end_life;
			if (behavior_timeframe !== undefined)
				updateData.behavior_timeframe = behavior_timeframe;
			if (assessmentDate !== undefined) updateData.assessmentDate = new Date(assessmentDate);
			if (showResultToStudent !== undefined)
				updateData.showResultToStudent = showResultToStudent;

			// Recalculate risk if any CSSRS responses were updated
			const hasCssrsUpdates = [
				wished_dead_or_sleep_not_wake_up,
				actually_had_thoughts_killing_self,
				thinking_about_how_might_do_this,
				had_thoughts_and_some_intention,
				started_worked_out_details_how_kill,
				done_anything_started_prepared_end_life,
				behavior_timeframe,
			].some((response) => response !== undefined);

			if (hasCssrsUpdates) {
				// Get current values merged with updates
				const currentResponses = {
					wished_dead_or_sleep_not_wake_up:
						wished_dead_or_sleep_not_wake_up ??
						existingAssessment.wished_dead_or_sleep_not_wake_up,
					actually_had_thoughts_killing_self:
						actually_had_thoughts_killing_self ??
						existingAssessment.actually_had_thoughts_killing_self,
					thinking_about_how_might_do_this:
						thinking_about_how_might_do_this ??
						existingAssessment.thinking_about_how_might_do_this,
					had_thoughts_and_some_intention:
						had_thoughts_and_some_intention ??
						existingAssessment.had_thoughts_and_some_intention,
					started_worked_out_details_how_kill:
						started_worked_out_details_how_kill ??
						existingAssessment.started_worked_out_details_how_kill,
					done_anything_started_prepared_end_life:
						done_anything_started_prepared_end_life ??
						existingAssessment.done_anything_started_prepared_end_life,
					behavior_timeframe: behavior_timeframe ?? existingAssessment.behavior_timeframe,
				};

				const newRiskLevel = determineRiskLevel(currentResponses);
				const newRequiresIntervention = requiresImmediateIntervention(
					newRiskLevel,
					currentResponses,
				);

				updateData.riskLevel = newRiskLevel;
				updateData.requires_immediate_intervention = newRequiresIntervention;

				suicideLogger.info(`${config.SUCCESS.SUICIDE.RISK_ASSESSED}: ${newRiskLevel}`);
				suicideLogger.info(
					`${config.SUCCESS.SUICIDE.INTERVENTION_STATUS_DETERMINED}: ${newRequiresIntervention}`,
				);

				// Log crisis intervention if needed
				if (newRequiresIntervention) {
					suicideLogger.warn(
						`${config.SUCCESS.SUICIDE.CRISIS_PROTOCOL_INITIATED} for assessment: ${id}`,
					);
				}
			}

			const updatedAssessment = await prisma.suicideAssessment.update({
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
				updatedAssessment.riskLevel,
				updatedAssessment.requires_immediate_intervention,
			);

			suicideLogger.info(`${config.SUCCESS.SUICIDE.UPDATE}: ${updatedAssessment.id}`);

			// Create notification for suicide assessment update (only for significant changes)
			try {
				if (hasCssrsUpdates) {
					await notificationHelper.createAssessmentNotification(
						"SUICIDE",
						"UPDATED",
						updatedAssessment.userId,
						updatedAssessment.id,
						updatedAssessment.riskLevel,
						{
							riskLevel: updatedAssessment.riskLevel,
							requiresIntervention: updatedAssessment.requires_immediate_intervention,
							assessmentDate: updatedAssessment.assessmentDate,
						},
					);
				}
			} catch (notificationError) {
				suicideLogger.warn(
					`Failed to create suicide assessment update notification: ${notificationError}`,
				);
			}

			res.status(200).json({
				...updatedAssessment,
				analysis: analysisResult,
			});
		} catch (error) {
			suicideLogger.error(`${config.ERROR.SUICIDE.ERROR_UPDATING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.SUICIDE.INTERNAL_SERVER_ERROR });
		}
	};

	const remove = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (!id) {
			suicideLogger.error("Missing suicide assessment ID");
			res.status(400).json({ error: config.ERROR.SUICIDE.MISSING_ID });
			return;
		}

		suicideLogger.info(`${config.SUCCESS.SUICIDE.SOFT_DELETING}: ${id}`);

		try {
			// First check if assessment exists and apply role-based access control
			const whereClause: any = { id };

			// Regular users can only delete their own assessments
			if (userRole === Role.user) {
				whereClause.userId = requestingUserId;
			}
			// Admins can delete any assessment (no additional filter needed)

			const existingAssessment = await prisma.suicideAssessment.findUnique({
				where: whereClause,
			});

			if (!existingAssessment) {
				suicideLogger.error(`${config.ERROR.SUICIDE.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.SUICIDE.NOT_FOUND });
				return;
			}

			await prisma.suicideAssessment.update({
				where: { id },
				data: {
					isDeleted: true,
					updatedAt: new Date(),
				},
			});

			suicideLogger.info(`${config.SUCCESS.SUICIDE.DELETED}: ${id}`);
			res.status(200).json({ message: "Suicide assessment deleted successfully" });
		} catch (error) {
			suicideLogger.error(`${config.ERROR.SUICIDE.ERROR_DELETING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.SUICIDE.INTERNAL_SERVER_ERROR });
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
