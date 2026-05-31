import { Router, Request, Response, NextFunction } from "express";
import { Role } from "../../generated/prisma";
import verifyToken from "../../middleware/verifyToken";
import verifyRole from "../../middleware/verifyRole";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): Promise<void>;
	getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
	getStatistics(req: Request, res: Response, next: NextFunction): Promise<void>;
	exportLogs(req: Request, res: Response, next: NextFunction): Promise<void>;
	deleteOldLogs(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/audit-logs";

	/**
	 * @openapi
	 * /api/audit-logs/statistics:
	 *   get:
	 *     summary: Get audit log statistics
	 *     description: Get statistics about audit logs including counts by action and severity
	 *     tags: [Audit Logs]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Returns audit log statistics
	 *       401:
	 *         description: Unauthorized - Authentication required
	 *       403:
	 *         description: Forbidden - Admin access required
	 *       500:
	 *         description: Internal server error
	 */
	routes.get(
		"/statistics",
		verifyToken,
		verifyRole([Role.admin, Role.super_admin]),
		controller.getStatistics,
	);

	/**
	 * @openapi
	 * /api/audit-logs/export:
	 *   get:
	 *     summary: Export audit logs
	 *     description: Export audit logs in CSV format with filtering options
	 *     tags: [Audit Logs]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: query
	 *         name: startDate
	 *         schema:
	 *           type: string
	 *           format: date-time
	 *         description: Start date for filtering logs
	 *       - in: query
	 *         name: endDate
	 *         schema:
	 *           type: string
	 *           format: date-time
	 *         description: End date for filtering logs
	 *       - in: query
	 *         name: action
	 *         schema:
	 *           type: string
	 *         description: Filter by action type
	 *     responses:
	 *       200:
	 *         description: Returns CSV file with audit logs
	 *         content:
	 *           text/csv:
	 *             schema:
	 *               type: string
	 *               format: binary
	 *       401:
	 *         description: Unauthorized - Authentication required
	 *       403:
	 *         description: Forbidden - Admin access required
	 *       500:
	 *         description: Internal server error
	 */
	routes.get(
		"/export",
		verifyToken,
		verifyRole([Role.admin, Role.super_admin]),
		controller.exportLogs,
	);

	/**
	 * @openapi
	 * /api/audit-logs/{id}:
	 *   get:
	 *     summary: Get audit log by ID
	 *     description: Get a specific audit log by ID with optional field selection
	 *     tags: [Audit Logs]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Audit log ID
	 *       - in: query
	 *         name: fields
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include
	 *     responses:
	 *       200:
	 *         description: Returns audit log data
	 *       400:
	 *         description: Missing ID or invalid fields parameter
	 *       401:
	 *         description: Unauthorized - Authentication required
	 *       403:
	 *         description: Forbidden - Admin access required
	 *       404:
	 *         description: Audit log not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/:id", verifyToken, verifyRole([Role.admin, Role.super_admin]), controller.getById);

	/**
	 * @openapi
	 * /api/audit-logs:
	 *   get:
	 *     summary: Get all audit logs
	 *     description: Get all audit logs with pagination, filtering, and sorting options
	 *     tags: [Audit Logs]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: query
	 *         name: page
	 *         schema:
	 *           type: integer
	 *         description: Page number (default 1)
	 *       - in: query
	 *         name: limit
	 *         schema:
	 *           type: integer
	 *         description: Records per page (default 10)
	 *       - in: query
	 *         name: userId
	 *         schema:
	 *           type: string
	 *         description: Filter by user ID
	 *       - in: query
	 *         name: action
	 *         schema:
	 *           type: string
	 *         description: Filter by action type
	 *       - in: query
	 *         name: module
	 *         schema:
	 *           type: string
	 *         description: Filter by module name
	 *       - in: query
	 *         name: severity
	 *         schema:
	 *           type: string
	 *         description: Filter by log severity
	 *     responses:
	 *       200:
	 *         description: Returns paginated audit logs list
	 *       401:
	 *         description: Unauthorized - Authentication required
	 *       403:
	 *         description: Forbidden - Admin access required
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/", verifyToken, verifyRole([Role.admin, Role.super_admin]), controller.getAll);

	/**
	 * @openapi
	 * /api/audit-logs/cleanup:
	 *   delete:
	 *     summary: Delete old audit logs
	 *     description: Delete audit logs based on retention policy (soft delete)
	 *     tags: [Audit Logs]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Old audit logs deleted successfully
	 *       401:
	 *         description: Unauthorized - Authentication required
	 *       403:
	 *         description: Forbidden - Super admin access required
	 *       500:
	 *         description: Internal server error
	 */
	routes.delete(
		"/cleanup",
		verifyToken,
		verifyRole([Role.super_admin]),
		controller.deleteOldLogs,
	);

	route.use(path, routes);

	return route;
};
