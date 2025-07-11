import { Router, Request, Response, NextFunction } from "express";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	remove(req: Request, res: Response, next: NextFunction): Promise<void>;
	exportCsv(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/user";

	/**
	 * @openapi
	 * /api/user/export/csv:
	 *   get:
	 *     summary: Export student data to CSV
	 *     description: Export all student data with their mental health assessments (anxiety, depression, stress, suicide) to CSV format
	 *     tags: [User]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Returns CSV file with student data
	 *         content:
	 *           text/csv:
	 *             schema:
	 *               type: string
	 *               format: binary
	 *       401:
	 *         description: Unauthorized - Admin access required
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/export/csv", controller.exportCsv);

	/**
	 * @openapi
	 * /api/user/{id}:
	 *   get:
	 *     summary: Get user by id
	 *     description: Get user by id with optional select, sort, limit, and populate parameters
	 *     tags: [User]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: query
	 *         name: select
	 *         schema:
	 *           type: string
	 *         description: JSON string of fields to select
	 *       - in: query
	 *         name: sort
	 *         schema:
	 *           type: string
	 *         description: JSON string of sort criteria
	 *       - in: query
	 *         name: limit
	 *         schema:
	 *           type: integer
	 *         description: Number of records to return (default 10)
	 *       - in: query
	 *         name: populate
	 *         schema:
	 *           type: string
	 *         description: JSON string of relations to populate
	 *     responses:
	 *       200:
	 *         description: Returns user data
	 *       404:
	 *         description: User not found
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/user:
	 *   get:
	 *     summary: Get all users
	 *     description: Get all users with pagination, select, sort, limit, and populate options
	 *     tags: [User]
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
	 *         name: select
	 *         schema:
	 *           type: string
	 *         description: JSON string of fields to select
	 *       - in: query
	 *         name: sort
	 *         schema:
	 *           type: string
	 *         description: JSON string of sort criteria
	 *       - in: query
	 *         name: populate
	 *         schema:
	 *           type: string
	 *         description: JSON string of relations to populate
	 *     responses:
	 *       200:
	 *         description: Returns paginated users list
	 */
	routes.get("/", controller.getAll);

	/**
	 * @openapi
	 * /api/user/{id}:
	 *   patch:
	 *     summary: Update user
	 *     description: Update user data by id
	 *     tags: [User]
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
	 *               firstName:
	 *                 type: string
	 *               lastName:
	 *                 type: string
	 *               email:
	 *                 type: string
	 *     responses:
	 *       200:
	 *         description: Returns updated user
	 *       404:
	 *         description: User not found
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/user/{id}:
	 *   put:
	 *     summary: Soft delete user
	 *     description: Mark user as deleted without permanently removing the data
	 *     tags: [User]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: User marked as deleted successfully
	 *       404:
	 *         description: User not found
	 */
	routes.put("/:id", controller.remove);

	route.use(path, routes);

	return route;
};
