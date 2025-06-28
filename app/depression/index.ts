import express, { Router } from "express";
import { controller } from "./depression.controller";
import { router } from "./depression.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
