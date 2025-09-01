import dotenv from "dotenv";
export type CallbackFunction = (error: Error | null, allowed?: boolean) => void;
import wildCardOrigin from "../helper/check.origin";

dotenv.config();

export const config = {
	port: process.env.PORT || 3000,
	baseApiPath: "/api",
	betterStackSourceToken: process.env.BETTER_STACK_SOURCE_TOKEN || "",
	betterStackHost: process.env.BETTER_STACK_HOST || "",
	JWT_SECRET: process.env.JWT_SECRET || "capstone-dev",

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
			wildCardOrigin(origin, callback, "https://pup-guidance-center.vercel.app");
		},
		TEST_SITE: function (origin: string, callback: CallbackFunction) {
			wildCardOrigin(origin, callback, "https://pup-guidance-center.vercel.app");
		},
		PROD_SITE: function (origin: string, callback: CallbackFunction) {
			wildCardOrigin(origin, callback, "https://pup-guidance-center.vercel.app");
		},
		LOCAL_API: function (origin: string, callback: CallbackFunction) {
			wildCardOrigin(origin, callback, "http://localhost:5000");
		},
		DEV_API: function (origin: string, callback: CallbackFunction) {
			wildCardOrigin(
				origin,
				callback,
				"https://mental-health-dev-796aa66da7d5.herokuapp.com",
			);
		},
		TEST_API: function (origin: string, callback: CallbackFunction) {
			wildCardOrigin(origin, callback, "");
		},
		PROD_API: function (origin: string, callback: CallbackFunction) {
			wildCardOrigin(origin, callback, "");
		},
	},
};
