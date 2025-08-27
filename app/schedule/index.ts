import express, { Router } from "express";
import { controller } from "./schedule.controller";
import { router } from "./schedule.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
