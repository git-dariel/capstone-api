import nodemailer, { Transporter, SendMailOptions } from "nodemailer";
import { getLogger } from "./logger";

const logger = getLogger();
const emailLogger = logger.child({ module: "email" });

// Email provider types for future extensibility
export type EmailProvider = "smtp" | "gmail" | "outlook" | "sendgrid" | "ses";

// Configuration interfaces
interface EmailConfig {
	provider: EmailProvider;
	host?: string;
	port?: number;
	secure?: boolean;
	auth?: {
		user: string;
		pass: string;
	};
	service?: string; // For predefined services like Gmail
}

interface EmailAttachment {
	filename: string;
	content?: Buffer | string;
	path?: string;
	contentType?: string;
}

interface EmailMessage {
	to: string | string[];
	cc?: string | string[];
	bcc?: string | string[];
	subject: string;
	text?: string;
	html?: string;
	attachments?: EmailAttachment[];
	replyTo?: string;
	headers?: Record<string, string>;
}

interface EmailResponse {
	success: boolean;
	messageId?: string;
	error?: string;
}

// Abstract email service interface for future provider implementations
interface EmailService {
	sendEmail(message: EmailMessage): Promise<EmailResponse>;
	verifyConnection(): Promise<boolean>;
}

// NodeMailer implementation
class NodeMailerService implements EmailService {
	private transporter: Transporter;
	private config: EmailConfig;

	constructor(config: EmailConfig) {
		this.config = config;
		this.transporter = this.createTransporter(config);
	}

	private createTransporter(config: EmailConfig): Transporter {
		const transportOptions: any = {};

		switch (config.provider) {
			case "gmail":
				transportOptions.service = "gmail";
				transportOptions.auth = config.auth;
				break;
			case "outlook":
				transportOptions.service = "hotmail";
				transportOptions.auth = config.auth;
				break;
			case "smtp":
			default:
				transportOptions.host = config.host;
				transportOptions.port = config.port || 587;
				transportOptions.secure = config.secure || false;
				transportOptions.auth = config.auth;
				break;
		}

		emailLogger.info(`Creating email transporter for provider: ${config.provider}`);
		return nodemailer.createTransport(transportOptions);
	}

	async sendEmail(message: EmailMessage): Promise<EmailResponse> {
		try {
			emailLogger.info(
				`Sending email to: ${Array.isArray(message.to) ? message.to.join(", ") : message.to}`,
			);

			const mailOptions: SendMailOptions = {
				from: this.config.auth?.user,
				to: message.to,
				cc: message.cc,
				bcc: message.bcc,
				subject: message.subject,
				text: message.text,
				html: message.html,
				attachments: message.attachments,
				replyTo: message.replyTo,
				headers: message.headers,
			};

			const result = await this.transporter.sendMail(mailOptions);

			emailLogger.info(`Email sent successfully. Message ID: ${result.messageId}`);
			return {
				success: true,
				messageId: result.messageId,
			};
		} catch (error) {
			emailLogger.error(`Failed to send email: ${error}`);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}

	async verifyConnection(): Promise<boolean> {
		try {
			await this.transporter.verify();
			emailLogger.info("Email connection verified successfully");
			return true;
		} catch (error) {
			emailLogger.error(`Email connection verification failed: ${error}`);
			return false;
		}
	}
}

// Email service factory for future extensibility
class EmailServiceFactory {
	static createService(config: EmailConfig): EmailService {
		switch (config.provider) {
			case "smtp":
			case "gmail":
			case "outlook":
				return new NodeMailerService(config);
			case "sendgrid":
				// Future implementation: return new SendGridService(config);
				throw new Error("SendGrid provider not implemented yet");
			case "ses":
				// Future implementation: return new SESService(config);
				throw new Error("AWS SES provider not implemented yet");
			default:
				throw new Error(`Unsupported email provider: ${config.provider}`);
		}
	}
}

// Main email helper class
export class EmailHelper {
	private emailService: EmailService;

	constructor(config: EmailConfig) {
		this.emailService = EmailServiceFactory.createService(config);
	}

	// Send a simple text email
	async sendTextEmail(
		to: string | string[],
		subject: string,
		message: string,
	): Promise<EmailResponse> {
		return this.emailService.sendEmail({
			to,
			subject,
			text: message,
		});
	}

	// Send an HTML email
	async sendHtmlEmail(
		to: string | string[],
		subject: string,
		htmlContent: string,
	): Promise<EmailResponse> {
		return this.emailService.sendEmail({
			to,
			subject,
			html: htmlContent,
		});
	}

	// Send email with attachments
	async sendEmailWithAttachments(
		to: string | string[],
		subject: string,
		message: string,
		attachments: EmailAttachment[],
		isHtml: boolean = false,
	): Promise<EmailResponse> {
		const emailMessage: EmailMessage = {
			to,
			subject,
			attachments,
		};

		if (isHtml) {
			emailMessage.html = message;
		} else {
			emailMessage.text = message;
		}

		return this.emailService.sendEmail(emailMessage);
	}

	// Send complex email with all options
	async sendComplexEmail(message: EmailMessage): Promise<EmailResponse> {
		return this.emailService.sendEmail(message);
	}

	// Verify email service connection
	async verifyConnection(): Promise<boolean> {
		return this.emailService.verifyConnection();
	}
}

// Configuration helper functions
export const createEmailConfig = (
	provider: EmailProvider,
	options: {
		host?: string;
		port?: number;
		secure?: boolean;
		user: string;
		password: string;
		service?: string;
	},
): EmailConfig => {
	return {
		provider,
		host: options.host,
		port: options.port,
		secure: options.secure,
		auth: {
			user: options.user,
			pass: options.password,
		},
		service: options.service,
	};
};

// Predefined configurations for common providers
export const createGmailConfig = (user: string, password: string): EmailConfig => {
	return createEmailConfig("gmail", { user, password });
};

export const createOutlookConfig = (user: string, password: string): EmailConfig => {
	return createEmailConfig("outlook", { user, password });
};

export const createSMTPConfig = (
	host: string,
	port: number,
	user: string,
	password: string,
	secure: boolean = false,
): EmailConfig => {
	return createEmailConfig("smtp", { host, port, user, password, secure });
};

// OTP Email functionality
export class OTPEmailHelper {
	private emailHelper: EmailHelper;

	constructor(config: EmailConfig) {
		this.emailHelper = new EmailHelper(config);
	}

	/**
	 * Generate a 6-digit OTP
	 */
	generateOTP(): string {
		return Math.floor(100000 + Math.random() * 900000).toString();
	}

	/**
	 * Send OTP email to user
	 * @param email - Recipient email address
	 * @param otp - 6-digit OTP code
	 * @param firstName - User's first name for personalization
	 */
	async sendOTPEmail(email: string, otp: string, firstName?: string): Promise<EmailResponse> {
		const subject = "Verify Your Email - Mental Health System";
		const htmlContent = this.generateOTPEmailHTML(otp, firstName);

		return this.emailHelper.sendHtmlEmail(email, subject, htmlContent);
	}

	/**
	 * Generate HTML content for OTP email
	 * @param otp - 6-digit OTP code
	 * @param firstName - User's first name
	 */
	private generateOTPEmailHTML(otp: string, firstName?: string): string {
		const greeting = firstName ? `Hello ${firstName}!` : "Hello!";

		return `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<title>Email Verification</title>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
					.container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 10px; }
					.header { text-align: center; margin-bottom: 30px; }
					.otp-container { 
						background-color: #f8f9fa; 
						border: 2px solid #007bff; 
						padding: 20px; 
						text-align: center; 
						margin: 20px 0; 
						border-radius: 5px;
					}
					.otp-code { 
						font-size: 24px; 
						font-weight: bold; 
						color: #007bff; 
						letter-spacing: 2px; 
						font-family: monospace; 
					}
					.otp-label { 
						color: #666666; 
						margin-bottom: 10px; 
						font-weight: bold;
					}
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>🔐 Email Verification</h1>
					</div>
					
					<p>${greeting}</p>
					<p>Welcome to the Mental Health System! To complete your registration and verify your email address, please use the verification code below:</p>

					<div class="otp-container">
						<div class="otp-label">Your Verification Code</div>
						<div class="otp-code">${otp}</div>
					</div>

					<p>Please enter this code in the verification form to activate your account. This code is valid for <strong>10 minutes</strong> only.</p>

					<p><strong>Security Notice:</strong></p>
					<ul>
						<li>Never share this code with anyone</li>
						<li>We will never ask for this code via phone or email</li>
						<li>If you didn't request this verification, please ignore this email</li>
					</ul>

					<p>Best regards,<br>Mental Health System Team</p>
				</div>
			</body>
			</html>
		`;
	}

	/**
	 * Verify email service connection
	 */
	async verifyConnection(): Promise<boolean> {
		return this.emailHelper.verifyConnection();
	}
}

// Export types for external use
export type { EmailConfig, EmailMessage, EmailResponse, EmailAttachment };
