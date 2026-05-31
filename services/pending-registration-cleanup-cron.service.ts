import * as cron from "node-cron";
import { PrismaClient } from "../generated/prisma";
import { getLogger } from "../helper/logger";

const logger = getLogger();
const cronLogger = logger.child({ module: "pending-registration-cleanup-cron" });

/**
 * Clean up expired pending registration records from the database
 * This function removes all pending registrations that have exceeded their expiry time
 *
 * @param prisma - Prisma client instance
 * @returns Object containing cleanup statistics
 */
export const cleanupExpiredPendingRegistrations = async (prisma: PrismaClient) => {
	const startTime = Date.now();
	cronLogger.info("Starting pending registration cleanup job");

	try {
		const currentTime = new Date();

		// Find all expired pending registrations (not deleted)
		const expiredRegistrations = await prisma.pendingRegistration.findMany({
			where: {
				isDeleted: false,
				emailOtpExpiry: {
					lt: currentTime, // Less than current time = expired
				},
			},
			select: {
				id: true,
				email: true,
				emailOtpExpiry: true,
				createdAt: true,
			},
		});

		cronLogger.info(
			`Found ${expiredRegistrations.length} expired pending registrations to clean up`,
		);

		let deletedCount = 0;
		let errorCount = 0;

		// Process each expired registration
		for (const registration of expiredRegistrations) {
			try {
				await prisma.pendingRegistration.delete({
					where: { id: registration.id },
				});

				const minutesExpired = Math.floor(
					(currentTime.getTime() - registration.emailOtpExpiry.getTime()) / (1000 * 60),
				);

				cronLogger.info(
					`Deleted expired pending registration for ${registration.email} (expired ${minutesExpired} minutes ago)`,
				);
				deletedCount++;
			} catch (error) {
				errorCount++;
				cronLogger.error(
					`Error deleting pending registration ${registration.id} (${registration.email}): ${error}`,
				);
			}
		}

		const duration = Date.now() - startTime;
		cronLogger.info(
			`Pending registration cleanup job completed in ${duration}ms. Deleted: ${deletedCount}, Errors: ${errorCount}`,
		);

		return {
			success: true,
			total: expiredRegistrations.length,
			deleted: deletedCount,
			errors: errorCount,
			duration,
		};
	} catch (error) {
		cronLogger.error(`Failed to cleanup expired pending registrations: ${error}`);
		throw error;
	}
};

/**
 * Initialize cron job for automatic pending registration cleanup
 * Runs every 2 minutes to clean up expired registrations
 * You can modify the schedule as needed:
 * - "* /2 * * * *" = Every 2 minutes
 * - "* /5 * * * *" = Every 5 minutes
 * - "0 * * * *" = Every hour
 *
 * @param prisma - Prisma client instance
 * @returns Cron task instance
 */
export const initializePendingRegistrationCleanupCronJob = (
	prisma: PrismaClient,
): cron.ScheduledTask => {
	// Schedule: Run every 5 minutes to ensure timely cleanup
	// Format: second minute hour day month day-of-week
	// "*/5 * * * *" = Every 5 minutes
	const cronSchedule = process.env.PENDING_REGISTRATION_CLEANUP_CRON_SCHEDULE || "*/5 * * * *";

	cronLogger.info(
		`Initializing pending registration cleanup cron job with schedule: ${cronSchedule}`,
	);

	const task = cron.schedule(
		cronSchedule,
		async () => {
			cronLogger.debug("Pending registration cleanup cron job triggered");
			try {
				await cleanupExpiredPendingRegistrations(prisma);
			} catch (error) {
				cronLogger.error(`Pending registration cleanup cron job failed: ${error}`);
			}
		},
		{
			timezone: "Asia/Manila", // Philippines timezone
		},
	);

	cronLogger.info("Pending registration cleanup cron job initialized successfully");
	return task;
};
