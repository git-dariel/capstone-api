import express, { Router } from "express";
import { controller } from "./student.controller";
import { router } from "./student.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
