import express, { Router } from "express";
import { controller } from "./metrics.controller";
import { router } from "./metrics.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	try {
		const ctrl = controller(prisma);

		if (typeof ctrl?.search !== "function") {
			console.error("❌ ERROR: Controller does not return { search }");
			throw new Error("Controller missing `search` method");
		}

		return router(express.Router(), ctrl);
	} catch (e) {
		console.error("❌ Failed to initialize metrics module:", e);
		throw e;
	}
};
