import express, { Router } from "express";
import { controller } from "./message.controller";
import { router } from "./message.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
