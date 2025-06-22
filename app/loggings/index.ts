import express, { Router } from "express";
import { controller } from "./loggings.controller";
import { router } from "./loggings.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
