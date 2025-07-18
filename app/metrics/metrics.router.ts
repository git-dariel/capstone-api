import { Router, Request, Response, NextFunction } from "express";

interface IController {
	search(req: Request, res: Response, next: NextFunction): Promise<void>;
	generateMLGraphs(req: Request, res: Response, next: NextFunction): Promise<void>;
	getDecisionTreeGraph(req: Request, res: Response, next: NextFunction): Promise<void>;
	getRandomForestGraph(req: Request, res: Response, next: NextFunction): Promise<void>;
	getChartData(req: Request, res: Response, next: NextFunction): Promise<void>;
	exportGraphData(req: Request, res: Response, next: NextFunction): Promise<void>;
	getTextTreeVisualization(req: Request, res: Response, next: NextFunction): Promise<void>;
	generateDecisionTreeImageEndpoint(
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void>;
	generateFeatureImportanceImageEndpoint(
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void>;
	generatePerformanceMetricsImageEndpoint(
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void>;
	generateConfusionMatrixImageEndpoint(
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void>;
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

	/**
	 * @openapi
	 * /api/metrics/ml-graphs:
	 *   get:
	 *     summary: Generate comprehensive ML graphs and visualizations
	 *     tags: [Metrics, ML Visualization]
	 *     responses:
	 *       200:
	 *         description: ML graphs generated successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                 message:
	 *                   type: string
	 *                 data:
	 *                   type: object
	 *       500:
	 *         description: Server error
	 */
	routes.get("/ml-graphs", controller.generateMLGraphs);

	/**
	 * @openapi
	 * /api/metrics/decision-tree:
	 *   get:
	 *     summary: Get decision tree graph data
	 *     tags: [Metrics, ML Visualization]
	 *     responses:
	 *       200:
	 *         description: Decision tree graph data
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                 message:
	 *                   type: string
	 *                 data:
	 *                   type: object
	 *                   properties:
	 *                     nodes:
	 *                       type: array
	 *                     edges:
	 *                       type: array
	 *                     featureImportance:
	 *                       type: array
	 *                     performanceMetrics:
	 *                       type: object
	 *                     confusionMatrix:
	 *                       type: object
	 *       500:
	 *         description: Server error
	 */
	routes.get("/decision-tree", controller.getDecisionTreeGraph);

	/**
	 * @openapi
	 * /api/metrics/random-forest:
	 *   get:
	 *     summary: Get random forest graph data
	 *     tags: [Metrics, ML Visualization]
	 *     responses:
	 *       200:
	 *         description: Random forest graph data
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                 message:
	 *                   type: string
	 *                 data:
	 *                   type: object
	 *                   properties:
	 *                     treeCount:
	 *                       type: number
	 *                     averageDepth:
	 *                       type: number
	 *                     featureImportance:
	 *                       type: array
	 *                     oobScore:
	 *                       type: number
	 *       500:
	 *         description: Server error
	 */
	routes.get("/random-forest", controller.getRandomForestGraph);

	/**
	 * @openapi
	 * /api/metrics/chart-data:
	 *   get:
	 *     summary: Get chart-ready data for frontend visualization
	 *     tags: [Metrics, ML Visualization]
	 *     responses:
	 *       200:
	 *         description: Chart data for frontend libraries
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                 message:
	 *                   type: string
	 *                 data:
	 *                   type: object
	 *                   properties:
	 *                     featureImportanceChart:
	 *                       type: object
	 *                     performanceChart:
	 *                       type: object
	 *                     confusionMatrixChart:
	 *                       type: object
	 *       500:
	 *         description: Server error
	 */
	routes.get("/chart-data", controller.getChartData);

	/**
	 * @openapi
	 * /api/metrics/export:
	 *   get:
	 *     summary: Export graph data in various formats
	 *     tags: [Metrics, ML Visualization]
	 *     parameters:
	 *       - in: query
	 *         name: format
	 *         schema:
	 *           type: string
	 *           enum: [json, csv, dot]
	 *           default: json
	 *         description: Export format (json, csv, or dot)
	 *     responses:
	 *       200:
	 *         description: Graph data in requested format
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *           text/csv:
	 *             schema:
	 *               type: string
	 *           text/plain:
	 *             schema:
	 *               type: string
	 *       400:
	 *         description: Invalid format
	 *       500:
	 *         description: Server error
	 */
	routes.get("/export", controller.exportGraphData);

	/**
	 * @openapi
	 * /api/metrics/text-tree:
	 *   get:
	 *     summary: Get text-based tree visualization
	 *     tags: [Metrics, ML Visualization]
	 *     responses:
	 *       200:
	 *         description: Text-based tree visualization
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                 message:
	 *                   type: string
	 *                 data:
	 *                   type: object
	 *                   properties:
	 *                     textVisualization:
	 *                       type: string
	 *       500:
	 *         description: Server error
	 */
	routes.get("/text-tree", controller.getTextTreeVisualization);

	/**
	 * @openapi
	 * /api/metrics/images/decision-tree:
	 *   get:
	 *     summary: Generate and download decision tree image
	 *     tags: [Metrics, ML Visualization, Images]
	 *     parameters:
	 *       - in: query
	 *         name: format
	 *         schema:
	 *           type: string
	 *           enum: [png, jpeg]
	 *           default: png
	 *         description: Image format (png or jpeg)
	 *     responses:
	 *       200:
	 *         description: Decision tree image file
	 *         content:
	 *           image/png:
	 *             schema:
	 *               type: string
	 *               format: binary
	 *           image/jpeg:
	 *             schema:
	 *               type: string
	 *               format: binary
	 *       400:
	 *         description: Invalid format
	 *       500:
	 *         description: Server error
	 */
	routes.get("/images/decision-tree", controller.generateDecisionTreeImageEndpoint);

	/**
	 * @openapi
	 * /api/metrics/images/feature-importance:
	 *   get:
	 *     summary: Generate and download feature importance chart image
	 *     tags: [Metrics, ML Visualization, Images]
	 *     parameters:
	 *       - in: query
	 *         name: format
	 *         schema:
	 *           type: string
	 *           enum: [png, jpeg]
	 *           default: png
	 *         description: Image format (png or jpeg)
	 *     responses:
	 *       200:
	 *         description: Feature importance chart image file
	 *         content:
	 *           image/png:
	 *             schema:
	 *               type: string
	 *               format: binary
	 *           image/jpeg:
	 *             schema:
	 *               type: string
	 *               format: binary
	 *       400:
	 *         description: Invalid format
	 *       500:
	 *         description: Server error
	 */
	routes.get("/images/feature-importance", controller.generateFeatureImportanceImageEndpoint);

	/**
	 * @openapi
	 * /api/metrics/images/performance-metrics:
	 *   get:
	 *     summary: Generate and download performance metrics chart image
	 *     tags: [Metrics, ML Visualization, Images]
	 *     parameters:
	 *       - in: query
	 *         name: format
	 *         schema:
	 *           type: string
	 *           enum: [png, jpeg]
	 *           default: png
	 *         description: Image format (png or jpeg)
	 *     responses:
	 *       200:
	 *         description: Performance metrics chart image file
	 *         content:
	 *           image/png:
	 *             schema:
	 *               type: string
	 *               format: binary
	 *           image/jpeg:
	 *             schema:
	 *               type: string
	 *               format: binary
	 *       400:
	 *         description: Invalid format
	 *       500:
	 *         description: Server error
	 */
	routes.get("/images/performance-metrics", controller.generatePerformanceMetricsImageEndpoint);

	/**
	 * @openapi
	 * /api/metrics/images/confusion-matrix:
	 *   get:
	 *     summary: Generate and download confusion matrix image
	 *     tags: [Metrics, ML Visualization, Images]
	 *     parameters:
	 *       - in: query
	 *         name: format
	 *         schema:
	 *           type: string
	 *           enum: [png, jpeg]
	 *           default: png
	 *         description: Image format (png or jpeg)
	 *     responses:
	 *       200:
	 *         description: Confusion matrix image file
	 *         content:
	 *           image/png:
	 *             schema:
	 *               type: string
	 *               format: binary
	 *           image/jpeg:
	 *             schema:
	 *               type: string
	 *               format: binary
	 *       400:
	 *         description: Invalid format
	 *       500:
	 *         description: Server error
	 */
	routes.get("/images/confusion-matrix", controller.generateConfusionMatrixImageEndpoint);

	route.use(path, routes);
	return route;
};
