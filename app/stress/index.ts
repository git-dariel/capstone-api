import express, { Router } from "express";
import { controller } from "./stress.controller";
import { router } from "./stress.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
