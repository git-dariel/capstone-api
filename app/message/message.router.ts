import { Router, Request, Response, NextFunction } from "express";
import verifyToken from "../../middleware/verifyToken";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	create(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	remove(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/message";

	/**
	 * @openapi
	 * /api/message/{id}:
	 *   get:
	 *     summary: Get message by id
	 *     description: Get message by id with optional fields to include
	 *     tags: [Message]
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
	 *         description: Comma-separated list of fields to include
	 *     responses:
	 *       200:
	 *         description: Returns message data
	 *       400:
	 *         description: Missing ID or invalid fields parameter
	 *       404:
	 *         description: Message not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/message:
	 *   get:
	 *     summary: Get all messages
	 *     description: Get all messages with pagination, sorting, and field selection
	 *     tags: [Message]
	 *     parameters:
	 *       - in: query
	 *         name: page
	 *         schema:
	 *           type: integer
	 *           minimum: 1
	 *         description: Page number (default 1)
	 *       - in: query
	 *         name: limit
	 *         schema:
	 *           type: integer
	 *           minimum: 1
	 *         description: Records per page (default 10)
	 *       - in: query
	 *         name: sort
	 *         schema:
	 *           type: string
	 *         description: Field to sort by or JSON string of sort criteria
	 *       - in: query
	 *         name: order
	 *         schema:
	 *           type: string
	 *           enum: [asc, desc]
	 *         description: Sort order (default desc)
	 *       - in: query
	 *         name: fields
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include, supports nested fields with dot notation
	 *       - in: query
	 *         name: query
	 *         schema:
	 *           type: string
	 *         description: Search query to filter results by title or description
	 *     responses:
	 *       200:
	 *         description: Returns paginated messages list with total count and page info
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 messages:
	 *                   type: array
	 *                   items:
	 *                     type: object
	 *                     properties:
	 *                       id:
	 *                         type: string
	 *                       title:
	 *                         type: string
	 *                       content:
	 *                         type: string
	 *                       attachments:
	 *                         type: string
	 *                         nullable: true
	 *                       createdAt:
	 *                         type: string
	 *                         format: date-time
	 *                       isDeleted:
	 *                         type: boolean
	 *                 total:
	 *                   type: integer
	 *                 page:
	 *                   type: integer
	 *                 totalPages:
	 *                   type: integer
	 *       400:
	 *         description: Invalid page, limit, order, fields, or sort parameters
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/", controller.getAll);

	/**
	 * @openapi
	 * /api/message:
	 *   post:
	 *     summary: Create message
	 *     description: Creates a new message entry
	 *     tags: [Message]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - title
	 *               - content
	 *               - senderId
	 *               - receiverId
	 *             properties:
	 *               title:
	 *                 type: string
	 *                 description: Title of the message
	 *               content:
	 *                 type: string
	 *                 description: Content of the message
	 *               attachments:
	 *                 type: string
	 *                 nullable: true
	 *                 description: Optional attachment URL or file path
	 *     responses:
	 *       201:
	 *         description: Returns newly created message
	 *       409:
	 *         description: Message with same title already exists
	 *       400:
	 *         description: Missing required fields or invalid data
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/", verifyToken, controller.create);

	/**
	 * @openapi
	 * /api/message/{id}:
	 *   patch:
	 *     summary: Update message
	 *     description: Update message data
	 *     tags: [Message]
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
	 *               title:
	 *                 type: string
	 *                 description: Title of the message
	 *               content:
	 *                 type: string
	 *                 description: Content of the message
	 *               attachments:
	 *                 type: string
	 *                 nullable: true
	 *                 description: Optional attachment URL or file path
	 *     responses:
	 *       200:
	 *         description: Returns updated message
	 *       400:
	 *         description: Missing ID, no update fields provided, or invalid data
	 *       404:
	 *         description: Message not found
	 *       500:
	 *         description: Internal server error
	 *     notes:
	 *       - The updatedAt field is automatically set to the current timestamp
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/message/{id}:
	 *   delete:
	 *     summary: Soft delete message
	 *     description: Mark message as deleted without permanently removing the data
	 *     tags: [Message]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Message marked as deleted successfully
	 *       400:
	 *         description: Missing ID
	 *       404:
	 *         description: Message not found
	 *       500:
	 *         description: Internal server error
	 *     notes:
	 *       - The updatedAt field is automatically set to the current timestamp
	 *       - The isDeleted field is set to true
	 */
	routes.put("/:id", controller.remove);

	route.use(path, routes);

	return route;
};
