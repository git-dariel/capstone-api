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

	route.use(path, routes);

	return route;
};
