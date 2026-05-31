import * as cron from "node-cron";
import { PrismaClient } from "../generated/prisma";
import { getLogger } from "../helper/logger";
import {
	calculateYearLevelFromStudentNumber
} from "../helper/student.helper";

const logger = getLogger();
const cronLogger = logger.child({ module: "student-year-level-cron" });

/**
 * Update student year levels based on their enrollment year (from student number)
 * This function calculates the correct year level for each student and updates it if needed
 *
 * @param prisma - Prisma client instance
 * @returns Object containing update statistics
 */
export const updateStudentYearLevels = async (prisma: PrismaClient) => {
	const startTime = Date.now();
	cronLogger.info("Starting student year level update job");

	try {
		// Get all active students (not deleted)
		const students = await prisma.student.findMany({
			where: {
				isDeleted: false,
				studentNumber: {
					not: null,
				},
			},
			select: {
				id: true,
				studentNumber: true,
				year: true,
			},
		});

		cronLogger.info(`Found ${students.length} students to check`);

		let updatedCount = 0;
		let skippedCount = 0;
		let errorCount = 0;

		// Process each student
		for (const student of students) {
			try {
				if (!student.studentNumber) {
					cronLogger.warn(`Student ${student.id} has no student number, skipping`);
					skippedCount++;
					continue;
				}

				// Calculate expected year level based on student number
				const expectedYearLevel = calculateYearLevelFromStudentNumber(
					student.studentNumber,
				);

				// Skip if year level is already correct
				if (student.year === expectedYearLevel) {
					skippedCount++;
					continue;
				}

				// Update student year level
				await prisma.student.update({
					where: { id: student.id },
					data: { year: expectedYearLevel },
				});

				cronLogger.info(
					`Updated student ${student.id} (${student.studentNumber}): ${student.year} -> ${expectedYearLevel}`,
				);
				updatedCount++;
			} catch (error) {
				errorCount++;
				cronLogger.error(
					`Error updating student ${student.id} (${student.studentNumber}): ${error}`,
				);
			}
		}

		const duration = Date.now() - startTime;
		cronLogger.info(
			`Year level update job completed in ${duration}ms. Updated: ${updatedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`,
		);

		return {
			success: true,
			total: students.length,
			updated: updatedCount,
			skipped: skippedCount,
			errors: errorCount,
			duration,
		};
	} catch (error) {
		cronLogger.error(`Failed to update student year levels: ${error}`);
		throw error;
	}
};

/**
 * Initialize cron job for automatic year level updates
 * Runs on the 1st day of every month at 2:00 AM (Philippines time)
 * You can modify the schedule as needed:
 * - "0 2 1 * *" = 1st day of month at 2:00 AM
 * - "0 0 * * *" = Daily at midnight
 * - "0 0 1 6 *" = June 1st at midnight (start of academic year)
 *
 * @param prisma - Prisma client instance
 * @returns Cron task instance
 */
export const initializeYearLevelCronJob = (prisma: PrismaClient): cron.ScheduledTask => {
	// Schedule: Run on the 1st day of every month at 2:00 AM (Philippines time)
	// Format: minute hour day month day-of-week
	// "0 2 1 * *" = At 02:00 on day-of-month 1
	const cronSchedule = process.env.YEAR_LEVEL_CRON_SCHEDULE || "0 2 1 * *";

	cronLogger.info(`Initializing year level cron job with schedule: ${cronSchedule}`);

	const task = cron.schedule(
		cronSchedule,
		async () => {
			cronLogger.info("Year level cron job triggered");
			try {
				await updateStudentYearLevels(prisma);
			} catch (error) {
				cronLogger.error(`Year level cron job failed: ${error}`);
			}
		},
		{
			timezone: "Asia/Manila", // Philippines timezone
		},
	);

	cronLogger.info("Year level cron job initialized successfully");
	return task;
};
