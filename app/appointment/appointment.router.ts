import { Router, Request, Response, NextFunction } from "express";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	create(req: Request, res: Response, next: NextFunction): Promise<void>;
	update(req: Request, res: Response, next: NextFunction): Promise<void>;
	remove(req: Request, res: Response, next: NextFunction): Promise<void>;
	getByStudentId(req: Request, res: Response, next: NextFunction): Promise<void>;
	getByCounselorId(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/appointment";

	/**
	 * @openapi
	 * /api/appointment/{id}:
	 *   get:
	 *     summary: Get appointment by id
	 *     description: Get appointment by id with optional field selection using dot notation
	 *     tags: [Appointment]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Appointment ID
	 *       - in: query
	 *         name: fields
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include (supports dot notation for nested fields)
	 *         example: "id,title,status,student.person.firstName,counselor.person.firstName"
	 *     responses:
	 *       200:
	 *         description: Returns appointment data
	 *       400:
	 *         description: Missing ID or invalid fields parameter
	 *       404:
	 *         description: Appointment not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/:id", controller.getById);

	/**
	 * @openapi
	 * /api/appointment:
	 *   get:
	 *     summary: Get all appointments
	 *     description: Get all appointments with pagination, sorting, field selection, and search functionality
	 *     tags: [Appointment]
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
	 *         example: "requestedDate"
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
	 *         example: "id,title,status,requestedDate,student.person.firstName,counselor.person.firstName"
	 *       - in: query
	 *         name: query
	 *         schema:
	 *           type: string
	 *         description: Search query to filter results by title, description, or student/counselor names
	 *         example: "consultation"
	 *       - in: query
	 *         name: status
	 *         schema:
	 *           type: string
	 *           enum: [pending, confirmed, cancelled, completed, no_show, rescheduled]
	 *         description: Filter by appointment status
	 *       - in: query
	 *         name: studentId
	 *         schema:
	 *           type: string
	 *         description: Filter by specific student ID
	 *       - in: query
	 *         name: counselorId
	 *         schema:
	 *           type: string
	 *         description: Filter by specific counselor ID
	 *       - in: query
	 *         name: dateFrom
	 *         schema:
	 *           type: string
	 *           format: date-time
	 *         description: Filter appointments starting from this date
	 *       - in: query
	 *         name: dateTo
	 *         schema:
	 *           type: string
	 *           format: date-time
	 *         description: Filter appointments ending before this date
	 *       - in: query
	 *         name: type
	 *         schema:
	 *           type: string
	 *           enum: [consultation, counseling, follow_up, emergency, group_session]
	 *         description: Filter by appointment type
	 *     responses:
	 *       200:
	 *         description: Returns paginated appointments list with total count and page info
	 *       400:
	 *         description: Invalid parameters
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/", controller.getAll);

	/**
	 * @openapi
	 * /api/appointment/student/{studentId}:
	 *   get:
	 *     summary: Get appointments by student ID
	 *     description: Get all appointments for a specific student with pagination and filtering
	 *     tags: [Appointment]
	 *     parameters:
	 *       - in: path
	 *         name: studentId
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Student ID
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
	 *         name: status
	 *         schema:
	 *           type: string
	 *           enum: [pending, confirmed, cancelled, completed, no_show, rescheduled]
	 *         description: Filter by appointment status
	 *       - in: query
	 *         name: dateFrom
	 *         schema:
	 *           type: string
	 *           format: date-time
	 *         description: Filter appointments starting from this date
	 *       - in: query
	 *         name: dateTo
	 *         schema:
	 *           type: string
	 *           format: date-time
	 *         description: Filter appointments ending before this date
	 *     responses:
	 *       200:
	 *         description: Returns student's appointments with pagination info
	 *       400:
	 *         description: Missing student ID or invalid parameters
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/student/:studentId", controller.getByStudentId);

	/**
	 * @openapi
	 * /api/appointment/counselor/{counselorId}:
	 *   get:
	 *     summary: Get appointments by counselor ID
	 *     description: Get all appointments for a specific counselor with pagination and filtering
	 *     tags: [Appointment]
	 *     parameters:
	 *       - in: path
	 *         name: counselorId
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Counselor ID
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
	 *         name: status
	 *         schema:
	 *           type: string
	 *           enum: [pending, confirmed, cancelled, completed, no_show, rescheduled]
	 *         description: Filter by appointment status
	 *       - in: query
	 *         name: dateFrom
	 *         schema:
	 *           type: string
	 *           format: date-time
	 *         description: Filter appointments starting from this date
	 *       - in: query
	 *         name: dateTo
	 *         schema:
	 *           type: string
	 *           format: date-time
	 *         description: Filter appointments ending before this date
	 *     responses:
	 *       200:
	 *         description: Returns counselor's appointments with pagination info
	 *       400:
	 *         description: Missing counselor ID or invalid parameters
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/counselor/:counselorId", controller.getByCounselorId);

	/**
	 * @openapi
	 * /api/appointment:
	 *   post:
	 *     summary: Create a new appointment request
	 *     description: Creates a new appointment request between a student and counselor for a specific schedule
	 *     tags: [Appointment]
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
	 *               - counselorId
	 *               - scheduleId
	 *               - requestedDate
	 *             properties:
	 *               studentId:
	 *                 type: string
	 *                 example: "student-123"
	 *                 description: ID of the student requesting appointment
	 *               counselorId:
	 *                 type: string
	 *                 example: "counselor-456"
	 *                 description: ID of the guidance counselor
	 *               scheduleId:
	 *                 type: string
	 *                 example: "schedule-789"
	 *                 description: ID of the available schedule slot
	 *               title:
	 *                 type: string
	 *                 example: "Academic Consultation"
	 *                 description: Title of the appointment
	 *               description:
	 *                 type: string
	 *                 example: "Need help with course selection"
	 *                 description: Description of appointment purpose
	 *               appointmentType:
	 *                 type: string
	 *                 enum: [consultation, counseling, follow_up, emergency, group_session]
	 *                 default: consultation
	 *                 description: Type of appointment
	 *               requestedDate:
	 *                 type: string
	 *                 format: date-time
	 *                 example: "2024-01-15T10:00:00Z"
	 *                 description: Requested date and time for appointment
	 *               priority:
	 *                 type: string
	 *                 enum: [low, normal, high, urgent]
	 *                 default: normal
	 *                 description: Priority level of appointment
	 *               location:
	 *                 type: string
	 *                 example: "Guidance Office Room 101"
	 *                 description: Meeting location (defaults to schedule location)
	 *               duration:
	 *                 type: integer
	 *                 minimum: 15
	 *                 default: 60
	 *                 description: Duration in minutes
	 *               attachments:
	 *                 type: array
	 *                 items:
	 *                   type: string
	 *                 description: Array of attachment URLs or file references
	 *     responses:
	 *       201:
	 *         description: Appointment request created successfully
	 *       400:
	 *         description: Bad request - validation errors, schedule conflicts, or fully booked
	 *       404:
	 *         description: Student, counselor, or schedule not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/", controller.create);

	/**
	 * @openapi
	 * /api/appointment/{id}:
	 *   patch:
	 *     summary: Update appointment status or details
	 *     description: Update appointment data including status changes, rescheduling, or completion notes
	 *     tags: [Appointment]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Appointment ID
	 *     requestBody:
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               status:
	 *                 type: string
	 *                 enum: [pending, confirmed, cancelled, completed, no_show, rescheduled]
	 *                 description: New appointment status
	 *               title:
	 *                 type: string
	 *                 example: "Updated Consultation"
	 *               description:
	 *                 type: string
	 *                 example: "Updated description"
	 *               appointmentType:
	 *                 type: string
	 *                 enum: [consultation, counseling, follow_up, emergency, group_session]
	 *               requestedDate:
	 *                 type: string
	 *                 format: date-time
	 *                 example: "2024-01-15T14:00:00Z"
	 *                 description: Rescheduled date and time
	 *               priority:
	 *                 type: string
	 *                 enum: [low, normal, high, urgent]
	 *               location:
	 *                 type: string
	 *                 example: "Guidance Office Room 102"
	 *               duration:
	 *                 type: integer
	 *                 minimum: 15
	 *               cancellationReason:
	 *                 type: string
	 *                 example: "Student conflict"
	 *                 description: Reason for cancellation (required when status is 'cancelled')
	 *               completionNotes:
	 *                 type: string
	 *                 example: "Student received guidance on course selection"
	 *                 description: Notes added when appointment is completed
	 *               followUpRequired:
	 *                 type: boolean
	 *                 description: Whether follow-up is needed
	 *               followUpDate:
	 *                 type: string
	 *                 format: date-time
	 *                 description: Suggested follow-up date
	 *               attachments:
	 *                 type: array
	 *                 items:
	 *                   type: string
	 *                 description: Updated attachment list
	 *     responses:
	 *       200:
	 *         description: Appointment updated successfully
	 *       400:
	 *         description: Bad request - validation errors or no update fields
	 *       404:
	 *         description: Appointment not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.patch("/:id", controller.update);

	/**
	 * @openapi
	 * /api/appointment/{id}:
	 *   delete:
	 *     summary: Soft delete appointment
	 *     description: Mark appointment as deleted and free up the schedule slot if it was confirmed
	 *     tags: [Appointment]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Appointment ID
	 *     responses:
	 *       200:
	 *         description: Appointment deleted successfully
	 *       400:
	 *         description: Missing appointment ID
	 *       404:
	 *         description: Appointment not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.delete("/:id", controller.remove);

	route.use(path, routes);

	return route;
};
