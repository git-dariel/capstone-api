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
	const path = "/suicide";

	/**
	 * @openapi
	 * /api/suicide/{id}:
	 *   get:
	 *     summary: Get suicide assessment by id
	 *     description: Get suicide assessment by id with optional fields to include and analysis results. Regular users can only access their own assessments, while admins can access any assessment.
	 *     tags: [Suicide Assessment]
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
	 *         description: Returns suicide assessment data with analysis
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 id:
	 *                   type: string
	 *                 userId:
	 *                   type: string
	 *                 riskLevel:
	 *                   type: string
	 *                   enum: [low, moderate, high]
	 *                 requires_immediate_intervention:
	 *                   type: boolean
	 *                 assessmentDate:
	 *                   type: string
	 *                   format: date-time
	 *                 analysis:
	 *                   type: object
	 *                   properties:
	 *                     riskLevel:
	 *                       type: string
	 *                     requiresImmediateIntervention:
	 *                       type: boolean
	 *                     riskDescription:
	 *                       type: string
	 *                     recommendationMessage:
	 *                       type: string
	 *                     crisisProtocolRequired:
	 *                       type: boolean
	 *                     safetyPlanNeeded:
	 *                       type: boolean
	 *       400:
	 *         description: Missing ID or invalid fields parameter
	 *       404:
	 *         description: Suicide assessment not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/suicide:
	 *   get:
	 *     summary: Get all suicide assessments
	 *     description: Get all suicide assessments with pagination, sorting, field selection, and analysis. Regular users only see their own assessments, while admins can see all assessments and filter by userId.
	 *     tags: [Suicide Assessment]
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
	 *         description: Returns paginated suicide assessments list with total count, page info, and analysis
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
	 *                       wished_dead_or_sleep_not_wake_up:
	 *                         type: string
	 *                         enum: [yes, no]
	 *                       actually_had_thoughts_killing_self:
	 *                         type: string
	 *                         enum: [yes, no]
	 *                       thinking_about_how_might_do_this:
	 *                         type: string
	 *                         enum: [yes, no]
	 *                         nullable: true
	 *                       had_thoughts_and_some_intention:
	 *                         type: string
	 *                         enum: [yes, no]
	 *                         nullable: true
	 *                       started_worked_out_details_how_kill:
	 *                         type: string
	 *                         enum: [yes, no]
	 *                         nullable: true
	 *                       done_anything_started_prepared_end_life:
	 *                         type: string
	 *                         enum: [yes, no]
	 *                         nullable: true
	 *                       behavior_timeframe:
	 *                         type: string
	 *                         enum: [past_three_months, lifetime_but_not_recent, never]
	 *                         nullable: true
	 *                       riskLevel:
	 *                         type: string
	 *                         enum: [low, moderate, high]
	 *                       requires_immediate_intervention:
	 *                         type: boolean
	 *                       assessmentDate:
	 *                         type: string
	 *                         format: date-time
	 *                       analysis:
	 *                         type: object
	 *                         properties:
	 *                           riskLevel:
	 *                             type: string
	 *                           requiresImmediateIntervention:
	 *                             type: boolean
	 *                           riskDescription:
	 *                             type: string
	 *                           crisisProtocolRequired:
	 *                             type: boolean
	 *                           safetyPlanNeeded:
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
	 * /api/suicide:
	 *   post:
	 *     summary: Create CSSRS suicide assessment
	 *     description: Creates a new CSSRS suicide assessment with automatic risk calculation and intervention status. Assessment is automatically linked to the authenticated user.
	 *     tags: [Suicide Assessment]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - wished_dead_or_sleep_not_wake_up
	 *               - actually_had_thoughts_killing_self
	 *             properties:
	 *               wished_dead_or_sleep_not_wake_up:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: "Have you wished you were dead or wished you could go to sleep and not wake up?"
	 *               actually_had_thoughts_killing_self:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: "Have you actually had any thoughts of killing yourself?"
	 *               thinking_about_how_might_do_this:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: "Have you been thinking about how you might do this?"
	 *               had_thoughts_and_some_intention:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: "Have you had these thoughts and had some intention of acting on them?"
	 *               started_worked_out_details_how_kill:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: "Have you started to work out or worked out the details of how to kill yourself? Do you intend to carry out this plan?"
	 *               done_anything_started_prepared_end_life:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: "Have you ever done anything, started to do anything, or prepared to do anything to end your life?"
	 *               behavior_timeframe:
	 *                 type: string
	 *                 enum: [past_three_months, lifetime_but_not_recent, never]
	 *                 description: "Was this within the past three months?"
	 *               assessmentDate:
	 *                 type: string
	 *                 format: date-time
	 *                 description: Date of assessment (defaults to current date)
	 *     responses:
	 *       201:
	 *         description: Returns newly created suicide assessment with risk analysis
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 id:
	 *                   type: string
	 *                 userId:
	 *                   type: string
	 *                 riskLevel:
	 *                   type: string
	 *                   enum: [low, moderate, high]
	 *                 requires_immediate_intervention:
	 *                   type: boolean
	 *                 analysis:
	 *                   type: object
	 *                   properties:
	 *                     riskLevel:
	 *                       type: string
	 *                     requiresImmediateIntervention:
	 *                       type: boolean
	 *                     riskDescription:
	 *                       type: string
	 *                     recommendationMessage:
	 *                       type: string
	 *                     crisisProtocolRequired:
	 *                       type: boolean
	 *                     safetyPlanNeeded:
	 *                       type: boolean
	 *                     riskScore:
	 *                       type: integer
	 *                       description: Risk score based on CSSRS responses
	 *                     responseBreakdown:
	 *                       type: object
	 *                       description: Individual question scores
	 *                     cssrsQuestionFlow:
	 *                       type: object
	 *                       description: Logic for which questions should be asked next
	 *       400:
	 *         description: Missing required fields, invalid user ID, or invalid CSSRS response values
	 *       404:
	 *         description: User not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/", controller.create);

	/**
	 * @openapi
	 * /api/suicide/{id}:
	 *   patch:
	 *     summary: Update suicide assessment
	 *     description: Update suicide assessment data with automatic risk recalculation. Regular users can only update their own assessments, while admins can update any assessment.
	 *     tags: [Suicide Assessment]
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
	 *               wished_dead_or_sleep_not_wake_up:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: "Have you wished you were dead or wished you could go to sleep and not wake up?"
	 *               actually_had_thoughts_killing_self:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: "Have you actually had any thoughts of killing yourself?"
	 *               thinking_about_how_might_do_this:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: "Have you been thinking about how you might do this?"
	 *               had_thoughts_and_some_intention:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: "Have you had these thoughts and had some intention of acting on them?"
	 *               started_worked_out_details_how_kill:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: "Have you started to work out or worked out the details of how to kill yourself? Do you intend to carry out this plan?"
	 *               done_anything_started_prepared_end_life:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: "Have you ever done anything, started to do anything, or prepared to do anything to end your life?"
	 *               behavior_timeframe:
	 *                 type: string
	 *                 enum: [past_three_months, lifetime_but_not_recent, never]
	 *                 description: "Was this within the past three months?"
	 *               assessmentDate:
	 *                 type: string
	 *                 format: date-time
	 *                 description: Date of assessment
	 *     responses:
	 *       200:
	 *         description: Returns updated suicide assessment with recalculated analysis
	 *       400:
	 *         description: Missing ID, no update fields provided, or invalid data
	 *       404:
	 *         description: Suicide assessment not found
	 *       500:
	 *         description: Internal server error
	 *     notes:
	 *       - The updatedAt field is automatically set to the current timestamp
	 *       - If any CSSRS responses are updated, the risk level and intervention status are automatically recalculated
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/suicide/{id}:
	 *   delete:
	 *     summary: Soft delete suicide assessment
	 *     description: Mark suicide assessment as deleted without permanently removing the data. Regular users can only delete their own assessments, while admins can delete any assessment.
	 *     tags: [Suicide Assessment]
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
	 *         description: Suicide assessment marked as deleted successfully
	 *       400:
	 *         description: Missing ID
	 *       404:
	 *         description: Suicide assessment not found
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
