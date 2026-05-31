import express, { Router } from "express";
import { controller } from "./appointment.controller";
import { router } from "./appointment.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
