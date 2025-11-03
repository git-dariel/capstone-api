import { Router, Request, Response, NextFunction } from "express";
import multerHelper from "../../helper/multer.helper";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	remove(req: Request, res: Response, next: NextFunction): Promise<void>;
	exportCsv(req: Request, res: Response, next: NextFunction): Promise<void>;
	uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void>;
	deleteAvatar(req: Request, res: Response, next: NextFunction): Promise<void>;
	exportMentalHealthAssessment(req: Request, res: Response, next: NextFunction): Promise<void>;
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
	 * /api/user/export/mental-health-assessment/{studentId}:
	 *   get:
	 *     summary: Export mental health assessment report as Word document
	 *     description: Generate and download a comprehensive mental health assessment report for a specific student in Word document format. Only accessible by guidance counselors (admin role).
	 *     tags: [User]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: studentId
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The ID of the student for whom to generate the mental health assessment report
	 *         example: "60f1b2b3c8d4e50011234567"
	 *     responses:
	 *       200:
	 *         description: Returns Word document file with mental health assessment report
	 *         content:
	 *           application/vnd.openxmlformats-officedocument.wordprocessingml.document:
	 *             schema:
	 *               type: string
	 *               format: binary
	 *         headers:
	 *           Content-Disposition:
	 *             description: Filename for download
	 *             schema:
	 *               type: string
	 *               example: "attachment; filename=\"Mental_Health_Assessment_John_Doe_2025-11-03.docx\""
	 *       400:
	 *         description: Bad request - Student ID is required
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   example: "Student ID is required"
	 *       401:
	 *         description: Unauthorized - Authentication required
	 *       403:
	 *         description: Forbidden - Admin access required (guidance counselors only)
	 *       404:
	 *         description: Student not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   example: "Student not found"
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   example: "Failed to generate mental health assessment report"
	 *                 details:
	 *                   type: string
	 *                   example: "Template file not found"
	 */
	routes.get(
		"/export/mental-health-assessment/:studentId",
		controller.exportMentalHealthAssessment,
	);

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

	/**
	 * @openapi
	 * /api/user/{id}/avatar:
	 *   post:
	 *     summary: Upload avatar for a user
	 *     description: Upload a single avatar image file for a specific user
	 *     tags: [User]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: ID of the user to upload avatar for
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         multipart/form-data:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               file:
	 *                 type: string
	 *                 format: binary
	 *                 description: Avatar image file to upload
	 *     responses:
	 *       200:
	 *         description: Avatar uploaded successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 avatar:
	 *                   type: object
	 *                   properties:
	 *                     name:
	 *                       type: string
	 *                     url:
	 *                       type: string
	 *                 updatedUser:
	 *                   type: object
	 *                   properties:
	 *                     id:
	 *                       type: string
	 *                     avatar:
	 *                       type: string
	 *       400:
	 *         description: No file provided or missing user ID
	 *       404:
	 *         description: User not found
	 *       500:
	 *         description: Failed to upload avatar
	 */
	routes.post("/avatar", multerHelper.uploadSingle, controller.uploadAvatar);

	/**
	 * @openapi
	 * /api/user/{id}/avatar:
	 *   delete:
	 *     summary: Delete user avatar
	 *     description: Delete the avatar image for a specific user
	 *     tags: [User]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: ID of the user to delete avatar for
	 *     responses:
	 *       200:
	 *         description: Avatar deleted successfully
	 *       404:
	 *         description: User not found
	 */
	routes.delete("/avatar", controller.deleteAvatar);

	route.use(path, routes);

	return route;
};
