// This is an example file showing how to use the EmailHelper
// You can delete this file after understanding the usage patterns

import {
	EmailHelper,
	createGmailConfig,
	createOutlookConfig,
	createSMTPConfig,
	EmailMessage,
	EmailResponse,
} from "./email.helper";
import { config } from "../config/config";

// Example 1: Using configuration from environment variables
export const createEmailHelperFromConfig = (): EmailHelper => {
	const emailConfig = {
		provider: config.email.provider,
		host: config.email.host,
		port: config.email.port,
		secure: config.email.secure,
		auth: {
			user: config.email.user,
			pass: config.email.password,
		},
	};

	return new EmailHelper(emailConfig);
};

// Example 2: Using predefined Gmail configuration
export const createGmailEmailHelper = (user: string, password: string): EmailHelper => {
	const gmailConfig = createGmailConfig(user, password);
	return new EmailHelper(gmailConfig);
};

// Example 3: Using predefined Outlook configuration
export const createOutlookEmailHelper = (user: string, password: string): EmailHelper => {
	const outlookConfig = createOutlookConfig(user, password);
	return new EmailHelper(outlookConfig);
};

// Example 4: Using custom SMTP configuration
export const createCustomSMTPHelper = (
	host: string,
	port: number,
	user: string,
	password: string,
	secure: boolean = false,
): EmailHelper => {
	const smtpConfig = createSMTPConfig(host, port, user, password, secure);
	return new EmailHelper(smtpConfig);
};

// Usage examples for different email types
export const emailUsageExamples = {
	// Send a simple text email
	async sendWelcomeEmail(
		emailHelper: EmailHelper,
		userEmail: string,
		userName: string,
	): Promise<EmailResponse> {
		return emailHelper.sendTextEmail(
			userEmail,
			"Welcome to SureOne",
			`Hello ${userName},\n\nWelcome to SureOne! Your account has been successfully created.\n\nBest regards,\nThe SureOne Team`,
		);
	},

	// Send an HTML email
	async sendHtmlNotification(
		emailHelper: EmailHelper,
		userEmail: string,
		title: string,
	): Promise<EmailResponse> {
		const htmlContent = `
			<html>
				<body>
					<h2>Notification from SureOne</h2>
					<p><strong>${title}</strong></p>
					<p>This is an important notification regarding your account.</p>
					<br>
					<p>Best regards,<br>The SureOne Team</p>
				</body>
			</html>
		`;

		return emailHelper.sendHtmlEmail(userEmail, title, htmlContent);
	},

	// Send email with attachments
	async sendEmailWithPolicyDocument(
		emailHelper: EmailHelper,
		userEmail: string,
		policyNumber: string,
		pdfPath: string,
	): Promise<EmailResponse> {
		const attachments = [
			{
				filename: `policy-${policyNumber}.pdf`,
				path: pdfPath,
				contentType: "application/pdf",
			},
		];

		return emailHelper.sendEmailWithAttachments(
			userEmail,
			`Your Policy Document - ${policyNumber}`,
			`<h3>Your Policy Document</h3><p>Please find your policy document attached.</p>`,
			attachments,
			true, // isHtml
		);
	},

	// Send complex email with multiple recipients and options
	async sendComplexEmail(emailHelper: EmailHelper): Promise<EmailResponse> {
		const complexMessage: EmailMessage = {
			to: ["user1@example.com", "user2@example.com"],
			cc: ["manager@example.com"],
			bcc: ["admin@example.com"],
			subject: "Monthly Report",
			html: `
				<h2>Monthly Report</h2>
				<p>Please find the monthly report attached.</p>
			`,
			replyTo: "noreply@sureone.com",
			attachments: [
				{
					filename: "report.pdf",
					path: "/path/to/report.pdf",
				},
			],
		};

		return emailHelper.sendComplexEmail(complexMessage);
	},

	// Verify email connection
	async verifyEmailSetup(emailHelper: EmailHelper): Promise<boolean> {
		return emailHelper.verifyConnection();
	},
};

// Example usage in a controller or service
export const exampleUsageInController = async () => {
	try {
		// Create email helper from config
		const emailHelper = createEmailHelperFromConfig();

		// Verify connection first
		const isConnected = await emailHelper.verifyConnection();
		if (!isConnected) {
			console.error("Email service connection failed");
			return;
		}

		// Send a welcome email
		const result = await emailUsageExamples.sendWelcomeEmail(
			emailHelper,
			"user@example.com",
			"John Doe",
		);

		if (result.success) {
			console.log(`Email sent successfully. Message ID: ${result.messageId}`);
		} else {
			console.error(`Failed to send email: ${result.error}`);
		}
	} catch (error) {
		console.error("Email service error:", error);
	}
};
