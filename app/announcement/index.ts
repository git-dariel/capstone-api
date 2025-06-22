import express, { Router } from "express";
import { controller } from "./announcement.controller";
import { router } from "./announcement.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
