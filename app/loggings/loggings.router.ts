import { Router, Request, Response, NextFunction } from "express";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	create(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	markAsRead(req: Request, res: Response, next: NextFunction): Promise<void>;
	remove(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/loggings";

	/**
	 * @openapi
	 * /api/loggings/{id}:
	 *   get:
	 *     summary: Get log by id
	 *     description: Get log by id with optional select, sort, limit, and populate parameters
	 *     tags: [Loggings]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: query
	 *         name: fields
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to select
	 *     responses:
	 *       200:
	 *         description: Returns log data
	 *       404:
	 *         description: Log not found
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/loggings:
	 *   get:
	 *     summary: Get all logs
	 *     description: Get all logs with pagination, select, sort, limit, and filter options
	 *     tags: [Loggings]
	 *     parameters:
	 *       - in: query
	 *         name: page
	 *         schema:
	 *           type: integer
	 *         description: Page number (default 1)
	 *       - in: query
	 *         name: limit
	 *         schema:
	 *           type: integer
	 *         description: Records per page (default 10)
	 *       - in: query
	 *         name: fields
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to select
	 *       - in: query
	 *         name: sort
	 *         schema:
	 *           type: string
	 *         description: JSON string of sort criteria or field name
	 *       - in: query
	 *         name: order
	 *         schema:
	 *           type: string
	 *           enum: [asc, desc]
	 *         description: Sort order (default desc)
	 *       - in: query
	 *         name: query
	 *         schema:
	 *           type: string
	 *         description: Search query for title, message, action, or entityType
	 *       - in: query
	 *         name: type
	 *         schema:
	 *           type: string
	 *           enum: [activity, audit, notification]
	 *         description: Filter by log type
	 *       - in: query
	 *         name: status
	 *         schema:
	 *           type: string
	 *           enum: [pending, success, failed, read, unread]
	 *         description: Filter by log status
	 *       - in: query
	 *         name: severity
	 *         schema:
	 *           type: string
	 *           enum: [critical, high, medium, low, info]
	 *         description: Filter by log severity
	 *       - in: query
	 *         name: userId
	 *         schema:
	 *           type: string
	 *         description: Filter by user ID
	 *     responses:
	 *       200:
	 *         description: Returns paginated logs list
	 */
	routes.get("/", controller.getAll);

	/**
	 * @openapi
	 * /api/loggings:
	 *   post:
	 *     summary: Create a new log
	 *     description: Create a new log entry
	 *     tags: [Loggings]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - type
	 *               - action
	 *               - title
	 *               - userId
	 *             properties:
	 *               type:
	 *                 type: string
	 *                 enum: [activity, audit, notification]
	 *               action:
	 *                 type: string
	 *                 description: Action performed (e.g., LOGIN, CREATE, DELETE)
	 *               title:
	 *                 type: string
	 *                 description: Log title
	 *               message:
	 *                 type: string
	 *                 description: Optional log message
	 *               userId:
	 *                 type: string
	 *                 description: ID of the user who performed the action
	 *               entityType:
	 *                 type: string
	 *                 description: Type of entity affected (e.g., User, Insurance)
	 *               entityId:
	 *                 type: string
	 *                 description: ID of the entity affected
	 *               data:
	 *                 type: object
	 *                 description: Additional data in JSON format
	 *               status:
	 *                 type: string
	 *                 enum: [pending, success, failed, read, unread]
	 *                 description: Log status (default pending)
	 *               severity:
	 *                 type: string
	 *                 enum: [critical, high, medium, low, info]
	 *                 description: Log severity (default info)
	 *     responses:
	 *       201:
	 *         description: Returns created log
	 *       400:
	 *         description: Invalid data provided
	 */
	routes.post("/", controller.create);

	/**
	 * @openapi
	 * /api/loggings/{id}:
	 *   patch:
	 *     summary: Update log
	 *     description: Update log data by id
	 *     tags: [Loggings]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     requestBody:
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               type:
	 *                 type: string
	 *                 enum: [activity, audit, notification]
	 *               action:
	 *                 type: string
	 *               title:
	 *                 type: string
	 *               message:
	 *                 type: string
	 *               entityType:
	 *                 type: string
	 *               entityId:
	 *                 type: string
	 *               data:
	 *                 type: object
	 *               status:
	 *                 type: string
	 *                 enum: [pending, success, failed, read, unread]
	 *               severity:
	 *                 type: string
	 *                 enum: [critical, high, medium, low, info]
	 *     responses:
	 *       200:
	 *         description: Returns updated log
	 *       404:
	 *         description: Log not found
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/loggings/{id}/read:
	 *   patch:
	 *     summary: Mark log as read
	 *     description: Mark a log as read and set the readAt timestamp
	 *     tags: [Loggings]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Log marked as read successfully
	 *       404:
	 *         description: Log not found
	 */
	routes.patch("/:id/read", controller.markAsRead);

	/**
	 * @openapi
	 * /api/loggings/{id}:
	 *   delete:
	 *     summary: Delete log
	 *     description: Permanently delete a log entry
	 *     tags: [Loggings]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Log deleted successfully
	 *       404:
	 *         description: Log not found
	 */
	routes.delete("/:id", controller.remove);

	route.use(path, routes);

	return route;
};
