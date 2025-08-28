import { Router, Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/verifyToken";

interface IController {
	getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
	getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
	create(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
	update(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
	remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
	getAvailable(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/schedule";

	/**
	 * @openapi
	 * /api/schedule/{id}:
	 *   get:
	 *     summary: Get schedule by id
	 *     description: Get schedule by id with optional field selection using dot notation
	 *     tags: [Schedule]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Schedule ID
	 *       - in: query
	 *         name: fields
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include (supports dot notation for nested fields)
	 *         example: "id,title,startTime,endTime,counselor.person.firstName"
	 *     responses:
	 *       200:
	 *         description: Returns schedule data
	 *       400:
	 *         description: Missing ID or invalid fields parameter
	 *       404:
	 *         description: Schedule not found
	 *       500:
	 *         description: Internal server error
	 */
	// IMPORTANT: define static routes before dynamic ':id' route to avoid conflicts
	// Available schedules should be resolved before '/:id'
	routes.get("/available", controller.getAvailable);

	/**
	 * @openapi
	 * /api/schedule:
	 *   get:
	 *     summary: Get all schedules
	 *     description: Get all schedules with pagination, sorting, field selection, and search functionality
	 *     tags: [Schedule]
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
	 *         example: "startTime"
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
	 *         example: "id,title,startTime,endTime,counselor.person.firstName"
	 *       - in: query
	 *         name: query
	 *         schema:
	 *           type: string
	 *         description: Search query to filter results by title, description, location, notes, or counselor name
	 *         example: "consultation"
	 *       - in: query
	 *         name: counselorId
	 *         schema:
	 *           type: string
	 *         description: Filter by specific counselor ID
	 *       - in: query
	 *         name: status
	 *         schema:
	 *           type: string
	 *           enum: [available, booked, unavailable, cancelled]
	 *         description: Filter by schedule status
	 *       - in: query
	 *         name: from
	 *         schema:
	 *           type: string
	 *           format: date-time
	 *         description: Filter schedules starting from this date
	 *       - in: query
	 *         name: to
	 *         schema:
	 *           type: string
	 *           format: date-time
	 *         description: Filter schedules ending before this date
	 *     responses:
	 *       200:
	 *         description: Returns paginated schedules list with total count and page info
	 *       400:
	 *         description: Invalid parameters
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/", controller.getAll);

	/**
	 * @openapi
	 * /api/schedule/available:
	 *   get:
	 *     summary: Get available schedules
	 *     description: Get schedules that are available for booking by students
	 *     tags: [Schedule]
	 *     parameters:
	 *       - in: query
	 *         name: counselorId
	 *         schema:
	 *           type: string
	 *         description: Filter by specific counselor ID
	 *       - in: query
	 *         name: from
	 *         schema:
	 *           type: string
	 *           format: date-time
	 *         description: Filter schedules starting from this date
	 *       - in: query
	 *         name: to
	 *         schema:
	 *           type: string
	 *           format: date-time
	 *         description: Filter schedules ending before this date
	 *     responses:
	 *       200:
	 *         description: Returns available schedules
	 *       500:
	 *         description: Internal server error
	 */
	// Finally, dynamic route for getting by ID
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/schedule:
	 *   post:
	 *     summary: Create a new schedule
	 *     description: Creates a new schedule for a guidance counselor
	 *     tags: [Schedule]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - startTime
	 *               - endTime
	 *             properties:
	 *               title:
	 *                 type: string
	 *                 example: "Morning Consultation"
	 *                 description: Schedule title
	 *               description:
	 *                 type: string
	 *                 example: "Available for student consultations"
	 *                 description: Schedule description
	 *               startTime:
	 *                 type: string
	 *                 format: date-time
	 *                 example: "2024-01-15T09:00:00Z"
	 *                 description: Start time of availability
	 *               endTime:
	 *                 type: string
	 *                 format: date-time
	 *                 example: "2024-01-15T12:00:00Z"
	 *                 description: End time of availability
	 *               isRecurring:
	 *                 type: boolean
	 *                 default: false
	 *                 description: Whether this is a recurring schedule
	 *               recurringType:
	 *                 type: string
	 *                 enum: [none, daily, weekly, monthly]
	 *                 default: none
	 *                 description: Type of recurrence
	 *               maxSlots:
	 *                 type: integer
	 *                 minimum: 1
	 *                 default: 1
	 *                 description: Maximum number of appointments for this time slot
	 *               location:
	 *                 type: string
	 *                 example: "Guidance Office Room 101"
	 *                 description: Meeting location
	 *               notes:
	 *                 type: string
	 *                 example: "Please bring relevant documents"
	 *                 description: Additional notes
	 *     responses:
	 *       201:
	 *         description: Schedule created successfully
	 *       400:
	 *         description: Bad request - validation errors or overlapping schedule
	 *       401:
	 *         description: Authentication required
	 *       403:
	 *         description: Only guidance counselors can create schedules
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/", controller.create);

	/**
	 * @openapi
	 * /api/schedule/{id}:
	 *   patch:
	 *     summary: Update schedule
	 *     description: Update schedule data (only by the counselor who owns it)
	 *     tags: [Schedule]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Schedule ID
	 *     requestBody:
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               title:
	 *                 type: string
	 *                 example: "Afternoon Consultation"
	 *               description:
	 *                 type: string
	 *                 example: "Updated description"
	 *               startTime:
	 *                 type: string
	 *                 format: date-time
	 *                 example: "2024-01-15T14:00:00Z"
	 *               endTime:
	 *                 type: string
	 *                 format: date-time
	 *                 example: "2024-01-15T17:00:00Z"
	 *               status:
	 *                 type: string
	 *                 enum: [available, booked, unavailable, cancelled]
	 *               isRecurring:
	 *                 type: boolean
	 *               recurringType:
	 *                 type: string
	 *                 enum: [none, daily, weekly, monthly]
	 *               maxSlots:
	 *                 type: integer
	 *                 minimum: 1
	 *               location:
	 *                 type: string
	 *               notes:
	 *                 type: string
	 *     responses:
	 *       200:
	 *         description: Schedule updated successfully
	 *       400:
	 *         description: Bad request - validation errors
	 *       401:
	 *         description: Authentication required
	 *       404:
	 *         description: Schedule not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/schedule/{id}:
	 *   delete:
	 *     summary: Soft delete schedule
	 *     description: Mark schedule as deleted (only if no active appointments)
	 *     tags: [Schedule]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Schedule ID
	 *     responses:
	 *       200:
	 *         description: Schedule deleted successfully
	 *       400:
	 *         description: Cannot delete schedule with active appointments
	 *       401:
	 *         description: Authentication required
	 *       404:
	 *         description: Schedule not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.put("/:id", controller.remove);

	route.use(path, routes);

	return route;
};
