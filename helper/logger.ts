import winston, { log } from "winston";
import { Logtail } from "@logtail/node";
import { LogtailTransport } from "@logtail/winston";
import { config } from "../config/config";

const { combine, timestamp, json, errors } = winston.format;

// Create a singleton logger instance
let logger: winston.Logger;

export const getLogger = () => {
	// Return existing logger if already created
	if (logger) {
		return logger;
	}

	const logTransports: (winston.transport | LogtailTransport)[] = [
		new winston.transports.Console(),
		new winston.transports.File({ filename: "logs/info.log", level: "info" }),
		new winston.transports.File({ filename: "logs/error.log", level: "error" }),
	];

	if (config.betterStackSourceToken) {
		const logtail = new Logtail(config.betterStackSourceToken, {
			endpoint: config.betterStackHost,
		});
		logTransports.push(new LogtailTransport(logtail));
	}

	logger = winston.createLogger({
		level: process.env.NODE_ENV === "production" ? "info" : "debug",
		format: combine(timestamp(), errors({ stack: true }), json()),
		transports: logTransports,
		exceptionHandlers: [
			new winston.transports.File({ filename: "logs/exception.log" }),
		],
		rejectionHandlers: [
			new winston.transports.File({ filename: "logs/rejection.log" }),
		],
	});

	return logger;
};
