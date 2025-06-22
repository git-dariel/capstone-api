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
	const path = "/student";

	/**
	 * @openapi
	 * /api/student/{id}:
	 *   get:
	 *     summary: Get student by id
	 *     description: Get student by id with optional fields to include
	 *     tags: [Student]
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
	 *         description: Returns student data
	 *       400:
	 *         description: Missing ID or invalid fields parameter
	 *       404:
	 *         description: Student not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/student:
	 *   get:
	 *     summary: Get all students
	 *     description: Get all students with pagination, sorting, and field selection
	 *     tags: [Student]
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
	 *         description: Search query to filter results by studentNumber, program, or year
	 *     responses:
	 *       200:
	 *         description: Returns paginated students list with total count and page info
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 students:
	 *                   type: array
	 *                   items:
	 *                     type: object
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
	 * /api/student:
	 *   post:
	 *     summary: Create student with user and person
	 *     description: Creates a new student with associated user and person data
	 *     tags: [Student]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - studentNumber
	 *               - program
	 *               - year
	 *               - user
	 *             properties:
	 *               studentNumber:
	 *                 type: string
	 *                 example: "2024-0001"
	 *                 description: Unique student identifier
	 *               program:
	 *                 type: string
	 *                 example: "Computer Science"
	 *                 description: Academic program
	 *               year:
	 *                 type: string
	 *                 example: "1st Year"
	 *                 description: Current academic year level
	 *               user:
	 *                 type: object
	 *                 required:
	 *                   - userName
	 *                   - email
	 *                   - password
	 *                   - person
	 *                 properties:
	 *                   userName:
	 *                     type: string
	 *                     example: "john.doe"
	 *                   email:
	 *                     type: string
	 *                     format: email
	 *                     example: "john.doe@university.edu"
	 *                   password:
	 *                     type: string
	 *                     minLength: 6
	 *                     example: "password123"
	 *                   person:
	 *                     type: object
	 *                     required:
	 *                       - firstName
	 *                       - lastName
	 *                       - email
	 *                     properties:
	 *                       firstName:
	 *                         type: string
	 *                         example: "John"
	 *                       lastName:
	 *                         type: string
	 *                         example: "Doe"
	 *                       middleName:
	 *                         type: string
	 *                         example: "Michael"
	 *                       email:
	 *                         type: string
	 *                         format: email
	 *                         example: "john.doe@university.edu"
	 *                       contactNumber:
	 *                         type: string
	 *                         example: "+1234567890"
	 *                       suffix:
	 *                         type: string
	 *                         example: "Jr."
	 *                       gender:
	 *                         type: string
	 *                         enum: [male, female, others]
	 *                         example: "male"
	 *                       birthDate:
	 *                         type: string
	 *                         format: date-time
	 *                         example: "2000-01-01T00:00:00.000Z"
	 *                       birthPlace:
	 *                         type: string
	 *                         example: "New York"
	 *                       age:
	 *                         type: integer
	 *                         example: 20
	 *                       religion:
	 *                         type: string
	 *                         example: "Christian"
	 *                       civilStatus:
	 *                         type: string
	 *                         enum: [single, married, separated, widow, cohabiting]
	 *                         example: "single"
	 *                       address:
	 *                         type: object
	 *                         properties:
	 *                           houseNo:
	 *                             type: integer
	 *                             example: 123
	 *                           street:
	 *                             type: string
	 *                             example: "Main Street"
	 *                           province:
	 *                             type: string
	 *                             example: "Metro Manila"
	 *                           city:
	 *                             type: string
	 *                             example: "Quezon City"
	 *                           barangay:
	 *                             type: string
	 *                             example: "Barangay 1"
	 *                           zipCode:
	 *                             type: integer
	 *                             example: 1100
	 *                           country:
	 *                             type: string
	 *                             example: "Philippines"
	 *                           type:
	 *                             type: string
	 *                             enum: [permanent, current, temporary, previous]
	 *                             example: "current"
	 *     responses:
	 *       201:
	 *         description: Returns newly created student with user and person data
	 *       200:
	 *         description: Returns existing student if email already exists
	 *       400:
	 *         description: Missing required fields or student number already exists
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/", controller.create);

	/**
	 * @openapi
	 * /api/student/{id}:
	 *   patch:
	 *     summary: Update student
	 *     description: Update student data with nested user and person information
	 *     tags: [Student]
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
	 *               studentNumber:
	 *                 type: string
	 *                 example: "2024-0001"
	 *                 description: Unique student identifier
	 *               program:
	 *                 type: string
	 *                 example: "Computer Science"
	 *                 description: Academic program
	 *               year:
	 *                 type: string
	 *                 example: "2nd Year"
	 *                 description: Current academic year level
	 *               user:
	 *                 type: object
	 *                 properties:
	 *                   userName:
	 *                     type: string
	 *                     example: "john.doe"
	 *                   email:
	 *                     type: string
	 *                     format: email
	 *                     example: "john.doe@university.edu"
	 *                   password:
	 *                     type: string
	 *                     minLength: 6
	 *                     example: "newpassword123"
	 *                   person:
	 *                     type: object
	 *                     properties:
	 *                       firstName:
	 *                         type: string
	 *                         example: "John"
	 *                       lastName:
	 *                         type: string
	 *                         example: "Doe"
	 *                       middleName:
	 *                         type: string
	 *                         example: "Michael"
	 *                       email:
	 *                         type: string
	 *                         format: email
	 *                         example: "john.doe@university.edu"
	 *                       contactNumber:
	 *                         type: string
	 *                         example: "+1234567890"
	 *                       suffix:
	 *                         type: string
	 *                         example: "Jr."
	 *                       gender:
	 *                         type: string
	 *                         enum: [male, female, others]
	 *                         example: "male"
	 *                       birthDate:
	 *                         type: string
	 *                         format: date-time
	 *                         example: "2000-01-01T00:00:00.000Z"
	 *                       birthPlace:
	 *                         type: string
	 *                         example: "New York"
	 *                       age:
	 *                         type: integer
	 *                         example: 21
	 *                       religion:
	 *                         type: string
	 *                         example: "Christian"
	 *                       civilStatus:
	 *                         type: string
	 *                         enum: [single, married, separated, widow, cohabiting]
	 *                         example: "single"
	 *                       address:
	 *                         type: object
	 *                         properties:
	 *                           houseNo:
	 *                             type: integer
	 *                             example: 123
	 *                           street:
	 *                             type: string
	 *                             example: "Main Street"
	 *                           province:
	 *                             type: string
	 *                             example: "Metro Manila"
	 *                           city:
	 *                             type: string
	 *                             example: "Quezon City"
	 *                           barangay:
	 *                             type: string
	 *                             example: "Barangay 1"
	 *                           zipCode:
	 *                             type: integer
	 *                             example: 1100
	 *                           country:
	 *                             type: string
	 *                             example: "Philippines"
	 *                           type:
	 *                             type: string
	 *                             enum: [permanent, current, temporary, previous]
	 *                             example: "current"
	 *     responses:
	 *       200:
	 *         description: Returns updated student with user and person data
	 *       400:
	 *         description: Missing ID, no update fields provided, or student number already exists
	 *       404:
	 *         description: Student not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/student/{id}:
	 *   delete:
	 *     summary: Soft delete student
	 *     description: Mark student as deleted without permanently removing the data
	 *     tags: [Student]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Student marked as deleted successfully
	 *       400:
	 *         description: Missing ID
	 *       404:
	 *         description: Student not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.delete("/:id", controller.remove);

	route.use(path, routes);

	return route;
};
