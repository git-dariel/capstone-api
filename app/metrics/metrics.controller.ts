import { NextFunction, Request, Response } from "express";
import { config } from "../../config/error.config";
import { METRIC } from "../../config/metrics.config";
import { PrismaClient } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import {
	generateConfusionMatrixImage,
	generateDecisionTreeImage,
	generateFeatureImportanceImage,
	generateMLVisualizationDemo,
	generatePerformanceMetricsImage,
	generateTextTreeVisualization,
	mentalHealthPredictor,
} from "../../helper/ml.helper";
import { requireAnyRole } from "../../middleware/rbac";
import { AuthRequest } from "../../middleware/verifyToken";

const logger = getLogger();
const metricsLogger = logger.child({ module: "metrics" });

type FacetQuerySet = Record<string, () => Promise<any>>;

const searchMetrics = async (
	prisma: PrismaClient,
	model: string,
	data: string[],
	filter: any,
	methodParams?: Record<string, any>,
): Promise<Record<string, any>[]> => {
	console.log("📊 Starting searchMetrics");
	console.log("🔧 Model:", model);
	console.log("🧮 Data:", data);
	console.log("🔎 Filter:", filter);
	console.log("📋 Method params:", methodParams);

	let facetObject: ReturnType<typeof METRIC>;
	try {
		facetObject = METRIC(prisma, filter);
	} catch (e) {
		metricsLogger.error("❌ Failed to construct METRIC config", { error: e });
		throw new Error("Failed to initialize metric definitions.");
	}

	const normalizedModel = model.toLowerCase();

	const matchedModelEntry = Object.entries(facetObject).find(
		([key]) => key.toLowerCase() === normalizedModel,
	);

	if (!matchedModelEntry) {
		metricsLogger.error(`❌ Invalid model: ${model}`, {
			availableModels: Object.keys(facetObject),
		});
		throw new Error(`Invalid model: ${model}`);
	}

	const [, facetModel] = matchedModelEntry as [string, FacetQuerySet];

	const normalizedDataMap = new Map(
		Object.keys(facetModel).map((key) => [key.toLowerCase(), key]),
	);

	const facetQueries = data
		.map((facetKey) => {
			const originalKey = normalizedDataMap.get(facetKey.toLowerCase());
			const queryFn = originalKey && facetModel[originalKey];

			if (!queryFn) {
				metricsLogger.warn(`❗ Unknown metric key "${facetKey}" for model "${model}"`);
				return null;
			}

			return [originalKey, queryFn] as [string, (...args: any[]) => Promise<any>];
		})
		.filter((entry): entry is [string, (...args: any[]) => Promise<any>] => entry !== null);

	if (facetQueries.length === 0) {
		metricsLogger.warn(`⚠️ No valid facet keys matched for model "${model}"`);
		return [];
	}

	const results = await Promise.all(
		facetQueries.map(async ([key, queryFn]) => {
			try {
				// Pass specific parameters based on the method
				let result;
				if (key === "assessmentTrends" && methodParams?.timeRange) {
					result = await queryFn(methodParams.timeRange);
				} else if (
					key === "assessmentHistory" &&
					(methodParams?.assessmentType || methodParams?.limit)
				) {
					result = await queryFn(methodParams.assessmentType, methodParams.limit);
				} else {
					result = await queryFn();
				}
				return [key, result];
			} catch (e) {
				metricsLogger.error(`❌ Failed to fetch metric "${key}"`, { error: e });
				return [key, null];
			}
		}),
	);

	return [Object.fromEntries(results)];
};

// 👇 Controller Export
export const controller = (prisma: PrismaClient) => {
	console.log("📌 metrics.controller.ts loaded with Prisma:", !!prisma);

	const search = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
		try {
			const { model, data, filter, methodParams } = req.body;

			if (!model || !Array.isArray(data)) {
				metricsLogger.error("❌ Invalid input for metrics search", { model, data });
				res.status(400).json({ error: "Model and data[] are required" });
				return;
			}

			const result = await searchMetrics(prisma, model, data, filter, methodParams);
			res.status(200).json({ data: result });
		} catch (error: any) {
			const status = (error.status || 500) as keyof typeof config;
			metricsLogger.error("❌ Error in metrics search controller", {
				status,
				message: error.message,
			});
			res.status(Number(status)).json({
				error: config[status] || "Internal Server Error",
				details: error.message,
			});
		}
	};

	const dashboard = requireAnyRole(
		async (req: AuthRequest, res: Response, _next: NextFunction): Promise<void> => {
			try {
				const { data, filter: requestFilter, methodParams } = req.body;

				if (!Array.isArray(data)) {
					metricsLogger.error("❌ Invalid input for dashboard request", { data });
					res.status(400).json({ error: "data[] array is required" });
					return;
				}

				// Determine model based on request URL
				let model = "UserDashboard"; // default for student dashboard
				if (req.originalUrl.includes("/guidance/dashboard")) {
					model = "GuidanceDashboard";
				}

				// Create filter with authenticated user context and merge with request filter
				const filter = {
					userFilter: { id: req.userId },
					...(requestFilter || {}),
				};

				metricsLogger.info(
					`📊 Dashboard request for user: ${req.userId}, methods: ${data.join(", ")}, filter: ${JSON.stringify(filter)}, methodParams: ${JSON.stringify(methodParams)}`,
				);

				const result = await searchMetrics(prisma, model, data, filter, methodParams);
				res.status(200).json({ data: result });
			} catch (error: any) {
				const status = (error.status || 500) as keyof typeof config;
				metricsLogger.error("❌ Error in dashboard controller", {
					status,
					message: error.message,
					userId: req.userId,
				});
				res.status(Number(status)).json({
					error: config[status] || "Internal Server Error",
					details: error.message,
				});
			}
		},
	);

	const generateMLGraphs = async (
		req: Request,
		res: Response,
		_next: NextFunction,
	): Promise<void> => {
		try {
			metricsLogger.info("🌳 Generating ML graphs and visualizations");

			// Generate comprehensive ML visualization data
			const visualizationData = await generateMLVisualizationDemo();

			res.status(200).json({
				success: true,
				message: "ML graphs generated successfully",
				data: visualizationData,
			});
		} catch (error: any) {
			const status = (error.status || 500) as keyof typeof config;
			metricsLogger.error("❌ Error generating ML graphs", {
				status,
				message: error.message,
			});
			res.status(Number(status)).json({
				error: config[status] || "Internal Server Error",
				details: error.message,
			});
		}
	};

	const getDecisionTreeGraph = async (
		req: Request,
		res: Response,
		_next: NextFunction,
	): Promise<void> => {
		try {
			metricsLogger.info("🌳 Generating decision tree graph data");

			// Generate decision tree graph data
			const graphData = await mentalHealthPredictor.generateGraphData();

			res.status(200).json({
				success: true,
				message: "Decision tree graph generated successfully",
				data: {
					nodes: graphData.nodes,
					edges: graphData.edges,
					featureImportance: graphData.featureImportance,
					performanceMetrics: graphData.performanceMetrics,
					confusionMatrix: graphData.confusionMatrix,
				},
			});
		} catch (error: any) {
			const status = (error.status || 500) as keyof typeof config;
			metricsLogger.error("❌ Error generating decision tree graph", {
				status,
				message: error.message,
			});
			res.status(Number(status)).json({
				error: config[status] || "Internal Server Error",
				details: error.message,
			});
		}
	};

	const getRandomForestGraph = async (
		req: Request,
		res: Response,
		_next: NextFunction,
	): Promise<void> => {
		try {
			metricsLogger.info("🌲 Generating random forest graph data");

			// Generate random forest visualization data
			const randomForestData = mentalHealthPredictor.generateRandomForestData();

			res.status(200).json({
				success: true,
				message: "Random forest graph generated successfully",
				data: randomForestData,
			});
		} catch (error: any) {
			const status = (error.status || 500) as keyof typeof config;
			metricsLogger.error("❌ Error generating random forest graph", {
				status,
				message: error.message,
			});
			res.status(Number(status)).json({
				error: config[status] || "Internal Server Error",
				details: error.message,
			});
		}
	};

	const getChartData = async (
		req: Request,
		res: Response,
		_next: NextFunction,
	): Promise<void> => {
		try {
			// Get days parameter from query, default to 7 days
			const days = parseInt(req.query.days as string) || 7;
			metricsLogger.info(`📊 Generating chart data for frontend dashboard (${days} days)`);

			// Get dashboard chart data using real metrics
			const metrics = METRIC(prisma);

			// Get assessment counts for breakdown
			const [anxietyTotal, depressionTotal, stressTotal, checklistTotal, suicideTotal] =
				await Promise.all([
					metrics.Anxiety.totalAnxiety(),
					metrics.Depression.totalDepression(),
					metrics.Stress.totalStress(),
					metrics.PersonalProblemsChecklist.totalChecklist(),
					metrics.Suicide.totalSuicide(),
				]);

			// Get specialized dashboard data
			const [trendsData, severityData, monthlyData] = await Promise.all([
				metrics.Dashboard.getRecentTrends(days), // Dynamic days based on query parameter
				metrics.Dashboard.getSeverityDistribution(),
				metrics.Dashboard.getMonthlyStats(6), // Last 6 months
			]);

			metricsLogger.info(
				`📊 Trends data received: ${trendsData.length} data points for ${days} days`,
			);

			// Get program-wise breakdowns for additional insights (no date filtering)
			const [
				anxietyByProgram,
				depressionByProgram,
				stressByProgram,
				checklistByProgram,
				suicideByProgram,
			] = await Promise.all([
				metrics.Anxiety.totalAnxietyByProgram(),
				metrics.Depression.totalDepressionByProgram(),
				metrics.Stress.totalStressByProgram(),
				metrics.PersonalProblemsChecklist.totalChecklistByProgram(),
				metrics.Suicide.totalSuicideByProgram(),
			]);

			// Format data for charts
			const chartData = {
				// Recent trends for line chart (last 7 days)
				trendsData,

				// Assessment breakdown for donut chart
				assessmentBreakdown: [
					{
						name: "Anxiety",
						value: anxietyTotal,
						color: "#f59e0b",
						percentage:
							Math.round(
								(anxietyTotal /
									(anxietyTotal +
										depressionTotal +
										stressTotal +
										checklistTotal +
										suicideTotal)) *
									100,
							) || 0,
					},
					{
						name: "Depression",
						value: depressionTotal,
						color: "#8b5cf6",
						percentage:
							Math.round(
								(depressionTotal /
									(anxietyTotal +
										depressionTotal +
										stressTotal +
										checklistTotal +
										suicideTotal)) *
									100,
							) || 0,
					},
					{
						name: "Stress",
						value: stressTotal,
						color: "#ef4444",
						percentage:
							Math.round(
								(stressTotal /
									(anxietyTotal +
										depressionTotal +
										stressTotal +
										checklistTotal +
										suicideTotal)) *
									100,
							) || 0,
					},
					{
						name: "Personal Problems",
						value: checklistTotal,
						color: "#10b981",
						percentage:
							Math.round(
								(checklistTotal /
									(anxietyTotal +
										depressionTotal +
										stressTotal +
										checklistTotal +
										suicideTotal)) *
									100,
							) || 0,
					},
					{
						name: "Suicide Risk",
						value: suicideTotal,
						color: "#dc2626",
						percentage:
							Math.round(
								(suicideTotal /
									(anxietyTotal +
										depressionTotal +
										stressTotal +
										checklistTotal +
										suicideTotal)) *
									100,
							) || 0,
					},
				],

				// Severity distribution for bar chart
				severityData,

				// Monthly trends for additional line chart
				monthlyTrends: monthlyData,

				// Program distribution for insights
				programDistribution: anxietyByProgram.map((item) => ({
					program: item.program,
					anxiety: item.count,
					depression:
						depressionByProgram.find((d) => d.program === item.program)?.count || 0,
					stress: stressByProgram.find((s) => s.program === item.program)?.count || 0,
					checklist:
						checklistByProgram.find((c) => c.program === item.program)?.count || 0,
					suicide: suicideByProgram.find((s) => s.program === item.program)?.count || 0,
				})),

				// Summary stats
				totalStats: {
					anxiety: anxietyTotal,
					depression: depressionTotal,
					stress: stressTotal,
					checklist: checklistTotal,
					suicide: suicideTotal,
					total:
						anxietyTotal +
						depressionTotal +
						stressTotal +
						checklistTotal +
						suicideTotal,
				},
			};

			res.status(200).json({
				success: true,
				message: "Chart data generated successfully",
				data: chartData,
			});
		} catch (error: any) {
			const status = (error.status || 500) as keyof typeof config;
			metricsLogger.error("❌ Error generating chart data", {
				status,
				message: error.message,
			});
			res.status(Number(status)).json({
				error: config[status] || "Internal Server Error",
				details: error.message,
			});
		}
	};

	const exportGraphData = async (
		req: Request,
		res: Response,
		_next: NextFunction,
	): Promise<void> => {
		try {
			const { format = "json" } = req.query;

			metricsLogger.info(`📤 Exporting graph data in ${format} format`);

			// Validate format
			if (!["json", "csv", "dot"].includes(format as string)) {
				res.status(400).json({
					error: "Invalid format. Supported formats: json, csv, dot",
				});
				return;
			}

			// Export graph data in specified format
			const exportedData = await mentalHealthPredictor.exportGraphData(
				format as "json" | "csv" | "dot",
			);

			// Set appropriate content type
			const contentTypes = {
				json: "application/json",
				csv: "text/csv",
				dot: "text/plain",
			};

			res.setHeader("Content-Type", contentTypes[format as keyof typeof contentTypes]);
			res.setHeader("Content-Disposition", `attachment; filename="ml-graph-data.${format}"`);
			res.status(200).send(exportedData);
		} catch (error: any) {
			const status = (error.status || 500) as keyof typeof config;
			metricsLogger.error("❌ Error exporting graph data", {
				status,
				message: error.message,
			});
			res.status(Number(status)).json({
				error: config[status] || "Internal Server Error",
				details: error.message,
			});
		}
	};

	const getTextTreeVisualization = async (
		req: Request,
		res: Response,
		_next: NextFunction,
	): Promise<void> => {
		try {
			metricsLogger.info("📝 Generating text-based tree visualization");

			// Generate text tree visualization
			const textTree = await generateTextTreeVisualization();

			res.status(200).json({
				success: true,
				message: "Text tree visualization generated successfully",
				data: {
					textVisualization: textTree,
				},
			});
		} catch (error: any) {
			const status = (error.status || 500) as keyof typeof config;
			metricsLogger.error("❌ Error generating text tree visualization", {
				status,
				message: error.message,
			});
			res.status(Number(status)).json({
				error: config[status] || "Internal Server Error",
				details: error.message,
			});
		}
	};

	const generateDecisionTreeImageEndpoint = async (
		req: Request,
		res: Response,
		_next: NextFunction,
	): Promise<void> => {
		try {
			const { format = "png" } = req.query;

			metricsLogger.info(`🖼️ Generating decision tree image in ${format} format`);

			// Validate format
			if (!["png", "jpeg"].includes(format as string)) {
				res.status(400).json({
					error: "Invalid format. Supported formats: png, jpeg",
				});
				return;
			}

			// Generate image buffer
			const imageBuffer = await generateDecisionTreeImage(format as "png" | "jpeg");

			// Set appropriate headers for image download
			const contentTypes = {
				png: "image/png",
				jpeg: "image/jpeg",
			};

			res.setHeader("Content-Type", contentTypes[format as keyof typeof contentTypes]);
			res.setHeader("Content-Disposition", `attachment; filename="decision-tree.${format}"`);
			res.setHeader("Content-Length", imageBuffer.length.toString());

			res.status(200).send(imageBuffer);
		} catch (error: any) {
			const status = (error.status || 500) as keyof typeof config;
			metricsLogger.error("❌ Error generating decision tree image", {
				status,
				message: error.message,
			});
			res.status(Number(status)).json({
				error: config[status] || "Internal Server Error",
				details: error.message,
			});
		}
	};

	const generateFeatureImportanceImageEndpoint = async (
		req: Request,
		res: Response,
		_next: NextFunction,
	): Promise<void> => {
		try {
			const { format = "png" } = req.query;

			metricsLogger.info(`📊 Generating feature importance image in ${format} format`);

			// Validate format
			if (!["png", "jpeg"].includes(format as string)) {
				res.status(400).json({
					error: "Invalid format. Supported formats: png, jpeg",
				});
				return;
			}

			// Generate image buffer
			const imageBuffer = await generateFeatureImportanceImage(format as "png" | "jpeg");

			// Set appropriate headers for image download
			const contentTypes = {
				png: "image/png",
				jpeg: "image/jpeg",
			};

			res.setHeader("Content-Type", contentTypes[format as keyof typeof contentTypes]);
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="feature-importance.${format}"`,
			);
			res.setHeader("Content-Length", imageBuffer.length.toString());

			res.status(200).send(imageBuffer);
		} catch (error: any) {
			const status = (error.status || 500) as keyof typeof config;
			metricsLogger.error("❌ Error generating feature importance image", {
				status,
				message: error.message,
			});
			res.status(Number(status)).json({
				error: config[status] || "Internal Server Error",
				details: error.message,
			});
		}
	};

	const generatePerformanceMetricsImageEndpoint = async (
		req: Request,
		res: Response,
		_next: NextFunction,
	): Promise<void> => {
		try {
			const { format = "png" } = req.query;

			metricsLogger.info(`📈 Generating performance metrics image in ${format} format`);

			// Validate format
			if (!["png", "jpeg"].includes(format as string)) {
				res.status(400).json({
					error: "Invalid format. Supported formats: png, jpeg",
				});
				return;
			}

			// Generate image buffer
			const imageBuffer = await generatePerformanceMetricsImage(format as "png" | "jpeg");

			// Set appropriate headers for image download
			const contentTypes = {
				png: "image/png",
				jpeg: "image/jpeg",
			};

			res.setHeader("Content-Type", contentTypes[format as keyof typeof contentTypes]);
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="performance-metrics.${format}"`,
			);
			res.setHeader("Content-Length", imageBuffer.length.toString());

			res.status(200).send(imageBuffer);
		} catch (error: any) {
			const status = (error.status || 500) as keyof typeof config;
			metricsLogger.error("❌ Error generating performance metrics image", {
				status,
				message: error.message,
			});
			res.status(Number(status)).json({
				error: config[status] || "Internal Server Error",
				details: error.message,
			});
		}
	};

	const generateConfusionMatrixImageEndpoint = async (
		req: Request,
		res: Response,
		_next: NextFunction,
	): Promise<void> => {
		try {
			const { format = "png" } = req.query;

			metricsLogger.info(`🔢 Generating confusion matrix image in ${format} format`);

			// Validate format
			if (!["png", "jpeg"].includes(format as string)) {
				res.status(400).json({
					error: "Invalid format. Supported formats: png, jpeg",
				});
				return;
			}

			// Generate image buffer
			const imageBuffer = await generateConfusionMatrixImage(format as "png" | "jpeg");

			// Set appropriate headers for image download
			const contentTypes = {
				png: "image/png",
				jpeg: "image/jpeg",
			};

			res.setHeader("Content-Type", contentTypes[format as keyof typeof contentTypes]);
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="confusion-matrix.${format}"`,
			);
			res.setHeader("Content-Length", imageBuffer.length.toString());

			res.status(200).send(imageBuffer);
		} catch (error: any) {
			const status = (error.status || 500) as keyof typeof config;
			metricsLogger.error("❌ Error generating confusion matrix image", {
				status,
				message: error.message,
			});
			res.status(Number(status)).json({
				error: config[status] || "Internal Server Error",
				details: error.message,
			});
		}
	};

	return {
		search,
		dashboard,
		generateMLGraphs,
		getDecisionTreeGraph,
		getRandomForestGraph,
		getChartData,
		exportGraphData,
		getTextTreeVisualization,
		generateDecisionTreeImageEndpoint,
		generateFeatureImportanceImageEndpoint,
		generatePerformanceMetricsImageEndpoint,
		generateConfusionMatrixImageEndpoint,
	};
};
