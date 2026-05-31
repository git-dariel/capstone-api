import { NextFunction, Response } from "express";
import { LogType, Prisma, PrismaClient, Role, Type } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { createNotificationHelper } from "../../helper/notification.helper";
import { AuthRequest } from "../../middleware/verifyToken";
import { analyzeChecklistData, generateRecommendations } from "../../helper/checklist.helper";

const logger = getLogger();
const checklistLogger = logger.child({ module: "checklist" });

export const controller = (prisma: PrismaClient) => {
	const notificationHelper = createNotificationHelper(prisma);

	const getById = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (!id) {
			checklistLogger.error("Checklist ID is required");
			res.status(400).json({ error: "Checklist ID is required" });
			return;
		}

		if (fields && typeof fields !== "string") {
			checklistLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: "Fields must be a string" });
			return;
		}

		checklistLogger.info(`Getting checklist by ID: ${id}`);

		try {
			const query: Prisma.PersonalProblemsChecklistFindFirstArgs = {
				where: {
					id,
					isDeleted: false,
				},
			};

			if (userRole === Role.user) {
				query.where!.userId = requestingUserId;
			}

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
							acc[field.trim()] = true;
						}
						return acc;
					},
					{} as Record<string, any>,
				);

				if (userRole === Role.user) {
					fieldSelections.showResultToStudent = true;
					fieldSelections.checklist_analysis = true;
				}

				query.select = fieldSelections;
			}

			const checklist = await prisma.personalProblemsChecklist.findFirst(query);

			if (!checklist) {
				checklistLogger.error(`Checklist not found: ${id}`);
				res.status(404).json({ error: "Checklist not found" });
				return;
			}

			const shouldHideResults =
				userRole === Role.user && checklist.showResultToStudent === false;
			const responseChecklist = shouldHideResults
				? {
						...checklist,
						checklist_analysis: null,
					}
				: checklist;

			checklistLogger.info(`Checklist retrieved: ${checklist.id}`);
			res.status(200).json(responseChecklist);
		} catch (error) {
			checklistLogger.error(`Error getting checklist: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	const getByUserId = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { userId } = req.params;
		const { fields } = req.query;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (!userId) {
			checklistLogger.error("User ID is required");
			res.status(400).json({ error: "User ID is required" });
			return;
		}

		if (fields && typeof fields !== "string") {
			checklistLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: "Fields must be a string" });
			return;
		}

		checklistLogger.info(`Getting checklist by user ID: ${userId}`);

		try {
			const effectiveUserId =
				userRole === Role.user && requestingUserId ? requestingUserId : userId;
			const query: Prisma.PersonalProblemsChecklistFindFirstArgs = {
				where: {
					userId: effectiveUserId,
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
							acc[field.trim()] = true;
						}
						return acc;
					},
					{} as Record<string, any>,
				);

				if (userRole === Role.user) {
					fieldSelections.showResultToStudent = true;
					fieldSelections.checklist_analysis = true;
				}

				query.select = fieldSelections;
			}

			const checklist = await prisma.personalProblemsChecklist.findFirst(query);

			if (!checklist) {
				checklistLogger.error(`Checklist not found for user: ${userId}`);
				res.status(404).json({ error: "Checklist not found for this user" });
				return;
			}

			const shouldHideResults =
				userRole === Role.user && checklist.showResultToStudent === false;
			const responseChecklist = shouldHideResults
				? {
						...checklist,
						checklist_analysis: null,
					}
				: checklist;

			checklistLogger.info(`Checklist retrieved for user: ${userId}`);
			res.status(200).json(responseChecklist);
		} catch (error) {
			checklistLogger.error(`Error getting checklist by user ID: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	const getAll = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { page = 1, limit = 10, search, fields, userId } = req.query;
		const userRole = req.role;
		const requestingUserId = req.userId;
		const skip = (Number(page) - 1) * Number(limit);

		if (fields && typeof fields !== "string") {
			checklistLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: "Fields must be a string" });
			return;
		}

		checklistLogger.info("Getting all checklists");

		try {
			const where: Prisma.PersonalProblemsChecklistWhereInput = {
				isDeleted: false,
			};

			if (userRole === Role.user) {
				where.userId = requestingUserId;
			} else if (userId && typeof userId === "string") {
				where.userId = userId;
			}

			if (search && typeof search === "string") {
				where.OR = [
					{
						user: {
							person: {
								OR: [
									{
										firstName: {
											contains: search,
											mode: "insensitive",
										},
									},
									{
										lastName: {
											contains: search,
											mode: "insensitive",
										},
									},
								],
							},
						},
					},
				];
			}

			const query: Prisma.PersonalProblemsChecklistFindManyArgs = {
				where,
				skip,
				take: Number(limit),
				orderBy: {
					createdAt: "desc",
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
							acc[field.trim()] = true;
						}
						return acc;
					},
					{} as Record<string, any>,
				);

				if (userRole === Role.user) {
					fieldSelections.showResultToStudent = true;
					fieldSelections.checklist_analysis = true;
				}

				query.select = fieldSelections;
			}

			const [checklists, total] = await Promise.all([
				prisma.personalProblemsChecklist.findMany(query),
				prisma.personalProblemsChecklist.count({ where }),
			]);

			const totalPages = Math.ceil(total / Number(limit));

			const maskedChecklists =
				userRole === Role.user
					? checklists.map((checklist) =>
							checklist.showResultToStudent === false
								? {
										...checklist,
										checklist_analysis: null,
									}
								: checklist,
						)
					: checklists;

			checklistLogger.info(`Retrieved ${checklists.length} checklists`);
			res.status(200).json({
				data: maskedChecklists,
				pagination: {
					page: Number(page),
					limit: Number(limit),
					total,
					totalPages,
					hasNextPage: Number(page) < totalPages,
					hasPrevPage: Number(page) > 1,
				},
			});
		} catch (error) {
			checklistLogger.error(`Error getting checklists: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	const create = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const checklistData = req.body;

		if (!checklistData.userId) {
			checklistLogger.error("User ID is required");
			res.status(400).json({ error: "User ID is required" });
			return;
		}

		checklistLogger.info(`Creating checklist for user: ${checklistData.userId}`);

		try {
			// Check if user exists
			const user = await prisma.user.findUnique({
				where: { id: checklistData.userId },
			});

			if (!user) {
				checklistLogger.error(`User not found: ${checklistData.userId}`);
				res.status(404).json({ error: "User not found" });
				return;
			}

			// Check if checklist already exists for this user
			const existingChecklist = await prisma.personalProblemsChecklist.findFirst({
				where: {
					userId: checklistData.userId,
					isDeleted: false,
				},
			});

			if (existingChecklist) {
				checklistLogger.error(`Checklist already exists for user: ${checklistData.userId}`);
				res.status(409).json({ error: "Checklist already exists for this user" });
				return;
			}

			const checklist = await prisma.personalProblemsChecklist.create({
				data: checklistData,
				include: {
					user: {
						include: {
							person: true,
						},
					},
				},
			});

			// Automatically generate analysis for the new checklist
			const analysis = analyzeChecklistData(checklist);

			// Generate personalized recommendations
			const recommendations = generateRecommendations(analysis);

			// Update the checklist with analysis and recommendations
			const checklistWithAnalysis = await prisma.personalProblemsChecklist.update({
				where: { id: checklist.id },
				data: {
					checklist_analysis: {
						...analysis,
						recommendations,
					},
					analysisGenerated: true,
					analysisUpdatedAt: new Date(),
				},
				include: {
					user: {
						include: {
							person: true,
						},
					},
				},
			});

			// Create notification if high risk
			if (analysis.riskLevel === "high" || analysis.riskLevel === "critical") {
				// Notify the user directly
				await notificationHelper.createNotification({
					type: LogType.notification,
					action: "CHECKLIST_HIGH_RISK_ALERT",
					title: "High Risk Alert - Personal Problems Checklist",
					message: `A personal problems checklist analysis shows ${analysis.riskLevel} risk level. Immediate attention may be required.`,
					userId: checklist.userId,
					entityType: "PersonalProblemsChecklist",
					entityId: checklist.id,
				});

				// Notify counselors or administrators
				const counselors = await prisma.user.findMany({
					where: {
						type: Type.guidance,
						isDeleted: false,
					},
				});

				for (const counselor of counselors) {
					await notificationHelper.createNotification({
						type: LogType.notification,
						action: "STUDENT_HIGH_RISK_ALERT",
						title: "User High Risk Alert",
						message: `User ${checklistWithAnalysis.user?.person?.firstName} ${checklistWithAnalysis.user?.person?.lastName} has a ${analysis.riskLevel} risk level in personal problems checklist.`,
						userId: counselor.id,
						entityType: "PersonalProblemsChecklist",
						entityId: checklist.id,
					});
				}
			}

			checklistLogger.info(`Checklist created with analysis: ${checklist.id}`);
			res.status(201).json(checklistWithAnalysis);
		} catch (error) {
			checklistLogger.error(`Error creating checklist: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	const update = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const updateData = req.body;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (!id) {
			checklistLogger.error("Checklist ID is required");
			res.status(400).json({ error: "Checklist ID is required" });
			return;
		}

		if (updateData?.showResultToStudent !== undefined && userRole === Role.user) {
			checklistLogger.error(
				`User ${requestingUserId} attempted to modify checklist visibility without admin privileges`,
			);
			res.status(403).json({
				error: "Insufficient permissions to modify checklist visibility",
				message: "Only admin and guidance personnel can update checklist visibility",
			});
			return;
		}

		if (
			updateData?.showResultToStudent !== undefined &&
			typeof updateData.showResultToStudent !== "boolean"
		) {
			checklistLogger.error(
				`Invalid showResultToStudent value: ${updateData.showResultToStudent}`,
			);
			res.status(400).json({
				error: "Invalid showResultToStudent value - must be true or false",
			});
			return;
		}

		checklistLogger.info(`Updating checklist: ${id}`);

		try {
			const existingChecklist = await prisma.personalProblemsChecklist.findFirst({
				where: {
					id,
					isDeleted: false,
					...(userRole === Role.user ? { userId: requestingUserId } : {}),
				},
			});

			if (!existingChecklist) {
				checklistLogger.error(`Checklist not found: ${id}`);
				res.status(404).json({ error: "Checklist not found" });
				return;
			}

			const checklist = await prisma.personalProblemsChecklist.update({
				where: { id },
				data: {
					...updateData,
					updatedAt: new Date(),
				},
				include: {
					user: {
						include: {
							person: true,
						},
					},
				},
			});

			checklistLogger.info(`Checklist updated: ${checklist.id}`);
			res.status(200).json(checklist);
		} catch (error) {
			checklistLogger.error(`Error updating checklist: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	const remove = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			checklistLogger.error("Checklist ID is required");
			res.status(400).json({ error: "Checklist ID is required" });
			return;
		}

		checklistLogger.info(`Removing checklist: ${id}`);

		try {
			const existingChecklist = await prisma.personalProblemsChecklist.findFirst({
				where: {
					id,
					isDeleted: false,
				},
			});

			if (!existingChecklist) {
				checklistLogger.error(`Checklist not found: ${id}`);
				res.status(404).json({ error: "Checklist not found" });
				return;
			}

			const checklist = await prisma.personalProblemsChecklist.update({
				where: { id },
				data: {
					isDeleted: true,
					updatedAt: new Date(),
				},
			});

			checklistLogger.info(`Checklist removed: ${checklist.id}`);
			res.status(200).json({ message: "Checklist removed successfully" });
		} catch (error) {
			checklistLogger.error(`Error removing checklist: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	const analyzeChecklist = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			checklistLogger.error("Checklist ID is required");
			res.status(400).json({ error: "Checklist ID is required" });
			return;
		}

		checklistLogger.info(`Analyzing checklist: ${id}`);

		try {
			const checklist = await prisma.personalProblemsChecklist.findFirst({
				where: {
					id,
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

			if (!checklist) {
				checklistLogger.error(`Checklist not found: ${id}`);
				res.status(404).json({ error: "Checklist not found" });
				return;
			}

			// Analyze the checklist data
			const analysis = analyzeChecklistData(checklist);

			// Update the checklist with analysis
			const updatedChecklist = await prisma.personalProblemsChecklist.update({
				where: { id },
				data: {
					checklist_analysis: analysis,
					analysisGenerated: true,
					analysisUpdatedAt: new Date(),
					updatedAt: new Date(),
				},
				include: {
					user: {
						include: {
							person: true,
						},
					},
				},
			});

			// Create notification if high risk
			if (analysis.riskLevel === "high" || analysis.riskLevel === "critical") {
				// Notify the user directly
				await notificationHelper.createNotification({
					type: LogType.notification,
					action: "CHECKLIST_HIGH_RISK_ALERT",
					title: "High Risk Alert - Personal Problems Checklist",
					message: `A personal problems checklist analysis shows ${analysis.riskLevel} risk level. Immediate attention may be required.`,
					userId: checklist.userId,
					entityType: "PersonalProblemsChecklist",
					entityId: checklist.id,
				});

				// Notify counselors or administrators
				const counselors = await prisma.user.findMany({
					where: {
						type: Type.guidance,
						isDeleted: false,
					},
				});

				for (const counselor of counselors) {
					await notificationHelper.createNotification({
						type: LogType.notification,
						action: "STUDENT_HIGH_RISK_ALERT",
						title: "User High Risk Alert",
						message: `User ${checklist.user?.person?.firstName} ${checklist.user?.person?.lastName} has a ${analysis.riskLevel} risk level in personal problems checklist.`,
						userId: counselor.id,
						entityType: "PersonalProblemsChecklist",
						entityId: checklist.id,
					});
				}
			}

			checklistLogger.info(`Checklist analyzed: ${checklist.id}`);
			res.status(200).json(updatedChecklist);
		} catch (error) {
			checklistLogger.error(`Error analyzing checklist: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	const getAnalysisByUserId = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { userId } = req.params;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (!userId) {
			checklistLogger.error("User ID is required");
			res.status(400).json({ error: "User ID is required" });
			return;
		}

		checklistLogger.info(`Getting analysis by user ID: ${userId}`);

		try {
			const effectiveUserId =
				userRole === Role.user && requestingUserId ? requestingUserId : userId;
			const checklist = await prisma.personalProblemsChecklist.findFirst({
				where: {
					userId: effectiveUserId,
					isDeleted: false,
					analysisGenerated: true,
				},
				select: {
					id: true,
					checklist_analysis: true,
					analysisUpdatedAt: true,
					showResultToStudent: true,
					user: {
						select: {
							person: {
								select: {
									firstName: true,
									lastName: true,
								},
							},
						},
					},
				},
			});

			if (!checklist) {
				checklistLogger.error(`No analysis found for user: ${userId}`);
				res.status(404).json({ error: "No checklist analysis found for this user" });
				return;
			}

			const shouldHideResults =
				userRole === Role.user && checklist.showResultToStudent === false;
			const responseChecklist = shouldHideResults
				? {
						...checklist,
						checklist_analysis: null,
						analysisUpdatedAt: null,
					}
				: checklist;

			checklistLogger.info(`Analysis retrieved for user: ${userId}`);
			res.status(200).json(responseChecklist);
		} catch (error) {
			checklistLogger.error(`Error getting analysis by user ID: ${error}`);
			res.status(500).json({ error: "Internal server error" });
		}
	};

	return {
		getById,
		getByUserId,
		getAll,
		create,
		update,
		remove,
		analyzeChecklist,
		getAnalysisByUserId,
	};
};
