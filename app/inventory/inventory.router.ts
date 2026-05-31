import { Router, Request, Response, NextFunction } from "express";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getByStudentId(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	create(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	remove(req: Request, res: Response, next: NextFunction): Promise<void>;
	predictMentalHealth(req: Request, res: Response, next: NextFunction): Promise<void>;
	getPredictionByStudentId(req: Request, res: Response, next: NextFunction): Promise<void>;
	getReminderInfoByStudentId(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/inventory";

	/**
	 * @openapi
	 * /api/inventory/{id}:
	 *   get:
	 *     summary: Get individual inventory by id
	 *     description: Get individual inventory by id with optional field selection using dot notation
	 *     tags: [Inventory]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Inventory ID
	 *       - in: query
	 *         name: fields
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include (supports dot notation for nested fields like "student.person.firstName")
	 *         example: "id,height,weight,student.studentNumber,student.person.firstName"
	 *     responses:
	 *       200:
	 *         description: Returns inventory data
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/IndividualInventory'
	 *       400:
	 *         description: Missing ID or invalid fields parameter
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   examples:
	 *                     - "Missing inventory ID"
	 *                     - "Populate parameter must be a comma-separated string"
	 *       404:
	 *         description: Inventory not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   example: "Individual inventory not found"
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/inventory/student/{studentId}:
	 *   get:
	 *     summary: Get inventory by student ID
	 *     description: Get inventory data for a specific student with optional field selection
	 *     tags: [Inventory]
	 *     parameters:
	 *       - in: path
	 *         name: studentId
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Student ID
	 *       - in: query
	 *         name: fields
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include (supports dot notation for nested fields like "student.person.firstName")
	 *         example: "id,height,weight,student.studentNumber,student.person.firstName"
	 *     responses:
	 *       200:
	 *         description: Returns inventory data for the student
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/IndividualInventory'
	 *       400:
	 *         description: Missing student ID or invalid fields parameter
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   examples:
	 *                     - "Student ID is required"
	 *                     - "Populate parameter must be a comma-separated string"
	 *       404:
	 *         description: Inventory not found for this student
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   example: "Individual inventory not found for this student"
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/student/:studentId", controller.getByStudentId);

	/**
	 * @openapi
	 * /api/inventory:
	 *   get:
	 *     summary: Get all individual inventories
	 *     description: Get all individual inventories with pagination, sorting, field selection, and search functionality
	 *     tags: [Inventory]
	 *     parameters:
	 *       - in: query
	 *         name: page
	 *         schema:
	 *           type: integer
	 *           minimum: 1
	 *           default: 1
	 *         description: Page number
	 *       - in: query
	 *         name: limit
	 *         schema:
	 *           type: integer
	 *           minimum: 1
	 *           default: 10
	 *         description: Records per page
	 *       - in: query
	 *         name: sort
	 *         schema:
	 *           type: string
	 *         description: Field to sort by or JSON string of sort criteria
	 *         example: "createdAt"
	 *       - in: query
	 *         name: order
	 *         schema:
	 *           type: string
	 *           enum: [asc, desc]
	 *           default: desc
	 *         description: Sort order
	 *       - in: query
	 *         name: fields
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include, supports nested fields with dot notation
	 *         example: "id,height,weight,student.studentNumber,student.person.firstName"
	 *       - in: query
	 *         name: query
	 *         schema:
	 *           type: string
	 *         description: Search query to filter results by height, weight, complexion, student number, program, or person name
	 *         example: "5'8"
	 *     responses:
	 *       200:
	 *         description: Returns paginated inventories list with total count and page info
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 inventories:
	 *                   type: array
	 *                   items:
	 *                     $ref: '#/components/schemas/IndividualInventory'
	 *                 total:
	 *                   type: integer
	 *                   description: Total number of inventories
	 *                 page:
	 *                   type: integer
	 *                   description: Current page number
	 *                 totalPages:
	 *                   type: integer
	 *                   description: Total number of pages
	 *       400:
	 *         description: Invalid parameters
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   examples:
	 *                     - "Invalid page number"
	 *                     - "Invalid limit"
	 *                     - "Order must be either 'asc' or 'desc'"
	 *                     - "Populate parameter must be a comma-separated string"
	 *                     - "Sort parameter must be a valid JSON string or field name"
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/", controller.getAll);

	/**
	 * @openapi
	 * /api/inventory:
	 *   post:
	 *     summary: Create a new individual inventory
	 *     description: Creates a new individual inventory record for a student
	 *     tags: [Inventory]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - studentId
	 *               - height
	 *               - weight
	 *               - coplexion
	 *               - student_signature
	 *             properties:
	 *               studentId:
	 *                 type: string
	 *                 description: ID of the student
	 *               height:
	 *                 type: string
	 *                 example: "5'8\""
	 *                 description: Student height
	 *               weight:
	 *                 type: string
	 *                 example: "150 lbs"
	 *                 description: Student weight
	 *               coplexion:
	 *                 type: string
	 *                 example: "Fair"
	 *                 description: Student complexion
	 *               person_to_be_contacted_in_case_of_accident_or_illness:
	 *                 type: object
	 *                 description: Emergency contact information
	 *               educational_background:
	 *                 type: object
	 *                 description: Educational background information
	 *               nature_of_schooling:
	 *                 type: object
	 *                 description: Nature of schooling information
	 *               home_and_family_background:
	 *                 type: object
	 *                 description: Home and family background information
	 *               health:
	 *                 type: object
	 *                 description: Health information
	 *               interest_and_hobbies:
	 *                 type: object
	 *                 description: Interest and hobbies information
	 *               test_results:
	 *                 type: object
	 *                 description: Test results information
	 *               significant_notes_councilor_only:
	 *                 type: object
	 *                 description: Significant notes for counselor only
	 *               student_signature:
	 *                 type: string
	 *                 description: Student signature
	 *     responses:
	 *       201:
	 *         description: Individual inventory created successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Individual inventory created successfully"
	 *                 id:
	 *                   type: string
	 *                 studentId:
	 *                   type: string
	 *                 height:
	 *                   type: string
	 *                 weight:
	 *                   type: string
	 *                 student:
	 *                   $ref: '#/components/schemas/Student'
	 *       400:
	 *         description: Bad request
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   examples:
	 *                     - "Student ID is required"
	 *                     - "Height is required"
	 *                     - "Weight is required"
	 *                     - "Complexion is required"
	 *                     - "Student signature is required"
	 *                     - "Individual inventory already exists for this student"
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
	 */
	routes.post("/", controller.create);

	/**
	 * @openapi
	 * /api/inventory/{id}:
	 *   patch:
	 *     summary: Update individual inventory
	 *     description: Update individual inventory data
	 *     tags: [Inventory]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Inventory ID
	 *     requestBody:
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               height:
	 *                 type: string
	 *                 example: "5'9\""
	 *                 description: Updated student height
	 *               weight:
	 *                 type: string
	 *                 example: "155 lbs"
	 *                 description: Updated student weight
	 *               coplexion:
	 *                 type: string
	 *                 example: "Medium"
	 *                 description: Updated student complexion
	 *               person_to_be_contacted_in_case_of_accident_or_illness:
	 *                 type: object
	 *                 description: Updated emergency contact information
	 *               educational_background:
	 *                 type: object
	 *                 description: Updated educational background information
	 *               nature_of_schooling:
	 *                 type: object
	 *                 description: Updated nature of schooling information
	 *               home_and_family_background:
	 *                 type: object
	 *                 description: Updated home and family background information
	 *               health:
	 *                 type: object
	 *                 description: Updated health information
	 *               interest_and_hobbies:
	 *                 type: object
	 *                 description: Updated interest and hobbies information
	 *               test_results:
	 *                 type: object
	 *                 description: Updated test results information
	 *               significant_notes_councilor_only:
	 *                 type: object
	 *                 description: Updated significant notes for counselor only
	 *               student_signature:
	 *                 type: string
	 *                 description: Updated student signature
	 *     responses:
	 *       200:
	 *         description: Individual inventory updated successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/IndividualInventory'
	 *       400:
	 *         description: Bad request
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   examples:
	 *                     - "Missing inventory ID"
	 *                     - "At least one field is required for update"
	 *       404:
	 *         description: Inventory not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   example: "Individual inventory not found"
	 *       500:
	 *         description: Internal server error
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/inventory/{id}:
	 *   delete:
	 *     summary: Soft delete individual inventory
	 *     description: Mark individual inventory as deleted without permanently removing the data
	 *     tags: [Inventory]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Inventory ID
	 *     responses:
	 *       200:
	 *         description: Individual inventory marked as deleted successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Individual inventory deleted"
	 *       400:
	 *         description: Missing ID
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   example: "Missing inventory ID"
	 *       404:
	 *         description: Inventory not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   example: "Individual inventory not found"
	 *       500:
	 *         description: Internal server error
	 */
	routes.put("/:id", controller.remove);

	/**
	 * @openapi
	 * /api/inventory/{studentId}/predict:
	 *   post:
	 *     summary: Predict academic performance risk for a student using IIF data
	 *     description: Generate academic performance prediction based on student's Individual Inventory Form (IIF) data including educational background, family circumstances, health status, and interests
	 *     tags: [Inventory]
	 *     parameters:
	 *       - in: path
	 *         name: studentId
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Student ID
	 *     requestBody:
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               gender:
	 *                 type: string
	 *                 enum: [Male, Female, Other]
	 *                 description: Student gender (optional, defaults to student record)
	 *               age:
	 *                 type: integer
	 *                 minimum: 10
	 *                 maximum: 100
	 *                 description: Student age (optional, defaults to student record)
	 *               highSchoolAverage:
	 *                 type: number
	 *                 minimum: 60
	 *                 maximum: 100
	 *                 description: High school academic average (optional, defaults to inventory data)
	 *               natureOfSchooling:
	 *                 type: string
	 *                 enum: [continuous, interrupted]
	 *                 description: Nature of schooling continuity (optional, defaults to inventory data)
	 *               parentsMaritalRelationship:
	 *                 type: string
	 *                 enum: [single_parent, married_and_staying_together, married_but_separated, not_married_but_living_together, others]
	 *                 description: Parents marital relationship (optional, defaults to inventory data)
	 *               numberOfChildren:
	 *                 type: integer
	 *                 minimum: 1
	 *                 maximum: 20
	 *                 description: Number of children in family (optional, defaults to inventory data)
	 *               ordinalPosition:
	 *                 type: string
	 *                 description: Birth order position in family (optional, defaults to inventory data)
	 *               whoFinancesYourSchooling:
	 *                 type: string
	 *                 enum: [parents, spouse, relatives, brother, sister, scholarship, self_supporting]
	 *                 description: Who finances schooling (optional, defaults to inventory data)
	 *               parentsTotalMonthlyIncome:
	 *                 type: string
	 *                 enum: [below_five_thousand, five_thousand_to_ten_thousand, ten_thousand_to_fifteen_thousand, fifteen_thousand_to_twenty_thousand, twenty_thousand_to_twenty_five_thousand, twenty_five_thousand_to_thirty_thousand, thirty_thousand_to_thirty_five_thousand, thirty_five_thousand_to_forty_thousand, forty_thousand_to_forty_five_thousand, forty_five_thousand_to_fifty_thousand, above_fifty_thousand]
	 *                 description: Parents total monthly income (optional, defaults to inventory data)
	 *               quietPlaceToStudy:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: Has quiet place to study (optional, defaults to inventory data)
	 *               natureOfResidence:
	 *                 type: string
	 *                 enum: [family_home, relatives_home, bed_spacer, rented_apartment, dorm]
	 *                 description: Type of residence while attending school (optional, defaults to inventory data)
	 *               visionProblems:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: Has vision problems (optional, defaults to inventory data)
	 *               generalHealthProblems:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: Has general health problems (optional, defaults to inventory data)
	 *               psychologicalConsultation:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: Has had psychological consultation (optional, defaults to inventory data)
	 *               favoriteSubject:
	 *                 type: string
	 *                 description: Favorite academic subject (optional, defaults to inventory data)
	 *               leastFavoriteSubject:
	 *                 type: string
	 *                 description: Least favorite academic subject (optional, defaults to inventory data)
	 *               academicOrganizations:
	 *                 type: string
	 *                 enum: [none, math_club, debating_club, science_club, quizzers_club, others]
	 *                 description: Academic organizations participated in (optional, defaults to inventory data)
	 *               organizationPosition:
	 *                 type: string
	 *                 enum: [member, officer, others]
	 *                 description: Position in organization (optional, defaults to inventory data)
	 *     responses:
	 *       200:
	 *         description: Mental health prediction completed successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Academic performance prediction completed successfully"
	 *                 disclaimer:
	 *                   type: string
	 *                   example: "⚠️ IMPORTANT NOTICE: This academic performance prediction is based on Individual Inventory Form data and should be used in conjunction with comprehensive academic counseling."
	 *                 studentId:
	 *                   type: string
	 *                 prediction:
	 *                   type: object
	 *                   properties:
	 *                     academicPerformanceOutlook:
	 *                       type: string
	 *                       enum: [Improved, Same, Declined]
	 *                     confidence:
	 *                       type: string
	 *                       example: "85.5%"
	 *                     modelAccuracy:
	 *                       type: object
	 *                       properties:
	 *                         decisionTree:
	 *                           type: string
	 *                           example: "82.3%"
	 *                         randomForest:
	 *                           type: string
	 *                           example: "87.1%"
	 *                     riskFactors:
	 *                       type: array
	 *                       items:
	 *                         type: string
	 *                     mentalHealthRisk:
	 *                       type: object
	 *                       properties:
	 *                         level:
	 *                           type: string
	 *                           enum: [Low, Moderate, High, Critical]
	 *                         description:
	 *                           type: string
	 *                         needsAttention:
	 *                           type: boolean
	 *                         urgency:
	 *                           type: string
	 *                           enum: [None, Monitor, Schedule, Immediate]
	 *                         assessmentSummary:
	 *                           type: string
	 *                         disclaimer:
	 *                           type: string
	 *                     inputData:
	 *                       type: object
	 *                     recommendations:
	 *                       type: array
	 *                       items:
	 *                         type: string
	 *       400:
	 *         description: Bad request
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   examples:
	 *                     - "Student ID is required"
	 *                     - "Age must be between 10 and 100"
	 *                     - "High school average must be between 60 and 100"
	 *                     - "Number of children must be between 1 and 20"
	 *                     - "Nature of schooling must be one of: continuous, interrupted"
	 *       404:
	 *         description: Not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   examples:
	 *                     - "Student not found"
	 *                     - "Individual inventory not found for this student"
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/:studentId/predict", controller.predictMentalHealth);

	/**
	 * @openapi
	 * /api/inventory/student/{studentId}/prediction:
	 *   get:
	 *     summary: Get mental health prediction for a student
	 *     description: Retrieve stored mental health prediction data for a specific student
	 *     tags: [Inventory]
	 *     parameters:
	 *       - in: path
	 *         name: studentId
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Student ID
	 *     responses:
	 *       200:
	 *         description: Mental health prediction retrieved successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Mental health prediction retrieved successfully"
	 *                 studentId:
	 *                   type: string
	 *                 studentInfo:
	 *                   type: object
	 *                   properties:
	 *                     studentNumber:
	 *                       type: string
	 *                     program:
	 *                       type: string
	 *                     name:
	 *                       type: string
	 *                 prediction:
	 *                   type: object
	 *                   properties:
	 *                     academicPerformanceOutlook:
	 *                       type: string
	 *                       enum: [improved, same, declined]
	 *                     confidence:
	 *                       type: number
	 *                     modelAccuracy:
	 *                       type: object
	 *                       properties:
	 *                         decisionTree:
	 *                           type: number
	 *                         randomForest:
	 *                           type: number
	 *                     riskFactors:
	 *                       type: array
	 *                       items:
	 *                         type: string
	 *                     mentalHealthRisk:
	 *                       type: object
	 *                       properties:
	 *                         level:
	 *                           type: string
	 *                           enum: [low, moderate, high, critical]
	 *                         description:
	 *                           type: string
	 *                         needsAttention:
	 *                           type: boolean
	 *                         urgency:
	 *                           type: string
	 *                           enum: [none, monitor, schedule, immediate]
	 *                         assessmentSummary:
	 *                           type: string
	 *                         disclaimer:
	 *                           type: string
	 *                     inputData:
	 *                       type: object
	 *                     recommendations:
	 *                       type: array
	 *                       items:
	 *                         type: string
	 *                     predictionDate:
	 *                       type: string
	 *                       format: date-time
	 *                 predictionGenerated:
	 *                   type: boolean
	 *                 predictionUpdatedAt:
	 *                   type: string
	 *                   format: date-time
	 *       400:
	 *         description: Missing student ID
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   example: "Student ID is required"
	 *       404:
	 *         description: Prediction not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   example: "Mental health prediction not found for this student"
	 *                 message:
	 *                   type: string
	 *                   example: "This student either doesn't have an inventory or hasn't generated a prediction yet"
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/student/:studentId/prediction", controller.getPredictionByStudentId);

	/**
	 * @openapi
	 * /api/inventory/student/{studentId}/reminder:
	 *   get:
	 *     summary: Get inventory reminder information for a student
	 *     description: Calculate and return inventory reminder information based on risk level and last update
	 *     tags: [Inventory]
	 *     parameters:
	 *       - in: path
	 *         name: studentId
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Student ID
	 *     responses:
	 *       200:
	 *         description: Returns inventory reminder information
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 reminderInfo:
	 *                   type: object
	 *                   properties:
	 *                     needsUpdate:
	 *                       type: boolean
	 *                     riskLevel:
	 *                       type: string
	 *                       enum: [low, moderate, high, critical]
	 *                       nullable: true
	 *                     lastUpdated:
	 *                       type: string
	 *                       format: date-time
	 *                       nullable: true
	 *                     nextUpdateDue:
	 *                       type: string
	 *                       format: date-time
	 *                       nullable: true
	 *                     monthsUntilDue:
	 *                       type: number
	 *                     daysUntilDue:
	 *                       type: number
	 *                     isOverdue:
	 *                       type: boolean
	 *                     updateFrequencyMonths:
	 *                       type: number
	 *                 message:
	 *                   type: string
	 *                 severity:
	 *                   type: string
	 *                   enum: [low, medium, high, critical]
	 *                 timeRemaining:
	 *                   type: string
	 *                 studentId:
	 *                   type: string
	 *       400:
	 *         description: Missing student ID
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   example: "Student ID is required"
	 *       404:
	 *         description: Inventory not found for this student
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   example: "Inventory not found for this student"
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/student/:studentId/reminder", controller.getReminderInfoByStudentId);

	route.use(path, routes);

	return route;
};
