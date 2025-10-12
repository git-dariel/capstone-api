import { Router, Request, Response, NextFunction } from "express";
import multerHelper from "../../helper/multer.helper";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	create(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	remove(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/announcement";

	/**
	 * @openapi
	 * /api/announcement/{id}:
	 *   get:
	 *     summary: Get announcement by id
	 *     description: Get announcement by id with optional fields to include
	 *     tags: [Announcement]
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
	 *         description: Returns announcement data
	 *       400:
	 *         description: Missing ID or invalid fields parameter
	 *       404:
	 *         description: Announcement not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/announcement:
	 *   get:
	 *     summary: Get all announcements
	 *     description: Get all announcements with pagination, sorting, and field selection
	 *     tags: [Announcement]
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
	 *         description: Returns paginated announcements list with total count and page info
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 announcements:
	 *                   type: array
	 *                   items:
	 *                     type: object
	 *                     properties:
	 *                       id:
	 *                         type: string
	 *                       title:
	 *                         type: string
	 *                       description:
	 *                         type: string
	 *                       attachement:
	 *                         type: string
	 *                         nullable: true
	 *                       createdAt:
	 *                         type: string
	 *                         format: date-time
	 *                       updatedAt:
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
	 * /api/announcement:
	 *   post:
	 *     summary: Create announcement
	 *     description: Creates a new announcement entry
	 *     tags: [Announcement]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - title
	 *               - description
	 *             properties:
	 *               title:
	 *                 type: string
	 *                 description: Title of the announcement
	 *               description:
	 *                 type: string
	 *                 description: Description content of the announcement
	 *               attachement:
	 *                 type: string
	 *                 nullable: true
	 *                 description: Optional attachment URL or file path
	 *     responses:
	 *       201:
	 *         description: Returns newly created announcement
	 *       409:
	 *         description: Announcement with same title already exists
	 *       400:
	 *         description: Missing required fields or invalid data
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/", multerHelper.uploadFiles, controller.create);

	/**
	 * @openapi
	 * /api/announcement/{id}:
	 *   patch:
	 *     summary: Update announcement
	 *     description: Update announcement data
	 *     tags: [Announcement]
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
	 *                 description: Title of the announcement
	 *               description:
	 *                 type: string
	 *                 description: Description content of the announcement
	 *               attachement:
	 *                 type: string
	 *                 nullable: true
	 *                 description: Optional attachment URL or file path
	 *     responses:
	 *       200:
	 *         description: Returns updated announcement
	 *       400:
	 *         description: Missing ID, no update fields provided, or invalid data
	 *       404:
	 *         description: Announcement not found
	 *       500:
	 *         description: Internal server error
	 *     notes:
	 *       - The updatedAt field is automatically set to the current timestamp
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/announcement/{id}:
	 *   delete:
	 *     summary: Soft delete announcement
	 *     description: Mark announcement as deleted without permanently removing the data
	 *     tags: [Announcement]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Announcement marked as deleted successfully
	 *       400:
	 *         description: Missing ID
	 *       404:
	 *         description: Announcement not found
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
