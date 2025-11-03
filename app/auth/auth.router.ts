import { Router, Request, Response, NextFunction } from "express";

interface IController {
	register(req: Request, res: Response, next: NextFunction): Promise<void>;
	registerUsingRegularEmail(req: Request, res: Response, next: NextFunction): Promise<void>;
	registerAdmin(req: Request, res: Response, next: NextFunction): Promise<void>;
	login(req: Request, res: Response, next: NextFunction): Promise<void>;
	verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void>;
	resendOTP(req: Request, res: Response, next: NextFunction): Promise<void>;
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
	 *                 example: "john.doe@iskolarngbayan.pup.edu.ph"
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
	 *               guardian:
	 *                 type: object
	 *                 properties:
	 *                   firstName:
	 *                     type: string
	 *                     example: "Jane"
	 *                   lastName:
	 *                     type: string
	 *                     example: "Doe"
	 *                   middleName:
	 *                     type: string
	 *                     example: "Smith"
	 *                   contactNumber:
	 *                     type: string
	 *                     example: "+1234567890"
	 *                   relationship:
	 *                     type: string
	 *                     example: "Mother"
	 *                   address:
	 *                     type: object
	 *                     properties:
	 *                       street:
	 *                         type: string
	 *                         example: "456 Guardian St"
	 *                       city:
	 *                         type: string
	 *                         example: "New York"
	 *                       houseNo:
	 *                         type: string
	 *                         example: "456"
	 *                       province:
	 *                         type: string
	 *                         example: "New York"
	 *                       barangay:
	 *                         type: string
	 *                         example: "Downtown"
	 *                       zipCode:
	 *                         type: string
	 *                         example: "10001"
	 *                       country:
	 *                         type: string
	 *                         example: "USA"
	 *                       type:
	 *                         type: string
	 *                         example: "Home"
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
	 *                     - "Only PUP email addresses (@iskolarngbayan.pup.edu.ph) are allowed"
	 *                     - "Person with this email already exists"
	 *                     - "Username already exists. Please choose a different username."
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/register", controller.register);
	routes.post("/register-regular-email", controller.registerUsingRegularEmail);

	/**
	 * @openapi
	 * /api/auth/register-admin:
	 *   post:
	 *     summary: Register a new admin user
	 *     description: Register a new admin user with email and password. Creates both user and person records with admin role and guidance type.
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
	 *                 example: "admin@iskolarngbayan.pup.edu.ph"
	 *               password:
	 *                 type: string
	 *                 minLength: 6
	 *                 example: "adminPassword123"
	 *               userName:
	 *                 type: string
	 *                 example: "admin"
	 *                 description: "Optional - defaults to email if not provided"
	 *               firstName:
	 *                 type: string
	 *                 example: "Admin"
	 *               lastName:
	 *                 type: string
	 *                 example: "User"
	 *               middleName:
	 *                 type: string
	 *                 example: "System"
	 *               suffix:
	 *                 type: string
	 *                 example: "Sr."
	 *               contactNumber:
	 *                 type: string
	 *                 example: "+1234567890"
	 *               gender:
	 *                 type: string
	 *                 example: "Male"
	 *               birthDate:
	 *                 type: string
	 *                 format: date
	 *                 example: "1980-01-01"
	 *               birthPlace:
	 *                 type: string
	 *                 example: "Admin City"
	 *               age:
	 *                 type: integer
	 *                 example: 40
	 *               religion:
	 *                 type: string
	 *                 example: "Christian"
	 *               civilStatus:
	 *                 type: string
	 *                 example: "Married"
	 *               address:
	 *                 type: object
	 *                 properties:
	 *                   street:
	 *                     type: string
	 *                     example: "456 Admin St"
	 *                   city:
	 *                     type: string
	 *                     example: "Admin City"
	 *                   houseNo:
	 *                     type: string
	 *                     example: "456"
	 *                   province:
	 *                     type: string
	 *                     example: "Admin Province"
	 *                   barangay:
	 *                     type: string
	 *                     example: "Admin Barangay"
	 *                   zipCode:
	 *                     type: string
	 *                     example: "20001"
	 *                   country:
	 *                     type: string
	 *                     example: "USA"
	 *                   type:
	 *                     type: string
	 *                     example: "Office"
	 *               guardian:
	 *                 type: object
	 *                 properties:
	 *                   firstName:
	 *                     type: string
	 *                     example: "Guardian"
	 *                   lastName:
	 *                     type: string
	 *                     example: "Name"
	 *                   middleName:
	 *                     type: string
	 *                     example: "Middle"
	 *                   contactNumber:
	 *                     type: string
	 *                     example: "+1234567890"
	 *                   relationship:
	 *                     type: string
	 *                     example: "Spouse"
	 *                   address:
	 *                     type: object
	 *                     properties:
	 *                       street:
	 *                         type: string
	 *                         example: "789 Guardian St"
	 *                       city:
	 *                         type: string
	 *                         example: "Guardian City"
	 *                       houseNo:
	 *                         type: string
	 *                         example: "789"
	 *                       province:
	 *                         type: string
	 *                         example: "Guardian Province"
	 *                       barangay:
	 *                         type: string
	 *                         example: "Guardian Barangay"
	 *                       zipCode:
	 *                         type: string
	 *                         example: "30001"
	 *                       country:
	 *                         type: string
	 *                         example: "USA"
	 *                       type:
	 *                         type: string
	 *                         example: "Home"
	 *     responses:
	 *       201:
	 *         description: Admin user registered successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Admin registration successful"
	 *                 user:
	 *                   $ref: '#/components/schemas/User'
	 *                 token:
	 *                   type: string
	 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
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
	 *                     - "Only PUP email addresses (@iskolarngbayan.pup.edu.ph) are allowed"
	 *                     - "Person with this email already exists"
	 *                     - "Username already exists. Please choose a different username."
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/register-admin", controller.registerAdmin);

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
	 *                 example: "john.doe@iskolarngbayan.pup.edu.ph"
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
	 *                     - "Only PUP email addresses (@iskolarngbayan.pup.edu.ph) are allowed"
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/login", controller.login);

	/**
	 * @openapi
	 * /api/auth/verify-email:
	 *   post:
	 *     summary: Verify email with OTP
	 *     description: Verify user's email address using the 6-digit OTP code sent during registration
	 *     tags: [Auth]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - email
	 *               - otp
	 *             properties:
	 *               email:
	 *                 type: string
	 *                 format: email
	 *                 example: "john.doe@iskolarngbayan.pup.edu.ph"
	 *               otp:
	 *                 type: string
	 *                 pattern: '^[0-9]{6}$'
	 *                 example: "123456"
	 *                 description: "6-digit verification code"
	 *     responses:
	 *       200:
	 *         description: Email verified successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Email verified successfully"
	 *                 emailVerified:
	 *                   type: boolean
	 *                   example: true
	 *       400:
	 *         description: Bad request (invalid OTP, expired, etc.)
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   examples:
	 *                     - "Email is required"
	 *                     - "OTP is required"
	 *                     - "Only PUP email addresses (@iskolarngbayan.pup.edu.ph) are allowed"
	 *                     - "Invalid verification code"
	 *                     - "Verification code has expired. Please register again."
	 *                     - "No verification code found. Please register again."
	 *       404:
	 *         description: User not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "User not found"
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/verify-email", controller.verifyEmail);

	/**
	 * @openapi
	 * /api/auth/resend-otp:
	 *   post:
	 *     summary: Resend OTP verification code
	 *     description: Resend a new 6-digit OTP code to the user's email address
	 *     tags: [Auth]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - email
	 *             properties:
	 *               email:
	 *                 type: string
	 *                 format: email
	 *                 example: "john.doe@iskolarngbayan.pup.edu.ph"
	 *     responses:
	 *       200:
	 *         description: New OTP sent successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "New verification code sent to your email"
	 *                 otpSent:
	 *                   type: boolean
	 *                   example: true
	 *       400:
	 *         description: Bad request
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   examples:
	 *                     - "Email is required"
	 *                     - "Only PUP email addresses (@iskolarngbayan.pup.edu.ph) are allowed"
	 *       404:
	 *         description: User not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "User not found"
	 *       500:
	 *         description: Internal server error or email service unavailable
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   examples:
	 *                     - "Email service not available"
	 *                     - "Failed to send verification code"
	 */
	routes.post("/resend-otp", controller.resendOTP);

	route.use(path, routes);

	return route;
};
