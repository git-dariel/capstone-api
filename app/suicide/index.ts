import express, { Router } from "express";
import { controller } from "./suicide.controller";
import { router } from "./suicide.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
