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
	const path = "/anxiety";

	/**
	 * @openapi
	 * /api/anxiety/{id}:
	 *   get:
	 *     summary: Get anxiety assessment by id
	 *     description: Get anxiety assessment by id with optional fields to include and analysis results. Regular users can only access their own assessments, while admins can access any assessment.
	 *     tags: [Anxiety Assessment]
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
	 *         description: Returns anxiety assessment data with analysis
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 id:
	 *                   type: string
	 *                 studentId:
	 *                   type: string
	 *                 totalScore:
	 *                   type: integer
	 *                   minimum: 0
	 *                   maximum: 21
	 *                 severityLevel:
	 *                   type: string
	 *                   enum: [minimal, mild, moderate, severe]
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
	 *         description: Anxiety assessment not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/anxiety:
	 *   get:
	 *     summary: Get all anxiety assessments
	 *     description: Get all anxiety assessments with pagination, sorting, field selection, and analysis. Regular users only see their own assessments, while admins can see all assessments and filter by userId.
	 *     tags: [Anxiety Assessment]
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
	 *         description: Returns paginated anxiety assessments list with total count, page info, and analysis
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
	 *                       feeling_nervous_anxious_edge:
	 *                         type: string
	 *                         enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                       not_able_stop_control_worrying:
	 *                         type: string
	 *                         enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                       worrying_too_much_different_things:
	 *                         type: string
	 *                         enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                       trouble_relaxing:
	 *                         type: string
	 *                         enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                       restless_hard_sit_still:
	 *                         type: string
	 *                         enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                       easily_annoyed_irritable:
	 *                         type: string
	 *                         enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                       feeling_afraid_awful_happen:
	 *                         type: string
	 *                         enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                       totalScore:
	 *                         type: integer
	 *                         minimum: 0
	 *                         maximum: 21
	 *                       severityLevel:
	 *                         type: string
	 *                         enum: [minimal, mild, moderate, severe]
	 *                       difficulty_level:
	 *                         type: string
	 *                         enum: [not_difficult_at_all, somewhat_difficult, very_difficult, extremely_difficult]
	 *                         nullable: true
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
	 * /api/anxiety:
	 *   post:
	 *     summary: Create GAD-7 anxiety assessment
	 *     description: Creates a new GAD-7 anxiety assessment with automatic scoring and severity calculation. Assessment is automatically linked to the authenticated user.
	 *     tags: [Anxiety Assessment]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - userId
	 *               - feeling_nervous_anxious_edge
	 *               - not_able_stop_control_worrying
	 *               - worrying_too_much_different_things
	 *               - trouble_relaxing
	 *               - restless_hard_sit_still
	 *               - easily_annoyed_irritable
	 *               - feeling_afraid_awful_happen
	 *             properties:
	 *               userId:
	 *                 type: string
	 *                 description: ID of the user taking the assessment
	 *               feeling_nervous_anxious_edge:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Feeling nervous, anxious, or on edge (0-3 scale)"
	 *               not_able_stop_control_worrying:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Not being able to stop or control worrying (0-3 scale)"
	 *               worrying_too_much_different_things:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Worrying too much about different things (0-3 scale)"
	 *               trouble_relaxing:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Trouble relaxing (0-3 scale)"
	 *               restless_hard_sit_still:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Being so restless that it's hard to sit still (0-3 scale)"
	 *               easily_annoyed_irritable:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Becoming easily annoyed or irritable (0-3 scale)"
	 *               feeling_afraid_awful_happen:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Feeling afraid as if something awful might happen (0-3 scale)"
	 *               difficulty_level:
	 *                 type: string
	 *                 enum: [not_difficult_at_all, somewhat_difficult, very_difficult, extremely_difficult]
	 *                 nullable: true
	 *                 description: "How difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?"
	 *               assessmentDate:
	 *                 type: string
	 *                 format: date-time
	 *                 description: Date of assessment (defaults to current date)
	 *     responses:
	 *       201:
	 *         description: Returns newly created anxiety assessment with scoring analysis
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 id:
	 *                   type: string
	 *                 studentId:
	 *                   type: string
	 *                 totalScore:
	 *                   type: integer
	 *                   minimum: 0
	 *                   maximum: 21
	 *                 severityLevel:
	 *                   type: string
	 *                   enum: [minimal, mild, moderate, severe]
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
	 *                       description: Individual question scores (0-3 each)
	 *       400:
	 *         description: Missing required fields, invalid user ID, or invalid GAD-7 response values
	 *       404:
	 *         description: User not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/", controller.create);

	/**
	 * @openapi
	 * /api/anxiety/{id}:
	 *   patch:
	 *     summary: Update anxiety assessment
	 *     description: Update anxiety assessment data with automatic score recalculation. Regular users can only update their own assessments, while admins can update any assessment.
	 *     tags: [Anxiety Assessment]
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
	 *               feeling_nervous_anxious_edge:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Feeling nervous, anxious, or on edge (0-3 scale)"
	 *               not_able_stop_control_worrying:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Not being able to stop or control worrying (0-3 scale)"
	 *               worrying_too_much_different_things:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Worrying too much about different things (0-3 scale)"
	 *               trouble_relaxing:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Trouble relaxing (0-3 scale)"
	 *               restless_hard_sit_still:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Being so restless that it's hard to sit still (0-3 scale)"
	 *               easily_annoyed_irritable:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Becoming easily annoyed or irritable (0-3 scale)"
	 *               feeling_afraid_awful_happen:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Feeling afraid as if something awful might happen (0-3 scale)"
	 *               difficulty_level:
	 *                 type: string
	 *                 enum: [not_difficult_at_all, somewhat_difficult, very_difficult, extremely_difficult]
	 *                 nullable: true
	 *                 description: "How difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?"
	 *               assessmentDate:
	 *                 type: string
	 *                 format: date-time
	 *                 description: Date of assessment
	 *     responses:
	 *       200:
	 *         description: Returns updated anxiety assessment with recalculated analysis
	 *       400:
	 *         description: Missing ID, no update fields provided, or invalid data
	 *       404:
	 *         description: Anxiety assessment not found
	 *       500:
	 *         description: Internal server error
	 *     notes:
	 *       - The updatedAt field is automatically set to the current timestamp
	 *       - If any GAD-7 responses are updated, the total score and severity level are automatically recalculated
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/anxiety/{id}:
	 *   delete:
	 *     summary: Soft delete anxiety assessment
	 *     description: Mark anxiety assessment as deleted without permanently removing the data. Regular users can only delete their own assessments, while admins can delete any assessment.
	 *     tags: [Anxiety Assessment]
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
	 *         description: Anxiety assessment marked as deleted successfully
	 *       400:
	 *         description: Missing ID
	 *       404:
	 *         description: Anxiety assessment not found
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
