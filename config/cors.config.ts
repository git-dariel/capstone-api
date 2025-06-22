import { config } from "./config";
import { CorsOptions, CorsOptionsDelegate } from "cors";
import cors from "cors";
import { Express } from "express";

const createCorsOptions = (): CorsOptions => {
	const allowedOrigins: (
		| string
		| ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void)
	)[] = [
		config.CORS.LOCAL,
		config.CORS.DEV_SITE,
		config.CORS.TEST_SITE,
		config.CORS.PROD_SITE,
		config.CORS.LOCAL_API,
		config.CORS.DEV_API,
		config.CORS.TEST_API,
		config.CORS.PROD_API,
	];

	const corsOptionsDelegate: CorsOptionsDelegate = (req, callback) => {
		const origin = req.headers.origin;
		if (!origin) {
			callback(null, { origin: true });
			return;
		}

		const isAllowed = allowedOrigins.some((allowedOrigin) => {
			if (typeof allowedOrigin === "function") {
				let result = false;
				allowedOrigin(origin, (error, allowed) => {
					result = allowed ?? false;
				});
				return result;
			}
			return origin === allowedOrigin;
		});

		if (isAllowed) {
			callback(null, { origin: true });
		} else {
			callback(new Error("Not allowed by cors"));
		}
	};

	const customOrigin: CorsOptions["origin"] = (requestOrigin, callback) => {
		if (typeof requestOrigin === "string") {
			corsOptionsDelegate({ headers: { origin: requestOrigin } } as any, (error, options) => {
				callback(error, options?.origin === true);
			});
		} else {
			callback(null, false);
		}
	};

	return {
		origin: customOrigin,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
		credentials: true,
	};
};

export const corsOptions = createCorsOptions();
export const corsMiddleware = (app: Express): Express => app.use(cors(createCorsOptions()));
