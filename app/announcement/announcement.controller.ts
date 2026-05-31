import { NextFunction, Request, Response } from "express";
import { config } from "../../config/error.config";
import { Prisma, PrismaClient, AnnouncementStatus } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import cloudinaryService from "../../helper/cloudinary.helper";

const logger = getLogger();
const announcementLogger = logger.child({ module: "announcement" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		if (!id) {
			announcementLogger.error(config.ERROR.ANNOUNCEMENT.MISSING_ID);
			res.status(400).json({ error: config.ERROR.ANNOUNCEMENT.MISSING_ID });
			return;
		}

		if (fields && typeof fields !== "string") {
			announcementLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.ANNOUNCEMENT.POPULATE_MUST_BE_STRING });
			return;
		}

		announcementLogger.info(`Getting announcement by id: ${id}`);

		try {
			const query: Prisma.AnnouncementFindFirstArgs = {
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

			const announcement = await prisma.announcement.findFirst(query);

			if (!announcement) {
				announcementLogger.error(`Announcement not found: ${id}`);
				res.status(404).json({ error: config.ERROR.ANNOUNCEMENT.NOT_FOUND });
				return;
			}

			announcementLogger.info(`Retrieved announcement: ${announcement.id}`);
			res.status(200).json(announcement);
		} catch (error) {
			announcementLogger.error(`Error getting announcement: ${error}`);
			res.status(500).json({ error: config.ERROR.ANNOUNCEMENT.INTERNAL_SERVER_ERROR });
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		const { page = 1, limit = 10, sort, fields, query, order = "desc" } = req.query;

		if (isNaN(Number(page)) || Number(page) < 1) {
			announcementLogger.error(`Invalid page: ${page}`);
			res.status(400).json({ error: config.ERROR.ANNOUNCEMENT.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			announcementLogger.error(`Invalid limit: ${limit}`);
			res.status(400).json({ error: config.ERROR.ANNOUNCEMENT.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			announcementLogger.error(`Invalid order: ${order}`);
			res.status(400).json({ error: config.ERROR.ANNOUNCEMENT.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			announcementLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.ANNOUNCEMENT.POPULATE_MUST_BE_STRING });
			return;
		}

		const skip = (Number(page) - 1) * Number(limit);

		announcementLogger.info(
			`Getting all announcements, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
		);

		try {
			const whereClause: Prisma.AnnouncementWhereInput = {
				isDeleted: false,
				...(query
					? {
							OR: [
								{ title: { contains: String(query) } },
								{ description: { contains: String(query) } },
							],
						}
					: {}),
			};

			const findManyQuery: Prisma.AnnouncementFindManyArgs = {
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
			}

			const [announcements, total] = await Promise.all([
				prisma.announcement.findMany(findManyQuery),
				prisma.announcement.count({ where: whereClause }),
			]);

			announcementLogger.info(`Retrieved ${announcements.length} announcements`);
			res.status(200).json({
				announcements,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			announcementLogger.error(`Error getting announcements: ${error}`);
			res.status(500).json({ error: config.ERROR.ANNOUNCEMENT.INTERNAL_SERVER_ERROR });
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		const { title, description, status } = req.body;
		const files = req.files as Express.Multer.File[];

		if (!title || !description) {
			announcementLogger.error("Invalid announcement data");
			res.status(400).json({
				error: config.ERROR.ANNOUNCEMENT.INVALID_DATA,
			});
			return;
		}

		if (typeof title !== "string" || title.trim().length === 0) {
			announcementLogger.error(`Invalid title: ${title}`);
			res.status(400).json({ error: config.ERROR.ANNOUNCEMENT.INVALID_TITLE });
			return;
		}

		if (typeof description !== "string" || description.trim().length === 0) {
			announcementLogger.error(`Invalid description: ${description}`);
			res.status(400).json({ error: config.ERROR.ANNOUNCEMENT.INVALID_DESCRIPTION });
			return;
		}

		// Validate status if provided
		if (status && !Object.values(AnnouncementStatus).includes(status)) {
			announcementLogger.error(`Invalid status: ${status}`);
			res.status(400).json({
				error: `Invalid status. Must be one of: ${Object.values(AnnouncementStatus).join(", ")}`,
			});
			return;
		}

		try {
			const existingAnnouncement = await prisma.announcement.findFirst({
				where: {
					title,
					isDeleted: false,
				},
			});

			if (existingAnnouncement) {
				announcementLogger.info(`Announcement already exists: ${existingAnnouncement.id}`);
				res.status(409).json({
					...existingAnnouncement,
					message: config.ERROR.ANNOUNCEMENT.EXISTING_ANNOUNCEMENT,
				});
				return;
			}

			// Proces file uploads
			let attachments: {
				name: string;
				url: string;
			}[] = [];

			if (files && files.length > 0) {
				announcementLogger.info(`Processing ${files.length} attachments`);

				const uploadPromises = files.map(async (file) => {
					try {
						const uploadResult = await cloudinaryService.uploadAttachment(
							file,
							`announcement/${Date.now()}`,
						);

						return {
							name: uploadResult.filename,
							url: uploadResult.url,
						};
					} catch (error) {
						announcementLogger.error(
							`Error uploading file ${file.originalname}: ${error}`,
						);
						throw error;
					}
				});

				try {
					attachments = await Promise.all(uploadPromises);
					announcementLogger.info(
						`Successfully uploaded ${attachments.length} attachments`,
					);
				} catch (error) {
					announcementLogger.error(`Error uploading attachments: ${error}`);
					res.status(500).json({ error: "Failed to upload attachments" });
					return;
				}
			}

			const newAnnouncement = await prisma.announcement.create({
				data: {
					title: title.trim(),
					description: description.trim(),
					attachement: attachments,
					status: status || AnnouncementStatus.academic,
					updatedAt: new Date(),
					isDeleted: false,
				},
			});

			announcementLogger.info(`Created announcement: ${newAnnouncement.id}`);
			res.status(201).json(newAnnouncement);
		} catch (error) {
			announcementLogger.error(`Error creating announcement: ${error}`);
			res.status(500).json({ error: config.ERROR.ANNOUNCEMENT.INTERNAL_SERVER_ERROR });
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { title, description, attachement, status } = req.body;

		if (!id) {
			announcementLogger.error(config.ERROR.ANNOUNCEMENT.MISSING_ID);
			res.status(400).json({ error: config.ERROR.ANNOUNCEMENT.MISSING_ID });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			announcementLogger.error("No update fields provided");
			res.status(400).json({
				error: config.ERROR.ANNOUNCEMENT.AT_LEAST_ONE_FIELD_REQUIRED,
			});
			return;
		}

		if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
			announcementLogger.error(`Invalid title: ${title}`);
			res.status(400).json({ error: config.ERROR.ANNOUNCEMENT.INVALID_TITLE });
			return;
		}

		if (
			description !== undefined &&
			(typeof description !== "string" || description.trim().length === 0)
		) {
			announcementLogger.error(`Invalid description: ${description}`);
			res.status(400).json({ error: config.ERROR.ANNOUNCEMENT.INVALID_DESCRIPTION });
			return;
		}

		// Validate status if provided
		if (status !== undefined && !Object.values(AnnouncementStatus).includes(status)) {
			announcementLogger.error(`Invalid status: ${status}`);
			res.status(400).json({
				error: `Invalid status. Must be one of: ${Object.values(AnnouncementStatus).join(", ")}`,
			});
			return;
		}

		announcementLogger.info(`Updating announcement: ${id}`);

		try {
			const existingAnnouncement = await prisma.announcement.findUnique({
				where: { id },
			});

			if (!existingAnnouncement) {
				announcementLogger.error(`Announcement not found: ${id}`);
				res.status(404).json({ error: config.ERROR.ANNOUNCEMENT.NOT_FOUND });
				return;
			}

			const updateData: Prisma.AnnouncementUpdateInput = {
				updatedAt: new Date(),
			};

			if (title) updateData.title = title.trim();
			if (description) updateData.description = description.trim();
			if (attachement !== undefined) updateData.attachement = attachement || null;
			if (status !== undefined) updateData.status = status;

			const updatedAnnouncement = await prisma.announcement.update({
				where: { id },
				data: updateData,
			});

			announcementLogger.info(`Updated announcement: ${updatedAnnouncement.id}`);
			res.status(200).json(updatedAnnouncement);
		} catch (error) {
			announcementLogger.error(`Error updating announcement: ${error}`);
			res.status(500).json({ error: config.ERROR.ANNOUNCEMENT.INTERNAL_SERVER_ERROR });
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			announcementLogger.error("Missing announcement ID");
			res.status(400).json({ error: config.ERROR.ANNOUNCEMENT.MISSING_ID });
			return;
		}

		announcementLogger.info(`Soft deleting announcement: ${id}`);

		try {
			const existingAnnouncement = await prisma.announcement.findUnique({
				where: { id },
			});

			if (!existingAnnouncement) {
				announcementLogger.error(`Announcement not found: ${id}`);
				res.status(404).json({ error: config.ERROR.ANNOUNCEMENT.NOT_FOUND });
				return;
			}

			await prisma.announcement.update({
				where: { id },
				data: {
					isDeleted: true,
					updatedAt: new Date(),
				},
			});

			announcementLogger.info(`Deleted announcement: ${id}`);
			res.status(200).json({ message: "Announcement deleted successfully" });
		} catch (error) {
			announcementLogger.error(`Error deleting announcement: ${error}`);
			res.status(500).json({ error: config.ERROR.ANNOUNCEMENT.INTERNAL_SERVER_ERROR });
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
