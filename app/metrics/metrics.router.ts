import { Router, Request, Response, NextFunction } from "express";

interface IController {
	search(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/metrics";

	/**
	 * @openapi
	 * /api/metrics:
	 *   post:
	 *     summary: Search metrics data
	 *     tags: [Metrics]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               model:
	 *                 type: string
	 *               data:
	 *                 type: array
	 *                 items:
	 *                   type: string
	 *               filter:
	 *                 type: object
	 *             required:
	 *               - model
	 *               - data
	 *     responses:
	 *       200:
	 *         description: Successful metric search
	 *       400:
	 *         description: Bad request
	 *       500:
	 *         description: Server error
	 */
	routes.post("/", controller.search);

	route.use(path, routes);
	return route;
};
