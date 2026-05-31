import { NextFunction, Response } from "express";
import { config } from "../../config/error.config";
import {
	Prisma,
	PrismaClient,
	Role,
	RetakeRequestStatus,
	AssessmentType,
} from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { createNotificationHelper } from "../../helper/notification.helper";
import { AuthRequest } from "../../middleware/verifyToken";

const logger = getLogger();
const retakeRequestLogger = logger.child({ module: "retake-request" });

export const controller = (prisma: PrismaClient) => {
	const notificationHelper = createNotificationHelper(prisma);
	const getById = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;
		const userRole = req.role;
		const requestingUserId = req.userId;

		if (!id) {
			retakeRequestLogger.error(config.ERROR.RETAKE_REQUEST.MISSING_ID);
			res.status(400).json({ error: config.ERROR.RETAKE_REQUEST.MISSING_ID });
			return;
		}

		if (fields && typeof fields !== "string") {
			retakeRequestLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.RETAKE_REQUEST.POPULATE_MUST_BE_STRING });
			return;
		}

		retakeRequestLogger.info(`${config.SUCCESS.RETAKE_REQUEST.GETTING_BY_ID}: ${id}`);

		try {
			const query: Prisma.RetakeRequestFindFirstArgs = {
				where: {
					id,
					isDeleted: false,
				},
			};

			// Role-based access control: Regular users can only access their own requests
			if (userRole === Role.user) {
				query.where!.userId = requestingUserId;
			}
			// Admins and super_admins can access all requests (no additional filter needed)

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

			const retakeRequest = await prisma.retakeRequest.findFirst(query);

			if (!retakeRequest) {
				retakeRequestLogger.error(`${config.ERROR.RETAKE_REQUEST.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.RETAKE_REQUEST.NOT_FOUND });
				return;
			}

			retakeRequestLogger.info(
				`${config.SUCCESS.RETAKE_REQUEST.RETRIEVED}: ${retakeRequest.id}`,
			);
			res.status(200).json(retakeRequest);
		} catch (error) {
			retakeRequestLogger.error(
				`${config.ERROR.RETAKE_REQUEST.ERROR_GETTING_REQUEST}: ${error}`,
			);
			res.status(500).json({ error: config.ERROR.RETAKE_REQUEST.INTERNAL_SERVER_ERROR });
		}
	};

	const getAll = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { page = "1", limit = "10", status, assessmentType, userId, fields } = req.query;
		const userRole = req.role;
		const requestingUserId = req.userId;

		const pageNum = parseInt(page as string);
		const limitNum = parseInt(limit as string);

		if (pageNum < 1 || limitNum < 1) {
			retakeRequestLogger.error(config.ERROR.RETAKE_REQUEST.INVALID_PAGE);
			res.status(400).json({ error: config.ERROR.RETAKE_REQUEST.INVALID_PAGE });
			return;
		}

		if (fields && typeof fields !== "string") {
			retakeRequestLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.RETAKE_REQUEST.POPULATE_MUST_BE_STRING });
			return;
		}

		const skip = (pageNum - 1) * limitNum;

		retakeRequestLogger.info(
			`${config.SUCCESS.RETAKE_REQUEST.GETTING_ALL} - Page: ${pageNum}, Limit: ${limitNum}`,
		);

		try {
			const query: Prisma.RetakeRequestFindManyArgs = {
				where: {
					isDeleted: false,
				},
				skip,
				take: limitNum,
				orderBy: { requestedAt: "desc" },
			};

			// Role-based access control: Regular users can only access their own requests
			if (userRole === Role.user) {
				query.where!.userId = requestingUserId;
			}

			// Apply filters
			if (
				status &&
				Object.values(RetakeRequestStatus).includes(status as RetakeRequestStatus)
			) {
				query.where!.status = status as RetakeRequestStatus;
			}
			if (
				assessmentType &&
				Object.values(AssessmentType).includes(assessmentType as AssessmentType)
			) {
				query.where!.assessmentType = assessmentType as AssessmentType;
			}
			if (userId && userRole !== Role.user) {
				query.where!.userId = userId as string;
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
							acc[parts[0]] = true;
						}
						return acc;
					},
					{ id: true } as Record<string, any>,
				);

				query.select = fieldSelections;
			} else {
				query.include = {
					user: {
						include: {
							person: true,
						},
					},
					reviewer: {
						include: {
							person: true,
						},
					},
				};
			}

			const [retakeRequests, total] = await Promise.all([
				prisma.retakeRequest.findMany(query),
				prisma.retakeRequest.count({ where: query.where }),
			]);

			const totalPages = Math.ceil(total / limitNum);

			retakeRequestLogger.info(
				`${config.SUCCESS.RETAKE_REQUEST.RETRIEVED} - Count: ${retakeRequests.length}, Total: ${total}`,
			);

			res.status(200).json({
				requests: retakeRequests,
				pagination: {
					page: pageNum,
					limit: limitNum,
					total,
					totalPages,
					hasNextPage: pageNum < totalPages,
					hasPrevPage: pageNum > 1,
				},
			});
		} catch (error) {
			retakeRequestLogger.error(
				`${config.ERROR.RETAKE_REQUEST.ERROR_GETTING_REQUEST}: ${error}`,
			);
			res.status(500).json({ error: config.ERROR.RETAKE_REQUEST.INTERNAL_SERVER_ERROR });
		}
	};

	const create = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { assessmentType, reason } = req.body;
		const userId = req.userId!; // Use non-null assertion since this is protected route

		if (!assessmentType) {
			retakeRequestLogger.error(config.ERROR.RETAKE_REQUEST.ASSESSMENT_TYPE_REQUIRED);
			res.status(400).json({ error: config.ERROR.RETAKE_REQUEST.ASSESSMENT_TYPE_REQUIRED });
			return;
		}

		if (!Object.values(AssessmentType).includes(assessmentType)) {
			retakeRequestLogger.error(config.ERROR.RETAKE_REQUEST.INVALID_ASSESSMENT_TYPE);
			res.status(400).json({ error: config.ERROR.RETAKE_REQUEST.INVALID_ASSESSMENT_TYPE });
			return;
		}

		if (!reason) {
			retakeRequestLogger.error(config.ERROR.RETAKE_REQUEST.REASON_REQUIRED);
			res.status(400).json({ error: config.ERROR.RETAKE_REQUEST.REASON_REQUIRED });
			return;
		}

		retakeRequestLogger.info(
			`${config.SUCCESS.RETAKE_REQUEST.CREATED} for user: ${userId}, assessment: ${assessmentType}`,
		);

		try {
			// Check if user has pending request for this assessment type
			const existingRequest = await prisma.retakeRequest.findFirst({
				where: {
					userId,
					assessmentType,
					status: RetakeRequestStatus.pending,
					isDeleted: false,
				},
			});

			if (existingRequest) {
				retakeRequestLogger.error(
					`${config.ERROR.RETAKE_REQUEST.EXISTING_PENDING_REQUEST} for user: ${userId}, assessment: ${assessmentType}`,
				);
				res.status(400).json({
					error: config.ERROR.RETAKE_REQUEST.EXISTING_PENDING_REQUEST,
				});
				return;
			}

			const retakeRequest = await prisma.retakeRequest.create({
				data: {
					userId,
					assessmentType,
					reason,
					status: RetakeRequestStatus.pending,
					requestedAt: new Date(),
				},
				include: {
					user: {
						include: {
							person: true,
						},
					},
				},
			});

			retakeRequestLogger.info(
				`${config.SUCCESS.RETAKE_REQUEST.CREATED}: ${retakeRequest.id}`,
			);

			// Create notification for retake request creation
			try {
				await notificationHelper.createRetakeRequestNotification(
					"CREATED",
					retakeRequest.userId,
					retakeRequest.id,
					{
						assessmentType: retakeRequest.assessmentType,
						reason: retakeRequest.reason,
						status: retakeRequest.status,
					},
				);
			} catch (notificationError) {
				retakeRequestLogger.warn(
					`Failed to create retake request notification: ${notificationError}`,
				);
			}

			res.status(201).json(retakeRequest);
		} catch (error) {
			retakeRequestLogger.error(
				`${config.ERROR.RETAKE_REQUEST.ERROR_GETTING_REQUEST}: ${error}`,
			);
			res.status(500).json({ error: config.ERROR.RETAKE_REQUEST.INTERNAL_SERVER_ERROR });
		}
	};

	const update = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { status, reviewerComments } = req.body;
		const reviewerId = req.userId;
		const userRole = req.role;

		if (!id) {
			retakeRequestLogger.error(config.ERROR.RETAKE_REQUEST.MISSING_ID);
			res.status(400).json({ error: config.ERROR.RETAKE_REQUEST.MISSING_ID });
			return;
		}

		if (!status) {
			retakeRequestLogger.error(config.ERROR.RETAKE_REQUEST.STATUS_REQUIRED);
			res.status(400).json({ error: config.ERROR.RETAKE_REQUEST.STATUS_REQUIRED });
			return;
		}

		if (!Object.values(RetakeRequestStatus).includes(status)) {
			retakeRequestLogger.error(config.ERROR.RETAKE_REQUEST.INVALID_STATUS);
			res.status(400).json({ error: config.ERROR.RETAKE_REQUEST.INVALID_STATUS });
			return;
		}

		// Only admin and super_admin can update requests
		if (userRole !== Role.admin && userRole !== Role.super_admin) {
			retakeRequestLogger.error(config.ERROR.RETAKE_REQUEST.PERMISSION_DENIED);
			res.status(403).json({ error: config.ERROR.RETAKE_REQUEST.PERMISSION_DENIED });
			return;
		}

		retakeRequestLogger.info(`${config.SUCCESS.RETAKE_REQUEST.UPDATE}: ${id}`);

		try {
			const existingRequest = await prisma.retakeRequest.findFirst({
				where: {
					id,
					isDeleted: false,
				},
			});

			if (!existingRequest) {
				retakeRequestLogger.error(`${config.ERROR.RETAKE_REQUEST.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.RETAKE_REQUEST.NOT_FOUND });
				return;
			}

			if (existingRequest.status !== RetakeRequestStatus.pending) {
				retakeRequestLogger.error(
					`${config.ERROR.RETAKE_REQUEST.REQUEST_ALREADY_REVIEWED}: ${id}`,
				);
				res.status(400).json({
					error: config.ERROR.RETAKE_REQUEST.REQUEST_ALREADY_REVIEWED,
				});
				return;
			}

			const updatedRequest = await prisma.retakeRequest.update({
				where: { id },
				data: {
					status,
					reviewedBy: reviewerId,
					reviewedAt: new Date(),
					reviewerComments: reviewerComments || null,
				},
				include: {
					user: {
						include: {
							person: true,
						},
					},
					reviewer: {
						include: {
							person: true,
						},
					},
				},
			});

			// If approved, deactivate the cooldown for the specific assessment type
			if (status === RetakeRequestStatus.approved) {
				await deactivateCooldown(existingRequest.userId, existingRequest.assessmentType);
				retakeRequestLogger.info(
					`Cooldown deactivated for user: ${existingRequest.userId}, assessment: ${existingRequest.assessmentType}`,
				);
			}

			retakeRequestLogger.info(
				`${config.SUCCESS.RETAKE_REQUEST.UPDATE}: ${id} to status ${status}`,
			);

			// Create notification for retake request status update
			try {
				let notificationAction: "APPROVED" | "REJECTED" = "APPROVED";
				if (status === RetakeRequestStatus.approved) {
					notificationAction = "APPROVED";
				} else if (status === RetakeRequestStatus.rejected) {
					notificationAction = "REJECTED";
				}

				await notificationHelper.createRetakeRequestNotification(
					notificationAction,
					updatedRequest.userId,
					updatedRequest.id,
					{
						assessmentType: updatedRequest.assessmentType,
						reason: updatedRequest.reason,
						status: updatedRequest.status,
						reviewerComments: updatedRequest.reviewerComments,
					},
				);
			} catch (notificationError) {
				retakeRequestLogger.warn(
					`Failed to create retake request update notification: ${notificationError}`,
				);
			}

			res.status(200).json(updatedRequest);
		} catch (error) {
			retakeRequestLogger.error(
				`${config.ERROR.RETAKE_REQUEST.ERROR_UPDATING_REQUEST}: ${error}`,
			);
			res.status(500).json({ error: config.ERROR.RETAKE_REQUEST.INTERNAL_SERVER_ERROR });
		}
	};

	const remove = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const userRole = req.role;

		if (!id) {
			retakeRequestLogger.error(config.ERROR.RETAKE_REQUEST.MISSING_ID);
			res.status(400).json({ error: config.ERROR.RETAKE_REQUEST.MISSING_ID });
			return;
		}

		// Only admin and super_admin can delete requests
		if (userRole !== Role.admin && userRole !== Role.super_admin) {
			retakeRequestLogger.error(config.ERROR.RETAKE_REQUEST.PERMISSION_DENIED);
			res.status(403).json({ error: config.ERROR.RETAKE_REQUEST.PERMISSION_DENIED });
			return;
		}

		retakeRequestLogger.info(`${config.SUCCESS.RETAKE_REQUEST.SOFT_DELETING}: ${id}`);

		try {
			const existingRequest = await prisma.retakeRequest.findFirst({
				where: {
					id,
					isDeleted: false,
				},
			});

			if (!existingRequest) {
				retakeRequestLogger.error(`${config.ERROR.RETAKE_REQUEST.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.RETAKE_REQUEST.NOT_FOUND });
				return;
			}

			await prisma.retakeRequest.update({
				where: { id },
				data: {
					isDeleted: true,
				},
			});

			retakeRequestLogger.info(`${config.SUCCESS.RETAKE_REQUEST.DELETED}: ${id}`);
			res.status(200).json({ message: config.SUCCESS.RETAKE_REQUEST.DELETED });
		} catch (error) {
			retakeRequestLogger.error(
				`${config.ERROR.RETAKE_REQUEST.ERROR_DELETING_REQUEST}: ${error}`,
			);
			res.status(500).json({ error: config.ERROR.RETAKE_REQUEST.INTERNAL_SERVER_ERROR });
		}
	};

	// Helper function to deactivate cooldown for specific assessment type
	const deactivateCooldown = async (userId: string, assessmentType: AssessmentType) => {
		try {
			let updatePromise;

			switch (assessmentType) {
				case AssessmentType.anxiety:
					updatePromise = prisma.anxietyAssessment.updateMany({
						where: {
							userId,
							isDeleted: false,
							cooldownActive: true,
						},
						data: {
							cooldownActive: false,
						},
					});
					break;
				case AssessmentType.depression:
					updatePromise = prisma.depressionAssessment.updateMany({
						where: {
							userId,
							isDeleted: false,
							cooldownActive: true,
						},
						data: {
							cooldownActive: false,
						},
					});
					break;
				case AssessmentType.stress:
					updatePromise = prisma.stressAssessment.updateMany({
						where: {
							userId,
							isDeleted: false,
							cooldownActive: true,
						},
						data: {
							cooldownActive: false,
						},
					});
					break;
				case AssessmentType.suicide:
					// Suicide assessments don't have cooldown functionality
					retakeRequestLogger.info(
						`Suicide assessments don't have cooldown - user ${userId} assessment type ${assessmentType}`,
					);
					return; // Exit early since no update needed
				default:
					throw new Error(`Unsupported assessment type: ${assessmentType}`);
			}

			if (updatePromise) {
				await updatePromise;
				retakeRequestLogger.info(
					`Cooldown deactivated for user ${userId} assessment type ${assessmentType}`,
				);
			}
		} catch (error) {
			retakeRequestLogger.error(
				`Error deactivating cooldown for user ${userId} assessment type ${assessmentType}: ${error}`,
			);
			throw error;
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
