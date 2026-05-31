import { Router, Request, Response, NextFunction } from "express";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	create(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	remove(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/retake-request";
	/**
	 * @openapi
	 * /api/retake-request:
	 *   post:
	 *     summary: Create a new retake request
	 *     description: Allow students to request a retake when assessments are in cooldown
	 *     tags: [Retake Request]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - assessmentType
	 *               - reason
	 *             properties:
	 *               assessmentType:
	 *                 type: string
	 *                 enum: [anxiety, depression, stress, suicide]
	 *                 description: Type of assessment to retake
	 *               reason:
	 *                 type: string
	 *                 description: Reason for requesting the retake
	 *               lastAssessmentId:
	 *                 type: string
	 *                 description: ID of the last assessment taken
	 *               cooldownExpiry:
	 *                 type: string
	 *                 format: date-time
	 *                 description: When the current cooldown expires
	 *     responses:
	 *       201:
	 *         description: Retake request created successfully
	 *       400:
	 *         description: Invalid input or missing required fields
	 *       409:
	 *         description: Pending request already exists for this assessment type
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/", controller.create);
	/**
	 * @openapi
	 * /api/retake-request:
	 *   get:
	 *     summary: Get all retake requests (Admin only)
	 *     description: Retrieve all retake requests with filtering and pagination
	 *     tags: [Retake Request]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: query
	 *         name: page
	 *         schema:
	 *           type: integer
	 *           default: 1
	 *         description: Page number for pagination
	 *       - in: query
	 *         name: limit
	 *         schema:
	 *           type: integer
	 *           default: 10
	 *         description: Number of items per page
	 *       - in: query
	 *         name: status
	 *         schema:
	 *           type: string
	 *           enum: [pending, approved, rejected]
	 *         description: Filter by request status
	 *       - in: query
	 *         name: assessmentType
	 *         schema:
	 *           type: string
	 *           enum: [anxiety, depression, stress, suicide]
	 *         description: Filter by assessment type
	 *       - in: query
	 *         name: userId
	 *         schema:
	 *           type: string
	 *         description: Filter by user ID
	 *     responses:
	 *       200:
	 *         description: List of retake requests retrieved successfully
	 *       403:
	 *         description: Access denied - Admin role required
	 *       500:
	 *         description: Internal server error
	 */ routes.get("/", controller.getAll);
	/**
	 * @openapi
	 * /api/retake-request/{id}:
	 *   get:
	 *     summary: Get retake request by ID
	 *     description: Retrieve a specific retake request by ID
	 *     tags: [Retake Request]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Retake request ID
	 *     responses:
	 *       200:
	 *         description: Retake request retrieved successfully
	 *       403:
	 *         description: Access denied
	 *       404:
	 *         description: Retake request not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/:id", controller.getById);
	/**
	 * @openapi
	 * /api/retake-request/{id}:
	 *   patch:
	 *     summary: Update retake request status (Admin only)
	 *     description: Approve or reject a retake request
	 *     tags: [Retake Request]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Retake request ID
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - status
	 *             properties:
	 *               status:
	 *                 type: string
	 *                 enum: [approved, rejected]
	 *                 description: New status for the request
	 *               reviewerComments:
	 *                 type: string
	 *                 description: Comments from the reviewer
	 *     responses:
	 *       200:
	 *         description: Retake request updated successfully
	 *       400:
	 *         description: Invalid status or request cannot be updated
	 *       403:
	 *         description: Access denied - Admin role required
	 *       404:
	 *         description: Retake request not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.patch("/:id", controller.update);
	/**
	 * @openapi
	 * /api/retake-request/{id}:
	 *   delete:
	 *     summary: Delete retake request (Admin only)
	 *     description: Soft delete a retake request
	 *     tags: [Retake Request]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Retake request ID
	 *     responses:
	 *       200:
	 *         description: Retake request deleted successfully
	 *       403:
	 *         description: Access denied - Admin role required
	 *       404:
	 *         description: Retake request not found
	 *       500:
	 *         description: Internal server error
	 */ routes.delete("/:id", controller.remove);

	route.use(path, routes);

	return route;
};
