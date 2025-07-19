import express, { Router } from "express";
import { controller } from "./retake-request.controller";
import { router } from "./retake-request.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
