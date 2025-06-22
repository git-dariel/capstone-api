import { PrismaClient } from "../generated/prisma";
import { getLogger } from "../helper/logger";

// Create a singleton Prisma client instance
let prismaInstance: PrismaClient;

export const getPrismaClient = () => {
	if (!prismaInstance) {
		prismaInstance = new PrismaClient();
	}
	return prismaInstance;
};

const prisma = getPrismaClient();
const logger = getLogger();

export async function connectDb() {
	try {
		await prisma.$connect();
		logger.info("Connected to the database successfully.");
	} catch (error) {
		logger.error("Error connecting to the database:", {
			error,
			stack: error instanceof Error ? error.stack : undefined,
		});
		process.exit(1);
	}
}
