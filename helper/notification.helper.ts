import { PrismaClient, LogType, LogStatus, LogSeverity } from "../generated/prisma";
import { controller as loggingsController } from "../app/loggings/loggings.controller";
import { getLogger } from "./logger";
import { emitToUser } from "./socket.helper";

const logger = getLogger();
const notificationLogger = logger.child({ module: "notification" });

export interface NotificationData {
	type: LogType;
	action: string;
	title: string;
	message?: string;
	userId: string;
	entityType?: string;
	entityId?: string;
	data?: any;
	status?: LogStatus;
	severity?: LogSeverity;
}

export class NotificationHelper {
	private prisma: PrismaClient;
	private loggingsCtrl: ReturnType<typeof loggingsController>;
	private io?: any;

	constructor(prisma: PrismaClient, io?: any) {
		this.prisma = prisma;
		this.loggingsCtrl = loggingsController(prisma);
		this.io = io;
	}

	/**
	 * Create a notification using the logging system
	 */
	async createNotification(notificationData: NotificationData): Promise<any> {
		try {
			notificationLogger.info(`Creating notification for user: ${notificationData.userId}`);

			// Create a mock request object for the logging controller
			const mockReq = {
				body: {
					type: notificationData.type,
					action: notificationData.action,
					title: notificationData.title,
					message: notificationData.message,
					userId: notificationData.userId,
					entityType: notificationData.entityType,
					entityId: notificationData.entityId,
					data: notificationData.data,
					status: notificationData.status || LogStatus.unread,
					severity: notificationData.severity || LogSeverity.info,
				},
			} as any;

			// Create a mock response object to capture the result
			let result: any = null;
			let statusCode: number = 200;

			const mockRes = {
				status: (code: number) => ({
					json: (data: any) => {
						statusCode = code;
						result = data;
						return mockRes;
					},
				}),
			} as any;

			const mockNext = () => {};

			// Call the logging controller's create method
			await this.loggingsCtrl.create(mockReq, mockRes, mockNext);

			if (statusCode === 201 && result) {
				notificationLogger.info(`Notification created successfully: ${result.id}`);

				// Emit real-time notification to user
				try {
					if (this.io) {
						emitToUser(this.io, notificationData.userId, "new_notification", {
							id: result.id,
							type: result.type,
							action: result.action,
							title: result.title,
							message: result.message,
							severity: result.severity,
							status: result.status,
							entityType: result.entityType,
							entityId: result.entityId,
							data: result.data,
							createdAt: result.createdAt,
							user: result.user,
						});
						notificationLogger.info(
							`Real-time notification sent to user: ${notificationData.userId}`,
						);
					}
				} catch (socketError) {
					notificationLogger.warn(
						`Failed to emit real-time notification: ${socketError}`,
					);
					// Don't throw error here - notification was created successfully
				}

				return result;
			} else {
				notificationLogger.error(
					`Failed to create notification: ${JSON.stringify(result)}`,
				);
				throw new Error(
					`Failed to create notification: ${result?.error || "Unknown error"}`,
				);
			}
		} catch (error) {
			notificationLogger.error(`Error creating notification: ${error}`);
			throw error;
		}
	}

	/**
	 * Create appointment-related notifications
	 */
	async createAppointmentNotification(
		action: "CREATED" | "UPDATED" | "CANCELLED" | "CONFIRMED" | "COMPLETED",
		userId: string,
		appointmentId: string,
		appointmentData?: any,
	): Promise<any> {
		const actionMessages = {
			CREATED: "New appointment request created",
			UPDATED: "Appointment has been updated",
			CANCELLED: "Appointment has been cancelled",
			CONFIRMED: "Appointment has been confirmed",
			COMPLETED: "Appointment has been completed",
		};

		return this.createNotification({
			type: LogType.notification,
			action: `APPOINTMENT_${action}`,
			title: actionMessages[action],
			message: `Your appointment has been ${action.toLowerCase()}`,
			userId,
			entityType: "Appointment",
			entityId: appointmentId,
			data: appointmentData,
			severity: action === "CANCELLED" ? LogSeverity.medium : LogSeverity.info,
		});
	}

	/**
	 * Create assessment-related notifications
	 */
	async createAssessmentNotification(
		assessmentType: "ANXIETY" | "DEPRESSION" | "STRESS" | "SUICIDE",
		action: "CREATED" | "UPDATED" | "COMPLETED",
		userId: string,
		assessmentId: string,
		severityLevel?: string,
		assessmentData?: any,
	): Promise<any> {
		const severity = this.getSeverityFromAssessment(severityLevel);
		const actionMessages = {
			CREATED: `${assessmentType.toLowerCase()} assessment completed`,
			UPDATED: `${assessmentType.toLowerCase()} assessment updated`,
			COMPLETED: `${assessmentType.toLowerCase()} assessment finalized`,
		};

		return this.createNotification({
			type: LogType.notification,
			action: `${assessmentType}_ASSESSMENT_${action}`,
			title: actionMessages[action],
			message: `Your ${assessmentType.toLowerCase()} assessment has been ${action.toLowerCase()}${severityLevel ? ` with ${severityLevel} severity` : ""}`,
			userId,
			entityType: `${assessmentType}Assessment`,
			entityId: assessmentId,
			data: assessmentData,
			severity,
		});
	}

	/**
	 * Create consent-related notifications
	 */
	async createConsentNotification(
		action: "CREATED" | "UPDATED" | "APPROVED" | "REJECTED",
		userId: string,
		consentId: string,
		consentData?: any,
	): Promise<any> {
		const actionMessages = {
			CREATED: "New consent form created",
			UPDATED: "Consent form updated",
			APPROVED: "Consent form approved",
			REJECTED: "Consent form rejected",
		};

		return this.createNotification({
			type: LogType.notification,
			action: `CONSENT_${action}`,
			title: actionMessages[action],
			message: `Your consent form has been ${action.toLowerCase()}`,
			userId,
			entityType: "Consent",
			entityId: consentId,
			data: consentData,
			severity: action === "REJECTED" ? LogSeverity.medium : LogSeverity.info,
		});
	}

	/**
	 * Create inventory-related notifications
	 */
	async createInventoryNotification(
		action: "CREATED" | "UPDATED" | "DELETED" | "LOW_STOCK",
		userId: string,
		inventoryId: string,
		inventoryData?: any,
	): Promise<any> {
		const actionMessages = {
			CREATED: "New inventory item added",
			UPDATED: "Inventory item updated",
			DELETED: "Inventory item removed",
			LOW_STOCK: "Low stock alert",
		};

		return this.createNotification({
			type: LogType.notification,
			action: `INVENTORY_${action}`,
			title: actionMessages[action],
			message: `Inventory item has been ${action.toLowerCase().replace("_", " ")}`,
			userId,
			entityType: "Inventory",
			entityId: inventoryId,
			data: inventoryData,
			severity: action === "LOW_STOCK" ? LogSeverity.high : LogSeverity.info,
		});
	}

	/**
	 * Create message-related notifications
	 */
	async createMessageNotification(
		action: "SENT" | "RECEIVED" | "READ",
		userId: string,
		messageId: string,
		messageData?: any,
	): Promise<any> {
		const actionMessages = {
			SENT: "Message sent successfully",
			RECEIVED: "New message received",
			READ: "Message has been read",
		};

		return this.createNotification({
			type: LogType.notification,
			action: `MESSAGE_${action}`,
			title: actionMessages[action],
			message: `Message has been ${action.toLowerCase()}`,
			userId,
			entityType: "Message",
			entityId: messageId,
			data: messageData,
		});
	}

	/**
	 * Create retake request notifications
	 */
	async createRetakeRequestNotification(
		action: "CREATED" | "APPROVED" | "REJECTED",
		userId: string,
		requestId: string,
		requestData?: any,
	): Promise<any> {
		const actionMessages = {
			CREATED: "Retake request submitted",
			APPROVED: "Retake request approved",
			REJECTED: "Retake request rejected",
		};

		return this.createNotification({
			type: LogType.notification,
			action: `RETAKE_REQUEST_${action}`,
			title: actionMessages[action],
			message: `Your retake request has been ${action.toLowerCase()}`,
			userId,
			entityType: "RetakeRequest",
			entityId: requestId,
			data: requestData,
			severity: action === "REJECTED" ? LogSeverity.medium : LogSeverity.info,
		});
	}

	/**
	 * Create schedule-related notifications
	 */
	async createScheduleNotification(
		action: "CREATED" | "UPDATED" | "CANCELLED" | "AVAILABLE" | "BOOKED",
		userId: string,
		scheduleId: string,
		scheduleData?: any,
	): Promise<any> {
		const actionMessages = {
			CREATED: "New schedule created",
			UPDATED: "Schedule updated",
			CANCELLED: "Schedule cancelled",
			AVAILABLE: "Schedule now available",
			BOOKED: "Schedule has been booked",
		};

		return this.createNotification({
			type: LogType.notification,
			action: `SCHEDULE_${action}`,
			title: actionMessages[action],
			message: `Schedule has been ${action.toLowerCase()}`,
			userId,
			entityType: "Schedule",
			entityId: scheduleId,
			data: scheduleData,
		});
	}

	/**
	 * Helper method to determine severity based on assessment results
	 */
	private getSeverityFromAssessment(severityLevel?: string): LogSeverity {
		if (!severityLevel) return LogSeverity.info;

		const level = severityLevel.toLowerCase();
		if (level.includes("severe") || level.includes("high")) return LogSeverity.high;
		if (level.includes("moderate") || level.includes("medium")) return LogSeverity.medium;
		if (level.includes("mild") || level.includes("low")) return LogSeverity.low;
		return LogSeverity.info;
	}
}

/**
 * Factory function to create a notification helper instance
 */
export const createNotificationHelper = (prisma: PrismaClient, io?: any): NotificationHelper => {
	return new NotificationHelper(prisma, io);
};
