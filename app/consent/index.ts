import express, { Router } from "express";
import { controller } from "./consent.controller";
import { router } from "./consent.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
