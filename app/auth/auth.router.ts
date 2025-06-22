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
	 *     description: Register a new user with email and password
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
	 *                 type: string
	 *                 example: "123 Main St, City, State"
	 *               role:
	 *                 type: string
	 *                 enum: [user, admin]
	 *                 default: user
	 *               type:
	 *                 type: string
	 *                 enum: [client, employee]
	 *                 default: client
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
	 *       400:
	 *         description: Bad request (validation errors)
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Email is required"
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/register", controller.register);

	/**
	 * @openapi
	 * /api/auth/login:
	 *   post:
	 *     summary: Login user
	 *     description: Authenticate user with email and password
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
	 *             properties:
	 *               email:
	 *                 type: string
	 *                 format: email
	 *                 example: "john.doe@example.com"
	 *               password:
	 *                 type: string
	 *                 example: "password123"
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
	 *                     person:
	 *                       $ref: '#/components/schemas/Person'
	 *       401:
	 *         description: Invalid credentials
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Invalid credentials"
	 *       400:
	 *         description: Bad request (missing required fields)
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Email is required"
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/login", controller.login);

	route.use(path, routes);

	return route;
};
