import express, { Router } from "express";
import { controller } from "./inventory.controller";
import { router } from "./inventory.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
