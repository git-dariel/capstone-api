import { Router, Request, Response, NextFunction } from "express";

interface IController {
	register(req: Request, res: Response, next: NextFunction): Promise<void>;
	login(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/auth";

	/**
	 * @openapi
	 * /api/auth/register:
	 *   post:
	 *     summary: Register a new user
	 *     description: Register a new user with email and password. Creates both user and person records, and optionally a student record if type is 'student'.
	 *     tags: [Auth]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - email
	 *               - password
	 *               - firstName
	 *               - lastName
	 *             properties:
	 *               email:
	 *                 type: string
	 *                 format: email
	 *                 example: "john.doe@example.com"
	 *               password:
	 *                 type: string
	 *                 minLength: 6
	 *                 example: "password123"
	 *               userName:
	 *                 type: string
	 *                 example: "johndoe"
	 *                 description: "Optional - defaults to email if not provided"
	 *               firstName:
	 *                 type: string
	 *                 example: "John"
	 *               lastName:
	 *                 type: string
	 *                 example: "Doe"
	 *               middleName:
	 *                 type: string
	 *                 example: "Michael"
	 *               suffix:
	 *                 type: string
	 *                 example: "Jr."
	 *               contactNumber:
	 *                 type: string
	 *                 example: "+1234567890"
	 *               gender:
	 *                 type: string
	 *                 example: "Male"
	 *               birthDate:
	 *                 type: string
	 *                 format: date
	 *                 example: "1990-01-01"
	 *               birthPlace:
	 *                 type: string
	 *                 example: "New York"
	 *               age:
	 *                 type: integer
	 *                 example: 30
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
	 *               role:
	 *                 type: string
	 *                 enum: [user, admin]
	 *                 default: user
	 *               type:
	 *                 type: string
	 *                 enum: [student, employee]
	 *                 default: student
	 *               studentNumber:
	 *                 type: string
	 *                 example: "2024-001"
	 *                 description: "Required if type is 'student'"
	 *               program:
	 *                 type: string
	 *                 example: "Computer Science"
	 *                 description: "Required if type is 'student'"
	 *               year:
	 *                 type: string
	 *                 example: "1st Year"
	 *                 description: "Required if type is 'student'"
	 *     responses:
	 *       201:
	 *         description: User registered successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Registration successful"
	 *                 user:
	 *                   $ref: '#/components/schemas/User'
	 *                 student:
	 *                   $ref: '#/components/schemas/Student'
	 *                   description: "Included if type is 'student'"
	 *       400:
	 *         description: Bad request (validation errors)
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   examples:
	 *                     - "Email is required"
	 *                     - "Password is required"
	 *                     - "Invalid email format"
	 *                     - "Password must be at least 6 characters long"
	 *                     - "Person with this email already exists"
	 *                     - "Username already exists. Please choose a different username."
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/register", controller.register);

	/**
	 * @openapi
	 * /api/auth/login:
	 *   post:
	 *     summary: Login user
	 *     description: Authenticate user with email, password, and user type
	 *     tags: [Auth]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - email
	 *               - password
	 *               - type
	 *             properties:
	 *               email:
	 *                 type: string
	 *                 format: email
	 *                 example: "john.doe@example.com"
	 *               password:
	 *                 type: string
	 *                 example: "password123"
	 *               type:
	 *                 type: string
	 *                 enum: [student, employee]
	 *                 example: "student"
	 *                 description: "User type to login as"
	 *     responses:
	 *       200:
	 *         description: Login successful
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Logged in successfully"
	 *                 user:
	 *                   type: object
	 *                   properties:
	 *                     id:
	 *                       type: string
	 *                     role:
	 *                       type: string
	 *                     type:
	 *                       type: string
	 *                     person:
	 *                       $ref: '#/components/schemas/Person'
	 *                 student:
	 *                   $ref: '#/components/schemas/Student'
	 *                   description: "Included if user has student records"
	 *       401:
	 *         description: Invalid credentials or account type
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   examples:
	 *                     - "Invalid credentials"
	 *                     - "Invalid account type"
	 *       400:
	 *         description: Bad request (missing required fields)
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   examples:
	 *                     - "Email is required"
	 *                     - "Password is required"
	 *                     - "Type is required"
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/login", controller.login);

	route.use(path, routes);

	return route;
};
