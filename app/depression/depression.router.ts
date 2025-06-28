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
	const path = "/depression";

	/**
	 * @openapi
	 * /api/depression/{id}:
	 *   get:
	 *     summary: Get depression assessment by id
	 *     description: Get depression assessment by id with optional fields to include and analysis results. Regular users can only access their own assessments, while admins can access any assessment.
	 *     tags: [Depression Assessment]
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
	 *         description: Returns depression assessment data with analysis
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
	 *                   maximum: 27
	 *                 severityLevel:
	 *                   type: string
	 *                   enum: [minimal, mild, moderate, moderately_severe, severe]
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
	 *                     requiresImmediateAttention:
	 *                       type: boolean
	 *       400:
	 *         description: Missing ID or invalid fields parameter
	 *       404:
	 *         description: Depression assessment not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/depression:
	 *   get:
	 *     summary: Get all depression assessments
	 *     description: Get all depression assessments with pagination, sorting, field selection, and analysis. Regular users only see their own assessments, while admins can see all assessments and filter by userId.
	 *     tags: [Depression Assessment]
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
	 *         description: Returns paginated depression assessments list with total count, page info, and analysis
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
	 *                       little_interest_pleasure_doing_things:
	 *                         type: string
	 *                         enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                       feeling_down_depressed_hopeless:
	 *                         type: string
	 *                         enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                       trouble_falling_staying_asleep_too_much:
	 *                         type: string
	 *                         enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                       feeling_tired_having_little_energy:
	 *                         type: string
	 *                         enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                       poor_appetite_overeating:
	 *                         type: string
	 *                         enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                       feeling_bad_about_yourself_failure:
	 *                         type: string
	 *                         enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                       trouble_concentrating_things:
	 *                         type: string
	 *                         enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                       moving_speaking_slowly_fidgety_restless:
	 *                         type: string
	 *                         enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                       thoughts_better_off_dead_hurting_yourself:
	 *                         type: string
	 *                         enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                       totalScore:
	 *                         type: integer
	 *                         minimum: 0
	 *                         maximum: 27
	 *                       severityLevel:
	 *                         type: string
	 *                         enum: [minimal, mild, moderate, moderately_severe, severe]
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
	 *                           requiresImmediateAttention:
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
	 * /api/depression:
	 *   post:
	 *     summary: Create PHQ-9 depression assessment
	 *     description: Creates a new PHQ-9 depression assessment with automatic scoring and severity calculation. Assessment is automatically linked to the authenticated user.
	 *     tags: [Depression Assessment]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - little_interest_pleasure_doing_things
	 *               - feeling_down_depressed_hopeless
	 *               - trouble_falling_staying_asleep_too_much
	 *               - feeling_tired_having_little_energy
	 *               - poor_appetite_overeating
	 *               - feeling_bad_about_yourself_failure
	 *               - trouble_concentrating_things
	 *               - moving_speaking_slowly_fidgety_restless
	 *               - thoughts_better_off_dead_hurting_yourself
	 *             properties:
	 *               little_interest_pleasure_doing_things:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Little interest or pleasure in doing things (0-3 scale)"
	 *               feeling_down_depressed_hopeless:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Feeling down, depressed, or hopeless (0-3 scale)"
	 *               trouble_falling_staying_asleep_too_much:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Trouble falling or staying asleep, or sleeping too much (0-3 scale)"
	 *               feeling_tired_having_little_energy:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Feeling tired or having little energy (0-3 scale)"
	 *               poor_appetite_overeating:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Poor appetite or overeating (0-3 scale)"
	 *               feeling_bad_about_yourself_failure:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Feeling bad about yourself or that you are a failure or have let yourself or your family down (0-3 scale)"
	 *               trouble_concentrating_things:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Trouble concentrating on things, such as reading the newspaper or watching television (0-3 scale)"
	 *               moving_speaking_slowly_fidgety_restless:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Moving or speaking so slowly that other people could have noticed, or being so fidgety or restless that you have been moving around a lot more than usual (0-3 scale)"
	 *               thoughts_better_off_dead_hurting_yourself:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Thoughts that you would be better off dead, or of hurting yourself (0-3 scale) - CRITICAL for safety assessment"
	 *               difficulty_level:
	 *                 type: string
	 *                 enum: [not_difficult_at_all, somewhat_difficult, very_difficult, extremely_difficult]
	 *                 description: "How difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?"
	 *               assessmentDate:
	 *                 type: string
	 *                 format: date-time
	 *                 description: Date of assessment (defaults to current date)
	 *     responses:
	 *       201:
	 *         description: Returns newly created depression assessment with scoring analysis
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
	 *                   maximum: 27
	 *                 severityLevel:
	 *                   type: string
	 *                   enum: [minimal, mild, moderate, moderately_severe, severe]
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
	 *                     requiresImmediateAttention:
	 *                       type: boolean
	 *                     suicidalIdeationDetected:
	 *                       type: boolean
	 *                     scoreBreakdown:
	 *                       type: object
	 *                       description: Individual question scores (0-3 each)
	 *       400:
	 *         description: Missing required fields, invalid user ID, or invalid PHQ-9 response values
	 *       404:
	 *         description: User not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/", controller.create);

	/**
	 * @openapi
	 * /api/depression/{id}:
	 *   patch:
	 *     summary: Update depression assessment
	 *     description: Update depression assessment data with automatic score recalculation. Regular users can only update their own assessments, while admins can update any assessment.
	 *     tags: [Depression Assessment]
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
	 *               little_interest_pleasure_doing_things:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Little interest or pleasure in doing things (0-3 scale)"
	 *               feeling_down_depressed_hopeless:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Feeling down, depressed, or hopeless (0-3 scale)"
	 *               trouble_falling_staying_asleep_too_much:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Trouble falling or staying asleep, or sleeping too much (0-3 scale)"
	 *               feeling_tired_having_little_energy:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Feeling tired or having little energy (0-3 scale)"
	 *               poor_appetite_overeating:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Poor appetite or overeating (0-3 scale)"
	 *               feeling_bad_about_yourself_failure:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Feeling bad about yourself or that you are a failure or have let yourself or your family down (0-3 scale)"
	 *               trouble_concentrating_things:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Trouble concentrating on things, such as reading the newspaper or watching television (0-3 scale)"
	 *               moving_speaking_slowly_fidgety_restless:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Moving or speaking so slowly that other people could have noticed, or being so fidgety or restless that you have been moving around a lot more than usual (0-3 scale)"
	 *               thoughts_better_off_dead_hurting_yourself:
	 *                 type: string
	 *                 enum: [not_at_all, several_days, more_than_half_days, nearly_every_day]
	 *                 description: "Thoughts that you would be better off dead, or of hurting yourself (0-3 scale) - CRITICAL for safety assessment"
	 *               difficulty_level:
	 *                 type: string
	 *                 enum: [not_difficult_at_all, somewhat_difficult, very_difficult, extremely_difficult]
	 *                 description: "How difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?"
	 *               assessmentDate:
	 *                 type: string
	 *                 format: date-time
	 *                 description: Date of assessment
	 *     responses:
	 *       200:
	 *         description: Returns updated depression assessment with recalculated analysis
	 *       400:
	 *         description: Missing ID, no update fields provided, or invalid data
	 *       404:
	 *         description: Depression assessment not found
	 *       500:
	 *         description: Internal server error
	 *     notes:
	 *       - The updatedAt field is automatically set to the current timestamp
	 *       - If any PHQ-9 responses are updated, the total score and severity level are automatically recalculated
	 *       - Suicidal ideation is automatically flagged for immediate attention
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/depression/{id}:
	 *   delete:
	 *     summary: Soft delete depression assessment
	 *     description: Mark depression assessment as deleted without permanently removing the data. Regular users can only delete their own assessments, while admins can delete any assessment.
	 *     tags: [Depression Assessment]
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
	 *         description: Depression assessment marked as deleted successfully
	 *       400:
	 *         description: Missing ID
	 *       404:
	 *         description: Depression assessment not found
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
