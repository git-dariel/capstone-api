import { Router, Request, Response, NextFunction } from "express";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	create(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	updateYearLevels(req: Request, res: Response, next: NextFunction): Promise<void>;
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
	 *     description: Get student by id with optional field selection using dot notation
	 *     tags: [Student]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Student ID
	 *       - in: query
	 *         name: fields
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include (supports dot notation for nested fields like "person.firstName")
	 *         example: "id,studentNumber,program,person.firstName,person.lastName"
	 *     responses:
	 *       200:
	 *         description: Returns student data
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/Student'
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
	 *                     - "User ID is required"
	 *                     - "Populate must be a string"
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
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/student:
	 *   get:
	 *     summary: Get all students
	 *     description: Get all students with pagination, sorting, field selection, and search functionality
	 *     tags: [Student]
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
	 *         example: "studentNumber"
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
	 *         example: "id,studentNumber,program,person.firstName,person.email"
	 *       - in: query
	 *         name: query
	 *         schema:
	 *           type: string
	 *         description: Search query to filter results by studentNumber, program, year, person firstName, lastName, or email
	 *         example: "Computer Science"
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
	 *                     $ref: '#/components/schemas/Student'
	 *                 total:
	 *                   type: integer
	 *                   description: Total number of students
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
	 *                     - "Order must be 'asc' or 'desc'"
	 *                     - "Populate must be a string"
	 *                     - "Sort must be a string"
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/", controller.getAll);

	/**
	 * @openapi
	 * /api/student:
	 *   post:
	 *     summary: Create a new student
	 *     description: Creates a new student record. Can either link to existing person (via personId) or create a new person.
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
	 *               personId:
	 *                 type: string
	 *                 description: Optional - ID of existing person to link to student
	 *               firstName:
	 *                 type: string
	 *                 example: "John"
	 *                 description: Required if creating new person (no personId provided)
	 *               lastName:
	 *                 type: string
	 *                 example: "Doe"
	 *                 description: Required if creating new person (no personId provided)
	 *               middleName:
	 *                 type: string
	 *                 example: "Michael"
	 *               suffix:
	 *                 type: string
	 *                 example: "Jr."
	 *               email:
	 *                 type: string
	 *                 format: email
	 *                 example: "john.doe@university.edu"
	 *               contactNumber:
	 *                 type: string
	 *                 example: "+1234567890"
	 *               gender:
	 *                 type: string
	 *                 example: "Male"
	 *               birthDate:
	 *                 type: string
	 *                 format: date
	 *                 example: "2000-01-01"
	 *               birthPlace:
	 *                 type: string
	 *                 example: "New York"
	 *               age:
	 *                 type: integer
	 *                 example: 20
	 *               religion:
	 *                 type: string
	 *                 example: "Christian"
	 *               civilStatus:
	 *                 type: string
	 *                 example: "Single"
	 *               address:
	 *                 type: object
	 *                 properties:
	 *                   street:
	 *                     type: string
	 *                     example: "123 Main St"
	 *                   city:
	 *                     type: string
	 *                     example: "New York"
	 *                   houseNo:
	 *                     type: string
	 *                     example: "123"
	 *                   province:
	 *                     type: string
	 *                     example: "New York"
	 *                   barangay:
	 *                     type: string
	 *                     example: "Downtown"
	 *                   zipCode:
	 *                     type: string
	 *                     example: "10001"
	 *                   country:
	 *                     type: string
	 *                     example: "USA"
	 *                   type:
	 *                     type: string
	 *                     example: "Home"
	 *     responses:
	 *       201:
	 *         description: Student created successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Student created successfully"
	 *                 id:
	 *                   type: string
	 *                 studentNumber:
	 *                   type: string
	 *                 program:
	 *                   type: string
	 *                 year:
	 *                   type: string
	 *                 person:
	 *                   $ref: '#/components/schemas/Person'
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
	 *                     - "Student number is required"
	 *                     - "Program is required"
	 *                     - "Year is required"
	 *                     - "First name and last name are required when creating a new person"
	 *                     - "Student number already exists"
	 *                     - "Person with this email already exists"
	 *       404:
	 *         description: Person not found (when personId provided)
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   example: "Person not found"
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/", controller.create);

	/**
	 * @openapi
	 * /api/student/{id}:
	 *   patch:
	 *     summary: Update student
	 *     description: Update student data and optionally associated person information
	 *     tags: [Student]
	 *     parameters:
	 *       - in: path
	 *         name: id
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
	 *               person:
	 *                 type: object
	 *                 description: Person data to update
	 *                 properties:
	 *                   firstName:
	 *                     type: string
	 *                     example: "John"
	 *                   lastName:
	 *                     type: string
	 *                     example: "Doe"
	 *                   middleName:
	 *                     type: string
	 *                     example: "Michael"
	 *                   suffix:
	 *                     type: string
	 *                     example: "Jr."
	 *                   email:
	 *                     type: string
	 *                     format: email
	 *                     example: "john.doe@university.edu"
	 *                   contactNumber:
	 *                     type: string
	 *                     example: "+1234567890"
	 *                   gender:
	 *                     type: string
	 *                     example: "Male"
	 *                   birthDate:
	 *                     type: string
	 *                     format: date
	 *                     example: "2000-01-01"
	 *                   birthPlace:
	 *                     type: string
	 *                     example: "New York"
	 *                   age:
	 *                     type: integer
	 *                     example: 21
	 *                   religion:
	 *                     type: string
	 *                     example: "Christian"
	 *                   civilStatus:
	 *                     type: string
	 *                     example: "Single"
	 *                   address:
	 *                     type: object
	 *                     description: Address fields to update (will be merged with existing address)
	 *                     properties:
	 *                       street:
	 *                         type: string
	 *                         example: "456 Oak Avenue"
	 *                       city:
	 *                         type: string
	 *                         example: "Boston"
	 *                       houseNo:
	 *                         type: string
	 *                         example: "456"
	 *                       province:
	 *                         type: string
	 *                         example: "Massachusetts"
	 *                       barangay:
	 *                         type: string
	 *                         example: "Back Bay"
	 *                       zipCode:
	 *                         type: string
	 *                         example: "02101"
	 *                       country:
	 *                         type: string
	 *                         example: "USA"
	 *                       type:
	 *                         type: string
	 *                         example: "Current"
	 *     responses:
	 *       200:
	 *         description: Student updated successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 id:
	 *                   type: string
	 *                 studentNumber:
	 *                   type: string
	 *                 program:
	 *                   type: string
	 *                 year:
	 *                   type: string
	 *                 person:
	 *                   $ref: '#/components/schemas/Person'
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
	 *                     - "User ID is required"
	 *                     - "At least one field is required for update"
	 *                     - "Student number already exists"
	 *                     - "Student person data not found"
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
	 *         description: Student ID
	 *     responses:
	 *       200:
	 *         description: Student marked as deleted successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Student deleted successfully"
	 *       400:
	 *         description: Missing ID
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   example: "User ID is required"
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
	routes.put("/:id", controller.remove);

	/**
	 * @openapi
	 * /api/student/update-year-levels:
	 *   post:
	 *     summary: Manually update all student year levels
	 *     description: Manually trigger the year level update job for all students. Updates year levels based on enrollment year extracted from student numbers.
	 *     tags: [Student]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Year levels updated successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Student year levels updated successfully"
	 *                 success:
	 *                   type: boolean
	 *                   example: true
	 *                 total:
	 *                   type: number
	 *                   example: 100
	 *                 updated:
	 *                   type: number
	 *                   example: 25
	 *                 skipped:
	 *                   type: number
	 *                   example: 75
	 *                 errors:
	 *                   type: number
	 *                   example: 0
	 *                 duration:
	 *                   type: number
	 *                   example: 1250
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 error:
	 *                   type: string
	 *                   example: "Failed to update student year levels"
	 */
	routes.post("/update-year-levels", controller.updateYearLevels);

	route.use(path, routes);

	return route;
};
