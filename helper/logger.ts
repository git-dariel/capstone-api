import { Logtail } from "@logtail/node";
import { LogtailTransport } from "@logtail/winston";
import winston from "winston";
import { config } from "../config/config";

const { combine, timestamp, json, errors } = winston.format;

// Create a singleton logger instance
let logger: winston.Logger;

export const getLogger = () => {
	// Return existing logger if already created
	if (logger) {
		return logger;
	}

	const isProduction = process.env.NODE_ENV === "production";
	const isVercel = process.env.VERCEL === "1";

	const logTransports: (winston.transport | LogtailTransport)[] = [
		new winston.transports.Console(),
	];

	// Only add file transports in non-production or non-Vercel environments
	if (!isProduction && !isVercel) {
		logTransports.push(
			new winston.transports.File({ filename: "logs/info.log", level: "info" }),
			new winston.transports.File({ filename: "logs/error.log", level: "error" }),
		);
	}

	if (config.betterStackSourceToken) {
		const logtail = new Logtail(config.betterStackSourceToken, {
			endpoint: config.betterStackHost,
		});
		logTransports.push(new LogtailTransport(logtail));
	}

	const loggerConfig: winston.LoggerOptions = {
		level: isProduction ? "info" : "debug",
		format: combine(timestamp(), errors({ stack: true }), json()),
		transports: logTransports,
	};

	// Only add file-based exception and rejection handlers in non-production environments
	if (!isProduction && !isVercel) {
		loggerConfig.exceptionHandlers = [
			new winston.transports.File({ filename: "logs/exception.log" }),
		];
		loggerConfig.rejectionHandlers = [
			new winston.transports.File({ filename: "logs/rejection.log" }),
		];
	} else {
		// Use console for exceptions and rejections in production/Vercel
		loggerConfig.exceptionHandlers = [new winston.transports.Console()];
		loggerConfig.rejectionHandlers = [new winston.transports.Console()];
	}

	logger = winston.createLogger(loggerConfig);

	return logger;
};
