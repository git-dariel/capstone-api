import { Router, Request, Response, NextFunction } from "express";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getByStudentId(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	create(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	remove(req: Request, res: Response, next: NextFunction): Promise<void>;
	predictMentalHealth(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/consent";

	/**
	 * @openapi
	 * /api/consent/{id}:
	 *   get:
	 *     summary: Get consent by id
	 *     description: Get consent by id with optional fields to include
	 *     tags: [Consent]
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
	 *         description: Returns consent data
	 *       400:
	 *         description: Missing ID or invalid fields parameter
	 *       404:
	 *         description: Consent not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/consent/student/{studentId}:
	 *   get:
	 *     summary: Get consent by student ID
	 *     description: Get consent data for a specific student
	 *     tags: [Consent]
	 *     parameters:
	 *       - in: path
	 *         name: studentId
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
	 *         description: Returns consent data for the student
	 *       400:
	 *         description: Missing student ID or invalid fields parameter
	 *       404:
	 *         description: Consent not found for this student
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/student/:studentId", controller.getByStudentId);

	/**
	 * @openapi
	 * /api/consent:
	 *   get:
	 *     summary: Get all consents
	 *     description: Get all consents with pagination, sorting, and field selection
	 *     tags: [Consent]
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
	 *         description: Search query to filter results by student info or guidance text
	 *     responses:
	 *       200:
	 *         description: Returns paginated consents list with total count and page info
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 consents:
	 *                   type: array
	 *                   items:
	 *                     type: object
	 *                     properties:
	 *                       id:
	 *                         type: string
	 *                       studentId:
	 *                         type: string
	 *                       referred:
	 *                         type: string
	 *                         enum: [self, family, friend, faculty, administrative_staff, others]
	 *                       with_whom_do_you_live:
	 *                         type: string
	 *                         enum: [alone, spouse, partner, roommates, children, guardians]
	 *                       financial_status:
	 *                         type: string
	 *                         enum: [always_stressful, often_stressful, never_stressful, sometimes_stressful, rarely_stressful]
	 *                       what_brings_you_to_guidance:
	 *                         type: string
	 *                         nullable: true
	 *                       physical_problem:
	 *                         type: string
	 *                         enum: [yes, no]
	 *                       physical_symptoms:
	 *                         type: string
	 *                         enum: [shortness_of_breath, racing_heart, headaches, insomnia, teeth_clenching, cold_hands_and_feet, high_blood_pressure, muscle_tension, diarrhea, stomach_discomfort]
	 *                       concerns:
	 *                         type: object
	 *                       services:
	 *                         type: string
	 *                         enum: [general_information, one_or_two_session_problem_solving, stress_management, group_counseling, substance_abuse_services, career_exploration, individual_counseling, referral_for_university]
	 *                       sleep_duration:
	 *                         type: string
	 *                       stress_level:
	 *                         type: string
	 *                         enum: [low, medium, high]
	 *                       academic_performance_change:
	 *                         type: string
	 *                         enum: [same, improved, declined]
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
	 * /api/consent:
	 *   post:
	 *     summary: Create consent
	 *     description: Creates a new consent entry for a student
	 *     tags: [Consent]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - studentId
	 *               - financial_status
	 *               - physical_problem
	 *               - physical_symptoms
	 *               - concerns
	 *               - services
	 *               - sleep_duration
	 *               - stress_level
	 *               - academic_performance_change
	 *             properties:
	 *               studentId:
	 *                 type: string
	 *                 description: ID of the student
	 *               referred:
	 *                 type: string
	 *                 enum: [self, family, friend, faculty, administrative_staff, others]
	 *                 description: How the student was referred (default self)
	 *               with_whom_do_you_live:
	 *                 type: string
	 *                 enum: [alone, spouse, partner, roommates, children, guardians]
	 *                 description: Living situation (default guardians)
	 *               financial_status:
	 *                 type: string
	 *                 enum: [always_stressful, often_stressful, never_stressful, sometimes_stressful, rarely_stressful]
	 *                 description: Financial stress level
	 *               what_brings_you_to_guidance:
	 *                 type: string
	 *                 nullable: true
	 *                 description: Optional description of what brings student to guidance
	 *               physical_problem:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: Whether student has physical problems
	 *               physical_symptoms:
	 *                 type: string
	 *                 enum: [shortness_of_breath, racing_heart, headaches, insomnia, teeth_clenching, cold_hands_and_feet, high_blood_pressure, muscle_tension, diarrhea, stomach_discomfort]
	 *                 description: Physical symptoms experienced
	 *               concerns:
	 *                 type: object
	 *                 description: Present concerns with level of importance for each area
	 *               services:
	 *                 type: string
	 *                 enum: [general_information, one_or_two_session_problem_solving, stress_management, group_counseling, substance_abuse_services, career_exploration, individual_counseling, referral_for_university]
	 *                 description: Services requested
	 *               sleep_duration:
	 *                 type: string
	 *                 description: How many hours of sleep per night
	 *               stress_level:
	 *                 type: string
	 *                 enum: [low, medium, high]
	 *                 description: Current stress level
	 *               academic_performance_change:
	 *                 type: string
	 *                 enum: [same, improved, declined]
	 *                 description: Change in academic performance
	 *     responses:
	 *       201:
	 *         description: Returns newly created consent with automatic mental health prediction
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   description: Success message
	 *                 consent:
	 *                   type: object
	 *                   description: The created consent record with student and person details
	 *                   properties:
	 *                     id:
	 *                       type: string
	 *                     studentId:
	 *                       type: string
	 *                     referred:
	 *                       type: string
	 *                     financial_status:
	 *                       type: string
	 *                     sleep_duration:
	 *                       type: string
	 *                     stress_level:
	 *                       type: string
	 *                     academic_performance_change:
	 *                       type: string
	 *                     student:
	 *                       type: object
	 *                       properties:
	 *                         person:
	 *                           type: object
	 *                 mentalHealthPrediction:
	 *                   type: object
	 *                   description: Automatic mental health prediction results
	 *                   properties:
	 *                     academicPerformanceOutlook:
	 *                       type: string
	 *                       enum: [Improved, Same, Declined]
	 *                       description: Predicted academic performance outlook
	 *                     confidence:
	 *                       type: string
	 *                       description: Prediction confidence percentage
	 *                     modelAccuracy:
	 *                       type: object
	 *                       properties:
	 *                         decisionTree:
	 *                           type: string
	 *                           description: Decision tree model accuracy
	 *                         randomForest:
	 *                           type: string
	 *                           description: Random forest model accuracy
	 *                     riskFactors:
	 *                       type: array
	 *                       items:
	 *                         type: string
	 *                       description: Identified risk factors
	 *                     inputData:
	 *                       type: object
	 *                       description: Data used for prediction
	 *                     recommendations:
	 *                       type: array
	 *                       items:
	 *                         type: string
	 *                       description: Personalized recommendations
	 *               example:
	 *                 message: "Consent created successfully with mental health prediction"
	 *                 consent:
	 *                   id: "60f7b3b3b3b3b3b3b3b3b3b3"
	 *                   studentId: "60f7b3b3b3b3b3b3b3b3b3b2"
	 *                   stress_level: "medium"
	 *                   sleep_duration: "6.5"
	 *                 mentalHealthPrediction:
	 *                   academicPerformanceOutlook: "Same"
	 *                   confidence: "75.2%"
	 *                   modelAccuracy:
	 *                     decisionTree: "68.4%"
	 *                     randomForest: "71.7%"
	 *                   riskFactors: ["Monitor sleep patterns and stress levels regularly"]
	 *                   recommendations: ["Maintain current healthy habits", "Monitor stress levels regularly"]
	 *       409:
	 *         description: Consent already exists for this student
	 *       400:
	 *         description: Missing required fields or invalid data
	 *       404:
	 *         description: Student not found
	 *       500:
	 *         description: Internal server error
	 *     notes:
	 *       - After successful consent creation, an automatic mental health prediction is performed
	 *       - The prediction uses sleep duration and stress level from the consent data
	 *       - If prediction fails, consent creation still succeeds with a fallback response
	 *       - Prediction uses Decision Tree and Random Forest algorithms trained on the provided dataset
	 */
	routes.post("/", controller.create);

	/**
	 * @openapi
	 * /api/consent/{id}:
	 *   patch:
	 *     summary: Update consent
	 *     description: Update consent data
	 *     tags: [Consent]
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
	 *               referred:
	 *                 type: string
	 *                 enum: [self, family, friend, faculty, administrative_staff, others]
	 *                 description: How the student was referred
	 *               with_whom_do_you_live:
	 *                 type: string
	 *                 enum: [alone, spouse, partner, roommates, children, guardians]
	 *                 description: Living situation
	 *               financial_status:
	 *                 type: string
	 *                 enum: [always_stressful, often_stressful, never_stressful, sometimes_stressful, rarely_stressful]
	 *                 description: Financial stress level
	 *               what_brings_you_to_guidance:
	 *                 type: string
	 *                 nullable: true
	 *                 description: Description of what brings student to guidance
	 *               physical_problem:
	 *                 type: string
	 *                 enum: [yes, no]
	 *                 description: Whether student has physical problems
	 *               physical_symptoms:
	 *                 type: string
	 *                 enum: [shortness_of_breath, racing_heart, headaches, insomnia, teeth_clenching, cold_hands_and_feet, high_blood_pressure, muscle_tension, diarrhea, stomach_discomfort]
	 *                 description: Physical symptoms experienced
	 *               concerns:
	 *                 type: object
	 *                 description: Present concerns with level of importance for each area
	 *               services:
	 *                 type: string
	 *                 enum: [general_information, one_or_two_session_problem_solving, stress_management, group_counseling, substance_abuse_services, career_exploration, individual_counseling, referral_for_university]
	 *                 description: Services requested
	 *               sleep_duration:
	 *                 type: string
	 *                 description: How many hours of sleep per night
	 *               stress_level:
	 *                 type: string
	 *                 enum: [low, medium, high]
	 *                 description: Current stress level
	 *               academic_performance_change:
	 *                 type: string
	 *                 enum: [same, improved, declined]
	 *                 description: Change in academic performance
	 *     responses:
	 *       200:
	 *         description: Returns updated consent
	 *       400:
	 *         description: Missing ID, no update fields provided, or invalid data
	 *       404:
	 *         description: Consent not found
	 *       500:
	 *         description: Internal server error
	 *     notes:
	 *       - The updatedAt field is automatically set to the current timestamp
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/consent/{id}:
	 *   delete:
	 *     summary: Soft delete consent
	 *     description: Mark consent as deleted without permanently removing the data
	 *     tags: [Consent]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Consent marked as deleted successfully
	 *       400:
	 *         description: Missing ID
	 *       404:
	 *         description: Consent not found
	 *       500:
	 *         description: Internal server error
	 *     notes:
	 *       - The updatedAt field is automatically set to the current timestamp
	 *       - The isDeleted field is set to true
	 */
	routes.put("/:id", controller.remove);

	/**
	 * @openapi
	 * /api/consent/predict/{studentId}:
	 *   post:
	 *     summary: Predict mental health risk for a student
	 *     description: Use machine learning algorithms (Decision Tree and Random Forest) to predict mental health risk based on student data
	 *     tags: [Consent]
	 *     parameters:
	 *       - in: path
	 *         name: studentId
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The ID of the student for mental health prediction
	 *     requestBody:
	 *       required: false
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               gender:
	 *                 type: string
	 *                 enum: [Male, Female, Other]
	 *                 description: Student's gender
	 *               age:
	 *                 type: number
	 *                 minimum: 10
	 *                 maximum: 100
	 *                 description: Student's age
	 *               educationLevel:
	 *                 type: string
	 *                 enum: [Class 8, Class 9, Class 10, Class 11, Class 12, BA, BSc, BTech, MA, MSc, MTech]
	 *                 description: Student's education level
	 *               sleepDuration:
	 *                 type: number
	 *                 minimum: 0
	 *                 maximum: 24
	 *                 description: Average sleep duration in hours
	 *               stressLevel:
	 *                 type: string
	 *                 enum: [Low, Medium, High]
	 *                 description: Student's stress level
	 *           example:
	 *             gender: "Female"
	 *             age: 20
	 *             educationLevel: "BTech"
	 *             sleepDuration: 6.5
	 *             stressLevel: "Medium"
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
	 *                       description: Prediction confidence percentage
	 *                     modelAccuracy:
	 *                       type: object
	 *                       properties:
	 *                         decisionTree:
	 *                           type: string
	 *                         randomForest:
	 *                           type: string
	 *                     riskFactors:
	 *                       type: array
	 *                       items:
	 *                         type: string
	 *                     inputData:
	 *                       type: object
	 *                     recommendations:
	 *                       type: array
	 *                       items:
	 *                         type: string
	 *       400:
	 *         description: Invalid input data or missing student ID
	 *       404:
	 *         description: Student not found or consent not found
	 *       500:
	 *         description: Internal server error during prediction
	 *     notes:
	 *       - If optional body parameters are not provided, defaults will be used from student records
	 *       - The prediction uses trained Decision Tree and Random Forest models
	 *       - Model accuracy is calculated from training data split (80% train, 20% test)
	 *       - Requires existing consent record for the student
	 */
	routes.post("/predict/:studentId", controller.predictMentalHealth);

	route.use(path, routes);

	return route;
};
