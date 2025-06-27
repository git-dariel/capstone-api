import express, { Router } from "express";
import { controller } from "./anxiety.controller";
import { router } from "./anxiety.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
