import { NextFunction, Response } from "express";
import { config } from "../../config/error.config";
import { Prisma, PrismaClient, Role } from "../../generated/prisma";
import {
	calculateTotalScore,
	createAnalysisResult,
	createDetailedAnalysisResult,
	determineSeverityLevel,
	validateStressFrequency,
	getCooldownStatus,
	formatCooldownMessage,
	getPhilippinesTime,
} from "../../helper/stress.helper";
import { getLogger } from "../../helper/logger";
import { AuthRequest } from "../../middleware/verifyToken";

const logger = getLogger();
const stressLogger = logger.child({ module: "stress" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (!id) {
			stressLogger.error(config.ERROR.STRESS.MISSING_ID);
			res.status(400).json({ error: config.ERROR.STRESS.MISSING_ID });
			return;
		}

		if (fields && typeof fields !== "string") {
			stressLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.STRESS.POPULATE_MUST_BE_STRING });
			return;
		}

		stressLogger.info(`${config.SUCCESS.STRESS.GETTING_BY_ID}: ${id}`);

		try {
			const query: Prisma.StressAssessmentFindFirstArgs = {
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

			const assessment = await prisma.stressAssessment.findFirst(query);

			if (!assessment) {
				stressLogger.error(`${config.ERROR.STRESS.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.STRESS.NOT_FOUND });
				return;
			}

			// Add analysis to response
			const analysisResult = createAnalysisResult(
				assessment.totalScore,
				assessment.severityLevel,
			);

			stressLogger.info(`${config.SUCCESS.STRESS.RETRIEVED}: ${assessment.id}`);
			res.status(200).json({
				...assessment,
				analysis: analysisResult,
			});
		} catch (error) {
			stressLogger.error(`${config.ERROR.STRESS.ERROR_GETTING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.STRESS.INTERNAL_SERVER_ERROR });
		}
	};

	const getAll = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { page = 1, limit = 10, sort, fields, query, order = "desc", userId } = req.query;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (isNaN(Number(page)) || Number(page) < 1) {
			stressLogger.error(`${config.ERROR.STRESS.INVALID_PAGE}: ${page}`);
			res.status(400).json({ error: config.ERROR.STRESS.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			stressLogger.error(`${config.ERROR.STRESS.INVALID_LIMIT}: ${limit}`);
			res.status(400).json({ error: config.ERROR.STRESS.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			stressLogger.error(`${config.ERROR.STRESS.ORDER_MUST_BE_ASC_OR_DESC}: ${order}`);
			res.status(400).json({ error: config.ERROR.STRESS.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			stressLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.STRESS.POPULATE_MUST_BE_STRING });
			return;
		}

		const skip = (Number(page) - 1) * Number(limit);

		stressLogger.info(
			`${config.SUCCESS.STRESS.GETTING_ALL}, page: ${page}, limit: ${limit}, userId: ${userId}, order: ${order}, requestingUser: ${requestingUserId}, role: ${userRole}`,
		);

		try {
			const whereClause: Prisma.StressAssessmentWhereInput = {
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

			const findManyQuery: Prisma.StressAssessmentFindManyArgs = {
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
				prisma.stressAssessment.findMany(findManyQuery),
				prisma.stressAssessment.count({ where: whereClause }),
			]);

			// Add analysis to each assessment
			const assessmentsWithAnalysis = assessments.map((assessment) => ({
				...assessment,
				analysis: createAnalysisResult(assessment.totalScore, assessment.severityLevel),
			}));

			stressLogger.info(
				`Retrieved ${assessments.length} stress assessments for role: ${userRole}`,
			);
			res.status(200).json({
				assessments: assessmentsWithAnalysis,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			stressLogger.error(`${config.ERROR.STRESS.ERROR_GETTING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.STRESS.INTERNAL_SERVER_ERROR });
		}
	};

	const create = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const {
			upset_because_something_unexpected,
			unable_control_important_things,
			feeling_nervous_and_stressed,
			confident_handle_personal_problems,
			feeling_things_going_your_way,
			unable_cope_with_all_things,
			able_control_irritations,
			feeling_on_top_of_things,
			angered_things_outside_control,
			difficulties_piling_up_cant_overcome,
			assessmentDate,
		} = req.body;

		// Get userId from authenticated user
		const userId = req.userId;

		// Validation
		if (!userId) {
			stressLogger.error("User not authenticated");
			res.status(401).json({ error: "User not authenticated" });
			return;
		}

		const requiredResponses = [
			upset_because_something_unexpected,
			unable_control_important_things,
			feeling_nervous_and_stressed,
			confident_handle_personal_problems,
			feeling_things_going_your_way,
			unable_cope_with_all_things,
			able_control_irritations,
			feeling_on_top_of_things,
			angered_things_outside_control,
			difficulties_piling_up_cant_overcome,
		];

		if (requiredResponses.some((response) => response === undefined || response === null)) {
			stressLogger.error(config.ERROR.STRESS.PSS10_RESPONSES_REQUIRED);
			res.status(400).json({ error: config.ERROR.STRESS.PSS10_RESPONSES_REQUIRED });
			return;
		}

		// Validate stress frequency values
		if (!requiredResponses.every((response) => validateStressFrequency(response))) {
			stressLogger.error(config.ERROR.STRESS.INVALID_PSS10_RESPONSE);
			res.status(400).json({ error: config.ERROR.STRESS.INVALID_PSS10_RESPONSE });
			return;
		}

		try {
			// Check if user exists
			const user = await prisma.user.findUnique({
				where: { id: userId, isDeleted: false },
				include: { person: true },
			});

			if (!user) {
				stressLogger.error(`${config.ERROR.STRESS.USER_NOT_FOUND}: ${userId}`);
				res.status(404).json({ error: config.ERROR.STRESS.USER_NOT_FOUND });
				return;
			}

			// Check for existing assessments and cooldown period
			const mostRecentAssessment = await prisma.stressAssessment.findFirst({
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
				stressLogger.info(`${config.SUCCESS.STRESS.COOLDOWN_CHECKED} for user: ${userId}`, {
					lastAssessmentDate: mostRecentAssessment.assessmentDate,
					currentPhilippinesTime: currentPhTime,
					nextAvailableDate: cooldownStatus.nextAvailableDate,
					daysRemaining: cooldownStatus.daysRemaining,
					isActive: cooldownStatus.isActive,
					debugInfo: cooldownStatus.debugInfo,
				});

				// Check both time-based cooldown AND manual cooldown flag
				const isCooldownActive =
					mostRecentAssessment.cooldownActive && cooldownStatus.isActive;

				if (isCooldownActive) {
					const cooldownMessage = formatCooldownMessage(
						mostRecentAssessment.severityLevel,
						cooldownStatus.daysRemaining,
						cooldownStatus.nextAvailableDate,
					);

					stressLogger.error(
						`${config.ERROR.STRESS.COOLDOWN_ACTIVE}: ${userId} - ${cooldownStatus.daysRemaining} days remaining`,
					);
					res.status(429).json({
						error: config.ERROR.STRESS.COOLDOWN_ACTIVE,
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
						stressLogger.info(
							`${config.SUCCESS.STRESS.COOLDOWN_DEACTIVATED_BY_ADMIN} for user: ${userId}`,
						);
					} else {
						stressLogger.info(
							`${config.SUCCESS.STRESS.COOLDOWN_EXPIRED} for user: ${userId}`,
						);
					}
				}
			}

			// Calculate score and severity
			const responses = {
				upset_because_something_unexpected,
				unable_control_important_things,
				feeling_nervous_and_stressed,
				confident_handle_personal_problems,
				feeling_things_going_your_way,
				unable_cope_with_all_things,
				able_control_irritations,
				feeling_on_top_of_things,
				angered_things_outside_control,
				difficulties_piling_up_cant_overcome,
			};

			const totalScore = calculateTotalScore(responses);
			const severityLevel = determineSeverityLevel(totalScore);

			stressLogger.info(`${config.SUCCESS.STRESS.SCORE_CALCULATED}: ${totalScore}`);
			stressLogger.info(`${config.SUCCESS.STRESS.SEVERITY_DETERMINED}: ${severityLevel}`);

			const newAssessment = await prisma.stressAssessment.create({
				data: {
					user: {
						connect: { id: userId },
					},
					upset_because_something_unexpected,
					unable_control_important_things,
					feeling_nervous_and_stressed,
					confident_handle_personal_problems,
					feeling_things_going_your_way,
					unable_cope_with_all_things,
					able_control_irritations,
					feeling_on_top_of_things,
					angered_things_outside_control,
					difficulties_piling_up_cant_overcome,
					totalScore,
					severityLevel,
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

			stressLogger.info(`${config.SUCCESS.STRESS.CREATED}: ${newAssessment.id}`);
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
			stressLogger.error(`${config.ERROR.STRESS.ERROR_GETTING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.STRESS.INTERNAL_SERVER_ERROR });
		}
	};

	const update = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const {
			upset_because_something_unexpected,
			unable_control_important_things,
			feeling_nervous_and_stressed,
			confident_handle_personal_problems,
			feeling_things_going_your_way,
			unable_cope_with_all_things,
			able_control_irritations,
			feeling_on_top_of_things,
			angered_things_outside_control,
			difficulties_piling_up_cant_overcome,
			assessmentDate,
			cooldownActive,
		} = req.body;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (!id) {
			stressLogger.error(config.ERROR.STRESS.MISSING_ID);
			res.status(400).json({ error: config.ERROR.STRESS.MISSING_ID });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			stressLogger.error("No update fields provided");
			res.status(400).json({
				error: config.ERROR.STRESS.AT_LEAST_ONE_FIELD_REQUIRED,
			});
			return;
		}

		// Validate stress frequency values if provided
		const stressResponses = [
			upset_because_something_unexpected,
			unable_control_important_things,
			feeling_nervous_and_stressed,
			confident_handle_personal_problems,
			feeling_things_going_your_way,
			unable_cope_with_all_things,
			able_control_irritations,
			feeling_on_top_of_things,
			angered_things_outside_control,
			difficulties_piling_up_cant_overcome,
		].filter((response) => response !== undefined);

		if (stressResponses.some((response) => !validateStressFrequency(response))) {
			stressLogger.error(config.ERROR.STRESS.INVALID_PSS10_RESPONSE);
			res.status(400).json({ error: config.ERROR.STRESS.INVALID_PSS10_RESPONSE });
			return;
		}

		// Validate cooldown update permissions - only admins can modify cooldown status
		if (cooldownActive !== undefined && userRole === Role.user) {
			stressLogger.error(
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
			stressLogger.error(`Invalid cooldownActive value: ${cooldownActive}`);
			res.status(400).json({
				error: "Invalid cooldownActive value - must be true or false",
			});
			return;
		}

		stressLogger.info(`Updating stress assessment: ${id}`);

		try {
			// First check if assessment exists and apply role-based access control
			const whereClause: any = { id };

			// Regular users can only update their own assessments
			if (userRole === Role.user) {
				whereClause.userId = requestingUserId;
			}
			// Admins can update any assessment (no additional filter needed)

			const existingAssessment = await prisma.stressAssessment.findUnique({
				where: whereClause,
			});

			if (!existingAssessment) {
				stressLogger.error(`${config.ERROR.STRESS.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.STRESS.NOT_FOUND });
				return;
			}

			const updateData: Prisma.StressAssessmentUpdateInput = {
				updatedAt: new Date(),
			};

			// Update individual responses
			if (upset_because_something_unexpected !== undefined)
				updateData.upset_because_something_unexpected = upset_because_something_unexpected;
			if (unable_control_important_things !== undefined)
				updateData.unable_control_important_things = unable_control_important_things;
			if (feeling_nervous_and_stressed !== undefined)
				updateData.feeling_nervous_and_stressed = feeling_nervous_and_stressed;
			if (confident_handle_personal_problems !== undefined)
				updateData.confident_handle_personal_problems = confident_handle_personal_problems;
			if (feeling_things_going_your_way !== undefined)
				updateData.feeling_things_going_your_way = feeling_things_going_your_way;
			if (unable_cope_with_all_things !== undefined)
				updateData.unable_cope_with_all_things = unable_cope_with_all_things;
			if (able_control_irritations !== undefined)
				updateData.able_control_irritations = able_control_irritations;
			if (feeling_on_top_of_things !== undefined)
				updateData.feeling_on_top_of_things = feeling_on_top_of_things;
			if (angered_things_outside_control !== undefined)
				updateData.angered_things_outside_control = angered_things_outside_control;
			if (difficulties_piling_up_cant_overcome !== undefined)
				updateData.difficulties_piling_up_cant_overcome =
					difficulties_piling_up_cant_overcome;
			if (assessmentDate !== undefined) updateData.assessmentDate = new Date(assessmentDate);
			if (cooldownActive !== undefined) updateData.cooldownActive = cooldownActive;

			// Recalculate score if any PSS-10 responses were updated
			const hasPss10Updates = [
				upset_because_something_unexpected,
				unable_control_important_things,
				feeling_nervous_and_stressed,
				confident_handle_personal_problems,
				feeling_things_going_your_way,
				unable_cope_with_all_things,
				able_control_irritations,
				feeling_on_top_of_things,
				angered_things_outside_control,
				difficulties_piling_up_cant_overcome,
			].some((response) => response !== undefined);

			if (hasPss10Updates) {
				// Get current values merged with updates
				const currentResponses = {
					upset_because_something_unexpected:
						upset_because_something_unexpected ??
						existingAssessment.upset_because_something_unexpected,
					unable_control_important_things:
						unable_control_important_things ??
						existingAssessment.unable_control_important_things,
					feeling_nervous_and_stressed:
						feeling_nervous_and_stressed ??
						existingAssessment.feeling_nervous_and_stressed,
					confident_handle_personal_problems:
						confident_handle_personal_problems ??
						existingAssessment.confident_handle_personal_problems,
					feeling_things_going_your_way:
						feeling_things_going_your_way ??
						existingAssessment.feeling_things_going_your_way,
					unable_cope_with_all_things:
						unable_cope_with_all_things ??
						existingAssessment.unable_cope_with_all_things,
					able_control_irritations:
						able_control_irritations ?? existingAssessment.able_control_irritations,
					feeling_on_top_of_things:
						feeling_on_top_of_things ?? existingAssessment.feeling_on_top_of_things,
					angered_things_outside_control:
						angered_things_outside_control ??
						existingAssessment.angered_things_outside_control,
					difficulties_piling_up_cant_overcome:
						difficulties_piling_up_cant_overcome ??
						existingAssessment.difficulties_piling_up_cant_overcome,
				};

				const newTotalScore = calculateTotalScore(currentResponses);
				const newSeverityLevel = determineSeverityLevel(newTotalScore);

				updateData.totalScore = newTotalScore;
				updateData.severityLevel = newSeverityLevel;

				stressLogger.info(`${config.SUCCESS.STRESS.SCORE_CALCULATED}: ${newTotalScore}`);
				stressLogger.info(
					`${config.SUCCESS.STRESS.SEVERITY_DETERMINED}: ${newSeverityLevel}`,
				);
			}

			// Log cooldown status changes
			if (
				cooldownActive !== undefined &&
				cooldownActive !== existingAssessment.cooldownActive
			) {
				const action = cooldownActive ? "activated" : "deactivated";
				stressLogger.info(
					`Cooldown ${action} for assessment ${id} by ${userRole} user ${requestingUserId}`,
				);
			}

			const updatedAssessment = await prisma.stressAssessment.update({
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

			stressLogger.info(`${config.SUCCESS.STRESS.UPDATE}: ${updatedAssessment.id}`);
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
			stressLogger.error(`${config.ERROR.STRESS.ERROR_UPDATING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.STRESS.INTERNAL_SERVER_ERROR });
		}
	};

	const remove = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (!id) {
			stressLogger.error("Missing stress assessment ID");
			res.status(400).json({ error: config.ERROR.STRESS.MISSING_ID });
			return;
		}

		stressLogger.info(`${config.SUCCESS.STRESS.SOFT_DELETING}: ${id}`);

		try {
			// First check if assessment exists and apply role-based access control
			const whereClause: any = { id };

			// Regular users can only delete their own assessments
			if (userRole === Role.user) {
				whereClause.userId = requestingUserId;
			}
			// Admins can delete any assessment (no additional filter needed)

			const existingAssessment = await prisma.stressAssessment.findUnique({
				where: whereClause,
			});

			if (!existingAssessment) {
				stressLogger.error(`${config.ERROR.STRESS.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.STRESS.NOT_FOUND });
				return;
			}

			await prisma.stressAssessment.update({
				where: { id },
				data: {
					isDeleted: true,
					updatedAt: new Date(),
				},
			});

			stressLogger.info(`${config.SUCCESS.STRESS.DELETED}: ${id}`);
			res.status(200).json({ message: "Stress assessment deleted successfully" });
		} catch (error) {
			stressLogger.error(`${config.ERROR.STRESS.ERROR_DELETING_ASSESSMENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.STRESS.INTERNAL_SERVER_ERROR });
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
