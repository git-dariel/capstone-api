import { NextFunction, Request, Response } from "express";
import { config } from "../../config/error.config";
import { Prisma, PrismaClient } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { emitToUser } from "../../helper/socket.helper";

const logger = getLogger();
const messageLogger = logger.child({ module: "message" });

export const controller = (prisma: PrismaClient) => {
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;
		const userId = (req as any).user?.id || (req as any).userId;

		if (!id) {
			messageLogger.error(config.ERROR.MESSAGE.MISSING_ID);
			res.status(400).json({ error: config.ERROR.MESSAGE.MISSING_ID });
			return;
		}

		if (!userId) {
			messageLogger.error("Authentication required");
			res.status(401).json({ error: "Authentication required" });
			return;
		}

		if (fields && typeof fields !== "string") {
			messageLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.MESSAGE.POPULATE_MUST_BE_STRING });
			return;
		}

		messageLogger.info(`Getting message by id: ${id}`);

		try {
			const query: Prisma.MessageFindFirstArgs = {
				where: {
					id,
					isDeleted: false,
					OR: [{ senderId: userId }, { receiverId: userId }],
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

			const message = await prisma.message.findFirst(query);

			if (!message) {
				messageLogger.error(`Message not found: ${id}`);
				res.status(404).json({ error: config.ERROR.MESSAGE.NOT_FOUND });
				return;
			}

			// Mark as read if user is the receiver
			if (message.receiverId === userId && !message.read) {
				await prisma.message.update({
					where: { id },
					data: { read: true },
				});

				// Emit read status using socket.io
				const io = (req as any).io;
				if (io) {
					emitToUser(io, message.senderId, "message_read", {
						messageId: id,
						readBy: userId,
						readAt: new Date(),
					});
				}
			}

			messageLogger.info(`Retrieved message: ${message.id}`);
			res.status(200).json(message);
		} catch (error) {
			messageLogger.error(`Error getting message: ${error}`);
			res.status(500).json({ error: config.ERROR.MESSAGE.INTERNAL_SERVER_ERROR });
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		const {
			page = 1,
			limit = 10,
			sort,
			fields,
			query,
			order = "desc",
			conversationWith,
		} = req.query;
		const userId = (req as any).user?.id || (req as any).userId;

		if (!userId) {
			messageLogger.error("Authentication required");
			res.status(401).json({ error: "Authentication required" });
			return;
		}

		if (isNaN(Number(page)) || Number(page) < 1) {
			messageLogger.error(`Invalid page: ${page}`);
			res.status(400).json({ error: config.ERROR.MESSAGE.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			messageLogger.error(`Invalid limit: ${limit}`);
			res.status(400).json({ error: config.ERROR.MESSAGE.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			messageLogger.error(`Invalid order: ${order}`);
			res.status(400).json({ error: config.ERROR.MESSAGE.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			messageLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.MESSAGE.POPULATE_MUST_BE_STRING });
			return;
		}

		const skip = (Number(page) - 1) * Number(limit);

		messageLogger.info(
			`Getting messages for user: ${userId}, page: ${page}, limit: ${limit}, query: ${query}, conversationWith: ${conversationWith}, order: ${order}`,
		);

		try {
			// Base filter: only messages involving the authenticated user
			const baseWhereClause: Prisma.MessageWhereInput = {
				isDeleted: false,
				OR: [{ senderId: userId }, { receiverId: userId }],
			};

			// If conversationWith is specified, get messages between current user and that specific user
			const whereClause: Prisma.MessageWhereInput = conversationWith
				? {
						isDeleted: false,
						OR: [
							{ senderId: userId, receiverId: String(conversationWith) },
							{ senderId: String(conversationWith), receiverId: userId },
						],
					}
				: baseWhereClause;

			// Add search query if provided
			if (query) {
				whereClause.AND = [
					whereClause,
					{
						OR: [
							{ content: { contains: String(query) } },
							{ title: { contains: String(query) } },
						],
					},
				];
			}

			const findManyQuery: Prisma.MessageFindManyArgs = {
				where: whereClause,
				skip,
				take: Number(limit),
				orderBy: sort
					? typeof sort === "string" && !sort.startsWith("{")
						? { [sort as string]: order }
						: JSON.parse(sort as string)
					: { createdAt: order as Prisma.SortOrder },
				include: {
					sender: {
						select: {
							id: true,
							userName: true,
							person: {
								select: {
									firstName: true,
									lastName: true,
								},
							},
						},
					},
					receiver: {
						select: {
							id: true,
							userName: true,
							person: {
								select: {
									firstName: true,
									lastName: true,
								},
							},
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

				// Override include with select when fields are specified
				delete findManyQuery.include;
				findManyQuery.select = fieldSelections;
			}

			const [messages, total] = await Promise.all([
				prisma.message.findMany(findManyQuery),
				prisma.message.count({ where: whereClause }),
			]);

			messageLogger.info(`Retrieved ${messages.length} messages for user: ${userId}`);
			res.status(200).json({
				messages,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
				conversationWith: conversationWith ? String(conversationWith) : null,
			});
		} catch (error) {
			messageLogger.error(`Error getting messages: ${error}`);
			res.status(500).json({ error: config.ERROR.MESSAGE.INTERNAL_SERVER_ERROR });
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		const { title, content, attachments, receiverId } = req.body;

		const senderId = (req as any).user?.id || (req as any).userId;

		if (!title || !content || !receiverId) {
			messageLogger.error("Invalid message data");
			res.status(400).json({
				error: config.ERROR.MESSAGE.INVALID_DATA,
			});
			return;
		}

		if (!senderId) {
			messageLogger.error("Unable to get sender ID from authentication token");
			res.status(401).json({ error: "Authentication required" });
			return;
		}

		if (typeof receiverId !== "string" || receiverId.trim().length === 0) {
			messageLogger.error(`Invalid receiverId: ${receiverId}`);
			res.status(400).json({ error: "Invalid receiver ID" });
			return;
		}

		if (typeof title !== "string" || title.trim().length === 0) {
			messageLogger.error(`Invalid title: ${title}`);
			res.status(400).json({ error: config.ERROR.MESSAGE.INVALID_TITLE });
			return;
		}

		if (typeof content !== "string" || content.trim().length === 0) {
			messageLogger.error(`Invalid content: ${content}`);
			res.status(400).json({ error: config.ERROR.MESSAGE.INVALID_CONTENT });
			return;
		}

		// Prevent users from sending messages to themselves
		if (senderId === receiverId) {
			messageLogger.error(`User cannot send message to themselves: ${senderId}`);
			res.status(400).json({ error: "Cannot send message to yourself" });
			return;
		}

		try {
			// Verify sender exists
			const sender = await prisma.user.findFirst({
				where: {
					id: senderId,
					isDeleted: false,
				},
			});

			if (!sender) {
				messageLogger.error(`Sender not found: ${senderId}`);
				res.status(404).json({ error: "Sender not found" });
				return;
			}

			// Verify receiver exists
			const receiver = await prisma.user.findFirst({
				where: {
					id: receiverId,
					isDeleted: false,
				},
			});

			if (!receiver) {
				messageLogger.error(`Receiver not found: ${receiverId}`);
				res.status(404).json({ error: "Receiver not found" });
				return;
			}

			const newMessage = await prisma.message.create({
				data: {
					sender: {
						connect: { id: senderId },
					},
					receiver: {
						connect: { id: receiverId },
					},
					title: title.trim(),
					content: content.trim(),
					attachments: attachments || [],
					read: false,
					isDeleted: false,
				},
				include: {
					sender: {
						select: {
							id: true,
							userName: true,
							person: {
								select: {
									firstName: true,
									lastName: true,
								},
							},
						},
					},
					receiver: {
						select: {
							id: true,
							userName: true,
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

			const io = (req as any).io;
			if (io) {
				console.log(`Emitting new_message to user_${receiverId}:`, newMessage.title);

				// Notify the receiver about the new message
				emitToUser(io, receiverId, "new_message", {
					message: newMessage,
					from: newMessage.senderId,
					timestamp: new Date(),
				});

				console.log(`Emitting message_sent to user_${senderId}`);

				// Notify the sender that the message was sent
				emitToUser(io, senderId, "message_sent", {
					message: newMessage,
					to: newMessage.receiverId,
					timestamp: new Date(),
				});
			} else {
				console.error("Socket.IO instance not available");
			}

			messageLogger.info(`Created message: ${newMessage.id}`);
			res.status(201).json(newMessage);
		} catch (error) {
			messageLogger.error(`Error creating message: ${error}`);
			res.status(500).json({ error: config.ERROR.MESSAGE.INTERNAL_SERVER_ERROR });
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { title, content, attachments, read } = req.body;

		if (!id) {
			messageLogger.error(config.ERROR.MESSAGE.MISSING_ID);
			res.status(400).json({ error: config.ERROR.MESSAGE.MISSING_ID });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			messageLogger.error("No update fields provided");
			res.status(400).json({
				error: config.ERROR.MESSAGE.AT_LEAST_ONE_FIELD_REQUIRED,
			});
			return;
		}

		if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
			messageLogger.error(`Invalid title: ${title}`);
			res.status(400).json({ error: config.ERROR.MESSAGE.INVALID_TITLE });
			return;
		}

		if (content !== undefined && (typeof content !== "string" || content.trim().length === 0)) {
			messageLogger.error(`Invalid content: ${content}`);
			res.status(400).json({ error: config.ERROR.MESSAGE.INVALID_CONTENT });
			return;
		}

		// Validate read status if provided
		if (read !== undefined && typeof read !== "boolean") {
			messageLogger.error(`Invalid read status: ${read}`);
			res.status(400).json({
				error: `Invalid read status. Must be a boolean.`,
			});
			return;
		}

		messageLogger.info(`Updating message: ${id}`);

		try {
			const existingMessage = await prisma.message.findUnique({
				where: { id },
			});

			if (!existingMessage) {
				messageLogger.error(`Message not found: ${id}`);
				res.status(404).json({ error: config.ERROR.MESSAGE.NOT_FOUND });
				return;
			}

			if (existingMessage.isDeleted) {
				messageLogger.error(`Cannot update deleted message: ${id}`);
				res.status(400).json({ error: "Cannot update deleted message" });
				return;
			}

			const updateData: Prisma.MessageUpdateInput = {};

			if (title) updateData.title = title.trim();
			if (content) updateData.content = content.trim();
			if (attachments !== undefined) updateData.attachments = attachments || null;
			if (read !== undefined) updateData.read = read;

			const updatedMessage = await prisma.message.update({
				where: { id },
				data: updateData,
			});

			const io = (req as any).io;
			if (io) {
				const updateEvent = {
					messageId: id,
					updatedFields: Object.keys(req.body),
					message: updatedMessage,
					timestamp: new Date(),
				};

				emitToUser(io, updatedMessage.senderId, "message_updated", updateEvent);
				emitToUser(io, updatedMessage.receiverId, "message_updated", updateEvent);
			}

			messageLogger.info(`Updated message: ${updatedMessage.id}`);
			res.status(200).json(updatedMessage);
		} catch (error) {
			messageLogger.error(`Error updating message: ${error}`);
			res.status(500).json({ error: config.ERROR.MESSAGE.INTERNAL_SERVER_ERROR });
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			messageLogger.error("Missing message ID");
			res.status(400).json({ error: config.ERROR.MESSAGE.MISSING_ID });
			return;
		}

		messageLogger.info(`Soft deleting message: ${id}`);

		try {
			const existingMessage = await prisma.message.findUnique({
				where: { id },
			});

			if (!existingMessage) {
				messageLogger.error(`Message not found: ${id}`);
				res.status(404).json({ error: config.ERROR.MESSAGE.NOT_FOUND });
				return;
			}

			await prisma.message.update({
				where: { id },
				data: {
					isDeleted: true,
				},
			});

			const io = (req as any).io;
			if (io) {
				const deleteEvent = {
					messageId: id,
					timestamp: new Date(),
				};

				emitToUser(io, existingMessage.senderId, "message_deleted", deleteEvent);
				emitToUser(io, existingMessage.receiverId, "message_deleted", deleteEvent);
			}

			messageLogger.info(`Deleted message: ${id}`);
			res.status(200).json({ message: "Message deleted successfully" });
		} catch (error) {
			messageLogger.error(`Error deleting message: ${error}`);
			res.status(500).json({ error: config.ERROR.MESSAGE.INTERNAL_SERVER_ERROR });
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
