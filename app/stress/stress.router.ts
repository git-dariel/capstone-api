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
	const path = "/stress";

	/**
	 * @openapi
	 * /api/stress/{id}:
	 *   get:
	 *     summary: Get stress assessment by id
	 *     description: Get stress assessment by id with optional fields to include and analysis results. Regular users can only access their own assessments, while admins can access any assessment.
	 *     tags: [Stress Assessment]
	 *     security:
	 *       - bearerAuth: []
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
	 *         description: Returns stress assessment data with analysis
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 id:
	 *                   type: string
	 *                 userId:
	 *                   type: string
	 *                 totalScore:
	 *                   type: integer
	 *                   minimum: 0
	 *                   maximum: 40
	 *                 severityLevel:
	 *                   type: string
	 *                   enum: [low, moderate, high]
	 *                 assessmentDate:
	 *                   type: string
	 *                   format: date-time
	 *                 analysis:
	 *                   type: object
	 *                   properties:
	 *                     totalScore:
	 *                       type: integer
	 *                     severityLevel:
	 *                       type: string
	 *                     severityDescription:
	 *                       type: string
	 *                     recommendationMessage:
	 *                       type: string
	 *                     needsProfessionalHelp:
	 *                       type: boolean
	 *       400:
	 *         description: Missing ID or invalid fields parameter
	 *       404:
	 *         description: Stress assessment not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/stress:
	 *   get:
	 *     summary: Get all stress assessments
	 *     description: Get all stress assessments with pagination, sorting, field selection, and analysis. Regular users only see their own assessments, while admins can see all assessments and filter by userId.
	 *     tags: [Stress Assessment]
	 *     security:
	 *       - bearerAuth: []
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
	 *         description: Search query to filter results by user name or person name
	 *       - in: query
	 *         name: userId
	 *         schema:
	 *           type: string
	 *         description: Filter assessments by specific user ID (admin/super_admin only - regular users automatically see only their own data)
	 *     responses:
	 *       200:
	 *         description: Returns paginated stress assessments list with total count, page info, and analysis
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 assessments:
	 *                   type: array
	 *                   items:
	 *                     type: object
	 *                     properties:
	 *                       id:
	 *                         type: string
	 *                       userId:
	 *                         type: string
	 *                       upset_because_something_unexpected:
	 *                         type: string
	 *                         enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                       unable_control_important_things:
	 *                         type: string
	 *                         enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                       feeling_nervous_and_stressed:
	 *                         type: string
	 *                         enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                       confident_handle_personal_problems:
	 *                         type: string
	 *                         enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                       feeling_things_going_your_way:
	 *                         type: string
	 *                         enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                       unable_cope_with_all_things:
	 *                         type: string
	 *                         enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                       able_control_irritations:
	 *                         type: string
	 *                         enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                       feeling_on_top_of_things:
	 *                         type: string
	 *                         enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                       angered_things_outside_control:
	 *                         type: string
	 *                         enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                       difficulties_piling_up_cant_overcome:
	 *                         type: string
	 *                         enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                       totalScore:
	 *                         type: integer
	 *                         minimum: 0
	 *                         maximum: 40
	 *                       severityLevel:
	 *                         type: string
	 *                         enum: [low, moderate, high]
	 *                       assessmentDate:
	 *                         type: string
	 *                         format: date-time
	 *                       analysis:
	 *                         type: object
	 *                         properties:
	 *                           totalScore:
	 *                             type: integer
	 *                           severityLevel:
	 *                             type: string
	 *                           severityDescription:
	 *                             type: string
	 *                           needsProfessionalHelp:
	 *                             type: boolean
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
	 * /api/stress:
	 *   post:
	 *     summary: Create PSS-10 stress assessment
	 *     description: Creates a new PSS-10 stress assessment with automatic scoring and severity calculation. Assessment is automatically linked to the authenticated user.
	 *     tags: [Stress Assessment]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - upset_because_something_unexpected
	 *               - unable_control_important_things
	 *               - feeling_nervous_and_stressed
	 *               - confident_handle_personal_problems
	 *               - feeling_things_going_your_way
	 *               - unable_cope_with_all_things
	 *               - able_control_irritations
	 *               - feeling_on_top_of_things
	 *               - angered_things_outside_control
	 *               - difficulties_piling_up_cant_overcome
	 *             properties:
	 *               upset_because_something_unexpected:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you been upset because of something that happened unexpectedly? (0-4 scale)"
	 *               unable_control_important_things:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you felt that you were unable to control the important things in your life? (0-4 scale)"
	 *               feeling_nervous_and_stressed:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you felt nervous and stressed? (0-4 scale)"
	 *               confident_handle_personal_problems:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you felt confident about your ability to handle your personal problems? (0-4 scale, reverse scored)"
	 *               feeling_things_going_your_way:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you felt that things were going your way? (0-4 scale, reverse scored)"
	 *               unable_cope_with_all_things:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you found that you could not cope with all the things that you had to do? (0-4 scale)"
	 *               able_control_irritations:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you been able to control irritations in your life? (0-4 scale, reverse scored)"
	 *               feeling_on_top_of_things:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you felt that you were on top of things? (0-4 scale, reverse scored)"
	 *               angered_things_outside_control:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you been angered because of things that happened that were outside of your control? (0-4 scale)"
	 *               difficulties_piling_up_cant_overcome:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you felt that difficulties were piling up so high that you could not overcome them? (0-4 scale)"
	 *               assessmentDate:
	 *                 type: string
	 *                 format: date-time
	 *                 description: Date of assessment (defaults to current date)
	 *     responses:
	 *       201:
	 *         description: Returns newly created stress assessment with scoring analysis
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 id:
	 *                   type: string
	 *                 userId:
	 *                   type: string
	 *                 totalScore:
	 *                   type: integer
	 *                   minimum: 0
	 *                   maximum: 40
	 *                 severityLevel:
	 *                   type: string
	 *                   enum: [low, moderate, high]
	 *                 analysis:
	 *                   type: object
	 *                   properties:
	 *                     totalScore:
	 *                       type: integer
	 *                     severityLevel:
	 *                       type: string
	 *                     severityDescription:
	 *                       type: string
	 *                     recommendationMessage:
	 *                       type: string
	 *                     needsProfessionalHelp:
	 *                       type: boolean
	 *                     scoreBreakdown:
	 *                       type: object
	 *                       description: Individual question scores (0-4 each, with reverse scoring applied)
	 *       400:
	 *         description: Missing required fields, invalid user ID, or invalid PSS-10 response values
	 *       404:
	 *         description: User not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/", controller.create);

	/**
	 * @openapi
	 * /api/stress/{id}:
	 *   patch:
	 *     summary: Update stress assessment
	 *     description: Update stress assessment data with automatic score recalculation. Regular users can only update their own assessments, while admins can update any assessment.
	 *     tags: [Stress Assessment]
	 *     security:
	 *       - bearerAuth: []
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
	 *               upset_because_something_unexpected:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you been upset because of something that happened unexpectedly? (0-4 scale)"
	 *               unable_control_important_things:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you felt that you were unable to control the important things in your life? (0-4 scale)"
	 *               feeling_nervous_and_stressed:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you felt nervous and stressed? (0-4 scale)"
	 *               confident_handle_personal_problems:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you felt confident about your ability to handle your personal problems? (0-4 scale, reverse scored)"
	 *               feeling_things_going_your_way:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you felt that things were going your way? (0-4 scale, reverse scored)"
	 *               unable_cope_with_all_things:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you found that you could not cope with all the things that you had to do? (0-4 scale)"
	 *               able_control_irritations:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you been able to control irritations in your life? (0-4 scale, reverse scored)"
	 *               feeling_on_top_of_things:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you felt that you were on top of things? (0-4 scale, reverse scored)"
	 *               angered_things_outside_control:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you been angered because of things that happened that were outside of your control? (0-4 scale)"
	 *               difficulties_piling_up_cant_overcome:
	 *                 type: string
	 *                 enum: [never, almost_never, sometimes, fairly_often, very_often]
	 *                 description: "How often have you felt that difficulties were piling up so high that you could not overcome them? (0-4 scale)"
	 *               assessmentDate:
	 *                 type: string
	 *                 format: date-time
	 *                 description: Date of assessment
	 *     responses:
	 *       200:
	 *         description: Returns updated stress assessment with recalculated analysis
	 *       400:
	 *         description: Missing ID, no update fields provided, or invalid data
	 *       404:
	 *         description: Stress assessment not found
	 *       500:
	 *         description: Internal server error
	 *     notes:
	 *       - The updatedAt field is automatically set to the current timestamp
	 *       - If any PSS-10 responses are updated, the total score and severity level are automatically recalculated
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/stress/{id}:
	 *   delete:
	 *     summary: Soft delete stress assessment
	 *     description: Mark stress assessment as deleted without permanently removing the data. Regular users can only delete their own assessments, while admins can delete any assessment.
	 *     tags: [Stress Assessment]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Stress assessment marked as deleted successfully
	 *       400:
	 *         description: Missing ID
	 *       404:
	 *         description: Stress assessment not found
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
