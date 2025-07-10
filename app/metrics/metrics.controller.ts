import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { config } from "../../config/error.config";
import { METRIC } from "../../config/metrics.config";

const logger = getLogger();
const metricsLogger = logger.child({ module: "metrics" });

type FacetQuerySet = Record<string, () => Promise<any>>;

const searchMetrics = async (
	prisma: PrismaClient,
	model: string,
	data: string[],
	filter: any,
): Promise<Record<string, any>[]> => {
	console.log("📊 Starting searchMetrics");
	console.log("🔧 Model:", model);
	console.log("🧮 Data:", data);
	console.log("🔎 Filter:", filter);

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

			return [originalKey, queryFn] as [string, () => Promise<any>];
		})
		.filter((entry): entry is [string, () => Promise<any>] => entry !== null);

	if (facetQueries.length === 0) {
		metricsLogger.warn(`⚠️ No valid facet keys matched for model "${model}"`);
		return [];
	}

	const results = await Promise.all(
		facetQueries.map(async ([key, queryFn]) => {
			try {
				const result = await queryFn();
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
			const { model, data, filter } = req.body;

			if (!model || !Array.isArray(data)) {
				metricsLogger.error("❌ Invalid input for metrics search", { model, data });
				res.status(400).json({ error: "Model and data[] are required" });
				return;
			}

			const result = await searchMetrics(prisma, model, data, filter);
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

	return { search };
};
