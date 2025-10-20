import { Router, Request, Response, NextFunction } from "express";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getByUserId(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	create(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	remove(req: Request, res: Response, next: NextFunction): Promise<void>;
	analyzeChecklist(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAnalysisByUserId(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/checklist";

	/**
	 * @openapi
	 * /api/checklist/{id}:
	 *   get:
	 *     summary: Get personal problems checklist by id
	 *     description: Get personal problems checklist by id with optional field selection using dot notation
	 *     tags: [Checklist]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Checklist ID
	 *       - in: query
	 *         name: fields
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include (supports dot notation for nested fields like "student.person.firstName")
	 *         example: "id,name,age,gender,student.studentNumber,student.person.firstName"
	 *     responses:
	 *       200:
	 *         description: Returns checklist data
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/PersonalProblemsChecklist'
	 *       400:
	 *         description: Missing ID or invalid fields parameter
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *       404:
	 *         description: Checklist not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/checklist/user/{userId}:
	 *   get:
	 *     summary: Get personal problems checklist by user ID
	 *     description: Get personal problems checklist by user ID with optional field selection
	 *     tags: [Checklist]
	 *     parameters:
	 *       - in: path
	 *         name: userId
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: User ID
	 *       - in: query
	 *         name: fields
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include
	 *         example: "id,name,age,checklist_analysis"
	 *     responses:
	 *       200:
	 *         description: Returns checklist data for the student
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/PersonalProblemsChecklist'
	 *       400:
	 *         description: Missing user ID or invalid fields parameter
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *       404:
	 *         description: Checklist not found for this user
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 */
	routes.get("/user/:userId", controller.getByUserId);

	/**
	 * @openapi
	 * /api/checklist/user/{userId}/analysis:
	 *   get:
	 *     summary: Get checklist analysis by user ID
	 *     description: Get the analysis results of personal problems checklist for a specific user
	 *     tags: [Checklist]
	 *     parameters:
	 *       - in: path
	 *         name: userId
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: User ID
	 *     responses:
	 *       200:
	 *         description: Returns checklist analysis data
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 id:
	 *                   type: string
	 *                 checklist_analysis:
	 *                   $ref: '#/components/schemas/ChecklistAnalysis'
	 *                 analysisUpdatedAt:
	 *                   type: string
	 *                   format: date-time
	 *                 user:
	 *                   type: object
	 *                   properties:
	 *                     person:
	 *                       type: object
	 *                       properties:
	 *                         firstName:
	 *                           type: string
	 *                         lastName:
	 *                           type: string
	 *       400:
	 *         description: Missing user ID
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *       404:
	 *         description: No checklist analysis found for this user
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 */
	routes.get("/user/:userId/analysis", controller.getAnalysisByUserId);

	/**
	 * @openapi
	 * /api/checklist:
	 *   get:
	 *     summary: Get all personal problems checklists with pagination
	 *     description: Get all personal problems checklists with pagination, search, and field selection
	 *     tags: [Checklist]
	 *     parameters:
	 *       - in: query
	 *         name: page
	 *         schema:
	 *           type: integer
	 *           default: 1
	 *         description: Page number
	 *       - in: query
	 *         name: limit
	 *         schema:
	 *           type: integer
	 *           default: 10
	 *         description: Number of items per page
	 *       - in: query
	 *         name: search
	 *         schema:
	 *           type: string
	 *         description: Search term to filter by name or student name
	 *       - in: query
	 *         name: fields
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include
	 *         example: "id,name,age,student.person.firstName"
	 *     responses:
	 *       200:
	 *         description: Returns paginated checklist data
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 data:
	 *                   type: array
	 *                   items:
	 *                     $ref: '#/components/schemas/PersonalProblemsChecklist'
	 *                 pagination:
	 *                   type: object
	 *                   properties:
	 *                     page:
	 *                       type: integer
	 *                     limit:
	 *                       type: integer
	 *                     total:
	 *                       type: integer
	 *                     totalPages:
	 *                       type: integer
	 *                     hasNextPage:
	 *                       type: boolean
	 *                     hasPrevPage:
	 *                       type: boolean
	 *       400:
	 *         description: Invalid fields parameter
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 */
	routes.get("/", controller.getAll);

	/**
	 * @openapi
	 * /api/checklist:
	 *   post:
	 *     summary: Create a new personal problems checklist
	 *     description: Create a new personal problems checklist for a student
	 *     tags: [Checklist]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - studentId
	 *               - name
	 *               - age
	 *               - gender
	 *             properties:
	 *               studentId:
	 *                 type: string
	 *                 description: ID of the student
	 *               name:
	 *                 type: string
	 *                 description: Name of the student
	 *               age:
	 *                 type: integer
	 *                 description: Age of the student
	 *               gender:
	 *                 type: string
	 *                 description: Gender of the student
	 *               social_friends_problems:
	 *                 $ref: '#/components/schemas/SocialFriendsProblems'
	 *               appearance_problems:
	 *                 $ref: '#/components/schemas/AppearanceProblems'
	 *               attitude_opinion_problems:
	 *                 $ref: '#/components/schemas/AttitudeOpinionProblems'
	 *               parents_problems:
	 *                 $ref: '#/components/schemas/ParentsProblems'
	 *               family_home_problems:
	 *                 $ref: '#/components/schemas/FamilyHomeProblems'
	 *               school_problems:
	 *                 $ref: '#/components/schemas/SchoolProblems'
	 *               money_problems:
	 *                 $ref: '#/components/schemas/MoneyProblems'
	 *               religion_problems:
	 *                 $ref: '#/components/schemas/ReligionProblems'
	 *               emotional_problems:
	 *                 $ref: '#/components/schemas/EmotionalProblems'
	 *               dating_sex_problems:
	 *                 $ref: '#/components/schemas/DatingSexProblems'
	 *     responses:
	 *       201:
	 *         description: Checklist created successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/PersonalProblemsChecklist'
	 *       400:
	 *         description: Missing required fields
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *       404:
	 *         description: Student not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *       409:
	 *         description: Checklist already exists for this student
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 */
	routes.post("/", controller.create);

	/**
	 * @openapi
	 * /api/checklist/{id}:
	 *   put:
	 *     summary: Update a personal problems checklist
	 *     description: Update an existing personal problems checklist
	 *     tags: [Checklist]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Checklist ID
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               name:
	 *                 type: string
	 *               age:
	 *                 type: integer
	 *               gender:
	 *                 type: string
	 *               social_friends_problems:
	 *                 $ref: '#/components/schemas/SocialFriendsProblems'
	 *               appearance_problems:
	 *                 $ref: '#/components/schemas/AppearanceProblems'
	 *               attitude_opinion_problems:
	 *                 $ref: '#/components/schemas/AttitudeOpinionProblems'
	 *               parents_problems:
	 *                 $ref: '#/components/schemas/ParentsProblems'
	 *               family_home_problems:
	 *                 $ref: '#/components/schemas/FamilyHomeProblems'
	 *               school_problems:
	 *                 $ref: '#/components/schemas/SchoolProblems'
	 *               money_problems:
	 *                 $ref: '#/components/schemas/MoneyProblems'
	 *               religion_problems:
	 *                 $ref: '#/components/schemas/ReligionProblems'
	 *               emotional_problems:
	 *                 $ref: '#/components/schemas/EmotionalProblems'
	 *               dating_sex_problems:
	 *                 $ref: '#/components/schemas/DatingSexProblems'
	 *     responses:
	 *       200:
	 *         description: Checklist updated successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/PersonalProblemsChecklist'
	 *       400:
	 *         description: Missing checklist ID
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *       404:
	 *         description: Checklist not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 */
	routes.put("/:id", controller.update);

	/**
	 * @openapi
	 * /api/checklist/{id}/analyze:
	 *   post:
	 *     summary: Analyze a personal problems checklist
	 *     description: Analyze a personal problems checklist and generate risk assessment
	 *     tags: [Checklist]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Checklist ID
	 *     responses:
	 *       200:
	 *         description: Checklist analyzed successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/PersonalProblemsChecklist'
	 *       400:
	 *         description: Missing checklist ID
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *       404:
	 *         description: Checklist not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 */
	routes.post("/:id/analyze", controller.analyzeChecklist);

	/**
	 * @openapi
	 * /api/checklist/{id}:
	 *   delete:
	 *     summary: Delete a personal problems checklist
	 *     description: Soft delete a personal problems checklist (sets isDeleted to true)
	 *     tags: [Checklist]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Checklist ID
	 *     responses:
	 *       200:
	 *         description: Checklist deleted successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *       400:
	 *         description: Missing checklist ID
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *       404:
	 *         description: Checklist not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 */
	routes.put("/:id", controller.remove);

	route.use(path, routes);

	return route;
};
