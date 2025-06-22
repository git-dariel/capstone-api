import dotenv from "dotenv";
export type CallbackFunction = (error: Error | null, allowed?: boolean) => void;
import wildCardOrigin from "../helper/check.origin";

dotenv.config();

export const config = {
	port: process.env.PORT || 3000,
	baseApiPath: "/api",
	betterStackSourceToken: process.env.BETTER_STACK_SOURCE_TOKEN || "",
	betterStackHost: process.env.BETTER_STACK_HOST || "",

	// Email configuration
	email: {
		provider: (process.env.EMAIL_PROVIDER as "smtp" | "gmail" | "outlook") || "smtp",
		host: process.env.EMAIL_HOST || "",
		port: parseInt(process.env.EMAIL_PORT || "587"),
		secure: process.env.EMAIL_SECURE === "true",
		user: process.env.EMAIL_USER || "",
		password: process.env.EMAIL_PASSWORD || "",
	},

	CORS: {
		METHODS: ["GET", "POST", "PUT", "DELETE"],
		LOCAL: function (origin: string, callback: CallbackFunction) {
			wildCardOrigin(origin, callback, "http://localhost:5173");
		},
		DEV_SITE: function (origin: string, callback: CallbackFunction) {
			wildCardOrigin(origin, callback, "https://sureone-platform-dev.web.app");
		},
		TEST_SITE: function (origin: string, callback: CallbackFunction) {
			wildCardOrigin(origin, callback, "https://sureone-platform-test.web.app");
		},
		PROD_SITE: function (origin: string, callback: CallbackFunction) {
			wildCardOrigin(origin, callback, "https://sureoneplatform.com");
		},
		LOCAL_API: function (origin: string, callback: CallbackFunction) {
			wildCardOrigin(origin, callback, "http://localhost:5000");
		},
		DEV_API: function (origin: string, callback: CallbackFunction) {
			wildCardOrigin(origin, callback, "");
		},
		TEST_API: function (origin: string, callback: CallbackFunction) {
			wildCardOrigin(origin, callback, "");
		},
		PROD_API: function (origin: string, callback: CallbackFunction) {
			wildCardOrigin(origin, callback, "");
		},
	},
};
