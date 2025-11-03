import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import { OTPEmailHelper, createGmailConfig } from "../helper/email.helper";
import { getLogger } from "../helper/logger";
import { PrismaClient } from "../generated/prisma";

const logger = getLogger();
const authLogger = logger.child({ module: "auth" });

const prisma = new PrismaClient();

// Cache for first-year student numbers loaded from CSV
let firstYearStudentNumbers: Set<string> | null = null;

/**
 * Load first-year student numbers from CSV file
 * Uses caching to avoid repeated file reads
 * @returns Set of valid student numbers from the CSV file
 */
export const loadFirstYearStudentNumbers = (): Set<string> => {
	if (firstYearStudentNumbers !== null) {
		return firstYearStudentNumbers;
	}

	try {
		const csvPath = path.join(__dirname, "..", "config", "data", "first-year-data.csv");

		if (!fs.existsSync(csvPath)) {
			authLogger.error(`First-year data CSV file not found at: ${csvPath}`);
			throw new Error("First-year data CSV file not found");
		}

		const csvContent = fs.readFileSync(csvPath, "utf-8");

		const records = parse(csvContent, {
			columns: true,
			skip_empty_lines: true,
			trim: true,
		}) as any[];

		// Extract student numbers from the CSV
		// The first column is "STUDENT NUMBER"
		firstYearStudentNumbers = new Set(
			records
				.map((record) => record["STUDENT NUMBER"])
				.filter((studentNumber) => studentNumber && studentNumber.trim() !== ""),
		);

		authLogger.info(
			`Loaded ${firstYearStudentNumbers.size} first-year student numbers from CSV`,
		);

		return firstYearStudentNumbers;
	} catch (error) {
		authLogger.error(`Error loading first-year student numbers from CSV: ${error}`);
		// Return empty set on error to prevent registration
		firstYearStudentNumbers = new Set();
		return firstYearStudentNumbers;
	}
};

/**
 * Validate if a student number exists in the first-year student database
 * @param studentNumber - The student number to validate
 * @returns boolean - True if the student number is valid (exists in CSV), false otherwise
 */
export const validateFirstYearStudentNumber = (studentNumber: string | undefined): boolean => {
	if (!studentNumber || !studentNumber.trim()) {
		authLogger.error("Student number is required for validation");
		return false;
	}

	const validStudentNumbers = loadFirstYearStudentNumbers();

	const isValid = validStudentNumbers.has(studentNumber.trim());

	if (!isValid) {
		authLogger.warn(
			`Student number validation failed: ${studentNumber} not found in first-year database`,
		);
	}

	return isValid;
};

export const initOTPEmailHelper = () => {
	const emailUser = process.env.EMAIL_USER;
	const emailPassword = process.env.EMAIL_PASSWORD;

	if (!emailUser || !emailPassword) {
		authLogger.warn("Email credentials not configured. OTP emails will not be sent.");
		return null;
	}

	const emailConfig = createGmailConfig(emailUser, emailPassword);
	return new OTPEmailHelper(emailConfig);
};

// Helper function to clean up expired pending registrations
export const cleanupExpiredPendingRegistrations = async () => {
	try {
		const deleted = await prisma.pendingRegistration.deleteMany({
			where: {
				emailOtpExpiry: {
					lt: new Date(),
				},
			},
		});

		if (deleted.count > 0) {
			authLogger.info(`Cleaned up ${deleted.count} expired pending registrations`);
		}
	} catch (error) {
		authLogger.error(`Error cleaning up expired pending registrations: ${error}`);
	}
};
