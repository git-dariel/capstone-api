import bcrypt from "bcrypt";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient, Role, Type } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { OTPEmailHelper, createGmailConfig } from "../../helper/email.helper";
import { controller as personController } from "../person/person.controller";
import { controller as studentController } from "../student/student.controller";

const logger = getLogger();
const authLogger = logger.child({ module: "auth" });

export const controller = (prisma: PrismaClient) => {
	const personCtrl = personController(prisma);
	const studentCtrl = studentController(prisma);

	// Initialize OTP Email Helper
	const initOTPEmailHelper = () => {
		const emailUser = process.env.EMAIL_USER;
		const emailPassword = process.env.EMAIL_PASSWORD;

		if (!emailUser || !emailPassword) {
			authLogger.warn("Email credentials not configured. OTP emails will not be sent.");
			return null;
		}

		const emailConfig = createGmailConfig(emailUser, emailPassword);
		return new OTPEmailHelper(emailConfig);
	};

	const register = async (req: Request, res: Response, next: NextFunction) => {
		const {
			email,
			userName,
			password,
			role,
			type,
			firstName,
			lastName,
			middleName,
			suffix,
			contactNumber,
			gender,
			birthDate,
			birthPlace,
			age,
			religion,
			civilStatus,
			address,
			guardian,
			studentNumber,
			program,
			year,
			...otherData
		} = req.body;

		if (!email) {
			authLogger.error("Email is required");
			res.status(400).json({ message: "Email is required" });
			return;
		}

		if (!password) {
			authLogger.error("Password is required");
			res.status(400).json({ message: "Password is required" });
			return;
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			authLogger.error(`Invalid email format: ${email}`);
			res.status(400).json({ message: "Invalid email format" });
			return;
		}

		// Check if email is from PUP domain
		if (!email.endsWith("@iskolarngbayan.pup.edu.ph")) {
			authLogger.error(`Invalid email domain: ${email}`);
			res.status(400).json({
				message: "Only PUP email addresses (@iskolarngbayan.pup.edu.ph) are allowed",
			});
			return;
		}

		if (password.length < 6) {
			authLogger.error("Password must be at least 6 characters long");
			res.status(400).json({ message: "Password must be at least 6 characters long" });
			return;
		}

		try {
			const existingPerson = await prisma.person.findFirst({
				where: {
					email,
					isDeleted: false,
				},
			});

			if (existingPerson) {
				authLogger.error(`Person with this email already exists: ${email}`);
				res.status(400).json({ message: "Person with this email already exists" });
				return;
			}

			const userNameToUse = userName || email;
			const existingUserName = await prisma.user.findFirst({
				where: {
					userName: userNameToUse,
					isDeleted: false,
				},
			});

			if (existingUserName) {
				authLogger.error(`Username already exists: ${userNameToUse}`);
				res.status(400).json({
					message: "Username already exists. Please choose a different username.",
				});
				return;
			}

			const result = await prisma.$transaction(async (tx) => {
				const mockReq = {
					body: {
						firstName,
						lastName,
						...(middleName ? { middleName } : {}),
						...(suffix ? { suffix } : {}),
						email,
						...(contactNumber ? { contactNumber } : {}),
						...(gender ? { gender } : {}),
						...(birthDate && { birthDate: new Date(birthDate) }),
						...(birthPlace ? { birthPlace } : {}),
						...(age ? { age } : {}),
						...(religion ? { religion } : {}),
						...(civilStatus ? { civilStatus } : {}),
						...(address
							? {
									address: {
										street: address.street,
										city: address.city,
										...(address.houseNo && {
											houseNo: parseInt(address.houseNo),
										}),
										...(address.province && { province: address.province }),
										...(address.barangay && { barangay: address.barangay }),
										...(address.zipCode && {
											zipCode: parseInt(address.zipCode),
										}),
										...(address.country && { country: address.country }),
										...(address.type && { type: address.type }),
									},
								}
							: {}),
						...(guardian
							? {
									guardian: {
										firstName: guardian.firstName,
										lastName: guardian.lastName,
										...(guardian.middleName && {
											middleName: guardian.middleName,
										}),
										...(guardian.contactNumber && {
											contactNumber: guardian.contactNumber,
										}),
										...(guardian.relationship && {
											relationship: guardian.relationship,
										}),
										...(guardian.address && {
											address: {
												street: guardian.address.street,
												city: guardian.address.city,
												...(guardian.address.houseNo && {
													houseNo: parseInt(guardian.address.houseNo),
												}),
												...(guardian.address.province && {
													province: guardian.address.province,
												}),
												...(guardian.address.barangay && {
													barangay: guardian.address.barangay,
												}),
												...(guardian.address.zipCode && {
													zipCode: parseInt(guardian.address.zipCode),
												}),
												...(guardian.address.country && {
													country: guardian.address.country,
												}),
												...(guardian.address.type && {
													type: guardian.address.type,
												}),
											},
										}),
									},
								}
							: {}),
						...otherData,
					},
				} as Request;

				const mockRes = {
					statusCode: 0,
					data: null,
					status: function (code: number) {
						this.statusCode = code;
						return this;
					},
					json: function (data: any) {
						this.data = data;
						return this;
					},
				} as any;

				await personCtrl.create(mockReq, mockRes, next);

				if (mockRes.statusCode !== 201) {
					throw new Error("Failed to create person");
				}

				const person = mockRes.data;

				const existingUser = await tx.user.findFirst({
					where: {
						personId: person.id,
						isDeleted: false,
					},
					include: {
						person: true,
					},
				});

				if (existingUser) {
					return { user: existingUser };
				}

				// Hash the password before storing
				const hashedPassword = await bcrypt.hash(password, 10);

				// Generate OTP for email verification
				const otpEmailHelper = initOTPEmailHelper();
				const otp = otpEmailHelper?.generateOTP() || "000000";
				const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

				const user = await tx.user.create({
					data: {
						userName: userNameToUse,
						password: hashedPassword,
						role: (role as Role) || "user",
						type: (type as Type) || "student",
						loginMethod: "email",
						emailVerified: false,
						emailOtp: otp,
						emailOtpExpiry: otpExpiry,
						person: {
							connect: {
								id: person.id,
							},
						},
					},
				});

				let student = null;
				if ((type as Type) === "student" && studentNumber && program && year) {
					const studentReq = {
						body: {
							studentNumber,
							program,
							year,
							personId: person.id,
						},
					} as Request;

					const studentRes = {
						statusCode: 0,
						data: null,
						status: function (code: number) {
							this.statusCode = code;
							return this;
						},
						json: function (data: any) {
							this.data = data;
							return this;
						},
					} as any;

					await studentCtrl.create(studentReq, studentRes, next);

					if (studentRes.statusCode !== 201) {
						throw new Error("Failed to create student record");
					}

					student = studentRes.data;
				}

				const completeUser = await tx.user.findUnique({
					where: { id: user.id },
					include: {
						person: true,
					},
				});

				if (!completeUser) {
					throw new Error("Failed to fetch user data");
				}

				let completeStudent = null;
				if (student) {
					completeStudent = await tx.student.findUnique({
						where: { id: student.id },
						include: {
							person: true,
						},
					});
				}

				return { user: completeUser, student: completeStudent, otp, otpEmailHelper };
			});

			// Send OTP email after successful user creation
			if (result.otpEmailHelper && result.otp) {
				try {
					const emailResult = await result.otpEmailHelper.sendOTPEmail(
						email,
						result.otp,
						result.user.person?.firstName || undefined,
					);

					if (emailResult.success) {
						authLogger.info(`OTP email sent successfully to ${email}`);
					} else {
						authLogger.error(
							`Failed to send OTP email to ${email}: ${emailResult.error}`,
						);
					}
				} catch (emailError) {
					authLogger.error(`Error sending OTP email to ${email}: ${emailError}`);
				}
			}

			const token = jwt.sign(
				{
					userId: result.user.id,
					role: result.user.role,
					type: result.user.type,
					firstName: result.user.person?.firstName,
					lastName: result.user.person?.lastName,
				},
				process.env.JWT_SECRET || "",
				{
					expiresIn: "1h",
				},
			);

			authLogger.info(
				`User registered successfully: ${result.user.id} (${result.user.type})`,
			);
			res.cookie("token", token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				maxAge: 1 * 24 * 60 * 60 * 1000,
			});

			const responseData: any = {
				message:
					"Registration successful. Please check your email for the verification code.",
				user: result.user,
				token: token,
				emailVerificationRequired: true,
				otpSent: !!result.otpEmailHelper,
			};

			// Include student data in response if applicable
			if (result.student) {
				responseData.student = result.student;
			}

			res.status(201).json(responseData);
		} catch (error) {
			authLogger.error(`Error during registration: ${error}`);
			res.status(500).json({ message: "Error during registration" });
		}
	};

	const registerAdmin = async (req: Request, res: Response, next: NextFunction) => {
		const {
			email,
			userName,
			password,
			firstName,
			lastName,
			middleName,
			suffix,
			contactNumber,
			gender,
			birthDate,
			birthPlace,
			age,
			religion,
			civilStatus,
			address,
			guardian,
			...otherData
		} = req.body;

		if (!email) {
			authLogger.error("Email is required");
			res.status(400).json({ message: "Email is required" });
			return;
		}

		if (!password) {
			authLogger.error("Password is required");
			res.status(400).json({ message: "Password is required" });
			return;
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			authLogger.error(`Invalid email format: ${email}`);
			res.status(400).json({ message: "Invalid email format" });
			return;
		}

		// Check if email is from PUP domain
		if (!email.endsWith("@iskolarngbayan.pup.edu.ph")) {
			authLogger.error(`Invalid email domain: ${email}`);
			res.status(400).json({
				message: "Only PUP email addresses (@iskolarngbayan.pup.edu.ph) are allowed",
			});
			return;
		}

		if (password.length < 6) {
			authLogger.error("Password must be at least 6 characters long");
			res.status(400).json({ message: "Password must be at least 6 characters long" });
			return;
		}

		try {
			const existingPerson = await prisma.person.findFirst({
				where: {
					email,
					isDeleted: false,
				},
			});

			if (existingPerson) {
				authLogger.error(`Person with this email already exists: ${email}`);
				res.status(400).json({ message: "Person with this email already exists" });
				return;
			}

			const userNameToUse = userName || email;
			const existingUserName = await prisma.user.findFirst({
				where: {
					userName: userNameToUse,
					isDeleted: false,
				},
			});

			if (existingUserName) {
				authLogger.error(`Username already exists: ${userNameToUse}`);
				res.status(400).json({
					message: "Username already exists. Please choose a different username.",
				});
				return;
			}

			const result = await prisma.$transaction(async (tx) => {
				const mockReq = {
					body: {
						firstName,
						lastName,
						...(middleName ? { middleName } : {}),
						...(suffix ? { suffix } : {}),
						email,
						...(contactNumber ? { contactNumber } : {}),
						...(gender ? { gender } : {}),
						...(birthDate && { birthDate: new Date(birthDate) }),
						...(birthPlace ? { birthPlace } : {}),
						...(age ? { age } : {}),
						...(religion ? { religion } : {}),
						...(civilStatus ? { civilStatus } : {}),
						...(address
							? {
									address: {
										street: address.street,
										city: address.city,
										...(address.houseNo && {
											houseNo: parseInt(address.houseNo),
										}),
										...(address.province && { province: address.province }),
										...(address.barangay && { barangay: address.barangay }),
										...(address.zipCode && {
											zipCode: parseInt(address.zipCode),
										}),
										...(address.country && { country: address.country }),
										...(address.type && { type: address.type }),
									},
								}
							: {}),
						...(guardian
							? {
									guardian: {
										firstName: guardian.firstName,
										lastName: guardian.lastName,
										...(guardian.middleName && {
											middleName: guardian.middleName,
										}),
										...(guardian.contactNumber && {
											contactNumber: guardian.contactNumber,
										}),
										...(guardian.relationship && {
											relationship: guardian.relationship,
										}),
										...(guardian.address && {
											address: {
												street: guardian.address.street,
												city: guardian.address.city,
												...(guardian.address.houseNo && {
													houseNo: parseInt(guardian.address.houseNo),
												}),
												...(guardian.address.province && {
													province: guardian.address.province,
												}),
												...(guardian.address.barangay && {
													barangay: guardian.address.barangay,
												}),
												...(guardian.address.zipCode && {
													zipCode: parseInt(guardian.address.zipCode),
												}),
												...(guardian.address.country && {
													country: guardian.address.country,
												}),
												...(guardian.address.type && {
													type: guardian.address.type,
												}),
											},
										}),
									},
								}
							: {}),
						...otherData,
					},
				} as Request;

				const mockRes = {
					statusCode: 0,
					data: null,
					status: function (code: number) {
						this.statusCode = code;
						return this;
					},
					json: function (data: any) {
						this.data = data;
						return this;
					},
				} as any;

				await personCtrl.create(mockReq, mockRes, next);

				if (mockRes.statusCode !== 201) {
					throw new Error("Failed to create person");
				}

				const person = mockRes.data;

				const existingUser = await tx.user.findFirst({
					where: {
						personId: person.id,
						isDeleted: false,
					},
					include: {
						person: true,
					},
				});

				if (existingUser) {
					return { user: existingUser };
				}

				// Hash the password before storing
				const hashedPassword = await bcrypt.hash(password, 10);

				// Create admin user with admin role and guidance type
				const user = await tx.user.create({
					data: {
						userName: userNameToUse,
						password: hashedPassword,
						role: "admin" as Role, // Force admin role
						type: "guidance" as Type, // Default to guidance type for admins
						loginMethod: "email",
						person: {
							connect: {
								id: person.id,
							},
						},
					},
				});

				const completeUser = await tx.user.findUnique({
					where: { id: user.id },
					include: {
						person: true,
					},
				});

				if (!completeUser) {
					throw new Error("Failed to fetch user data");
				}

				return { user: completeUser };
			});

			const token = jwt.sign(
				{
					userId: result.user.id,
					role: result.user.role,
					type: result.user.type,
					firstName: result.user.person?.firstName,
					lastName: result.user.person?.lastName,
				},
				process.env.JWT_SECRET || "",
				{
					expiresIn: "1h",
				},
			);

			authLogger.info(
				`Admin user registered successfully: ${result.user.id} (${result.user.role})`,
			);
			res.cookie("token", token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				maxAge: 1 * 24 * 60 * 60 * 1000,
			});

			const responseData = {
				message: "Admin registration successful",
				user: result.user,
				token: token,
			};

			res.status(201).json(responseData);
		} catch (error) {
			authLogger.error(`Error during admin registration: ${error}`);
			res.status(500).json({ message: "Error during admin registration" });
		}
	};

	const login = async (req: Request, res: Response, _next: NextFunction) => {
		const { email, password, type } = req.body;

		if (!email) {
			authLogger.error("Email is required");
			res.status(400).json({ message: "Email is required" });
			return;
		}

		if (!password) {
			authLogger.error("Password is required");
			res.status(400).json({ message: "Password is required" });
			return;
		}

		if (!type) {
			authLogger.error("Type is required");
			res.status(400).json({ message: "Type is required" });
			return;
		}

		// Check if email is from PUP domain
		if (!email.endsWith("@iskolarngbayan.pup.edu.ph")) {
			authLogger.error(`Invalid email domain: ${email}`);
			res.status(400).json({
				message: "Only PUP email addresses (@iskolarngbayan.pup.edu.ph) are allowed",
			});
			return;
		}

		try {
			const person = await prisma.person.findFirst({
				where: {
					email,
					isDeleted: false,
				},
				include: {
					users: {
						where: {
							isDeleted: false,
							type,
						},
						take: 1,
					},
					students: {
						where: {
							isDeleted: false,
						},
						take: 1,
					},
				},
			});

			if (!person || person.users.length === 0) {
				authLogger.error(`No user found with email: ${email} and type: ${type}`);
				res.status(401).json({ message: "Invalid credentials" });
				return;
			}

			const user = person.users[0];

			// Check if user has a password
			if (!user.password) {
				authLogger.error(`User has no password set: ${user.id}`);
				res.status(401).json({ message: "Invalid credentials" });
				return;
			}

			// Verify password
			const isPasswordValid = await bcrypt.compare(password, user.password);
			if (!isPasswordValid) {
				authLogger.error(`Invalid password for user: ${user.id}`);
				res.status(401).json({ message: "Invalid credentials" });
				return;
			}

			// Additional check to ensure type matches
			if (user.type !== type) {
				authLogger.error(`User type mismatch. Expected: ${type}, Got: ${user.type}`);
				res.status(401).json({ message: "Invalid account type" });
				return;
			}

			const token = jwt.sign(
				{
					userId: user.id,
					role: user.role,
					type: user.type,
					firstName: person.firstName,
					lastName: person.lastName,
				},
				process.env.JWT_SECRET || "",
				{
					expiresIn: "1h",
				},
			);

			await prisma.user.update({
				where: { id: user.id },
				data: { lastLogin: new Date() },
			});

			res.cookie("token", token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				maxAge: 1 * 24 * 60 * 60 * 1000,
			});

			authLogger.info(`User logged in successfully: ${user.id} (${user.type})`);

			const responseData: any = {
				message: "Logged in successfully",
				user: {
					id: user.id,
					role: user.role,
					type: user.type,
					person,
				},
				token: token,
			};

			// Include student data if person has student records
			if (person.students && person.students.length > 0) {
				responseData.student = person.students[0];
			}

			res.status(200).json(responseData);
		} catch (error) {
			authLogger.error(`Error during login: ${error}`);
			res.status(500).json({ message: "Error during login" });
		}
	};

	const verifyEmail = async (req: Request, res: Response, _next: NextFunction) => {
		const { email, otp } = req.body;

		if (!email) {
			authLogger.error("Email is required for verification");
			res.status(400).json({ message: "Email is required" });
			return;
		}

		if (!otp) {
			authLogger.error("OTP is required for verification");
			res.status(400).json({ message: "OTP is required" });
			return;
		}

		// Check if email is from PUP domain
		if (!email.endsWith("@iskolarngbayan.pup.edu.ph")) {
			authLogger.error(`Invalid email domain: ${email}`);
			res.status(400).json({
				message: "Only PUP email addresses (@iskolarngbayan.pup.edu.ph) are allowed",
			});
			return;
		}

		try {
			const person = await prisma.person.findFirst({
				where: {
					email,
					isDeleted: false,
				},
				include: {
					users: {
						where: {
							isDeleted: false,
						},
						take: 1,
					},
				},
			});

			if (!person || person.users.length === 0) {
				authLogger.error(`No user found with email: ${email}`);
				res.status(404).json({ message: "User not found" });
				return;
			}

			const user = person.users[0];

			// Check if email is already verified
			if (user.emailVerified) {
				authLogger.info(`Email already verified for user: ${user.id}`);
				res.status(200).json({
					message: "Email is already verified",
					emailVerified: true,
				});
				return;
			}

			// Check if OTP exists and is not expired
			if (!user.emailOtp || !user.emailOtpExpiry) {
				authLogger.error(`No OTP found for user: ${user.id}`);
				res.status(400).json({
					message: "No verification code found. Please register again.",
				});
				return;
			}

			// Check if OTP is expired
			if (new Date() > user.emailOtpExpiry) {
				authLogger.error(`OTP expired for user: ${user.id}`);
				res.status(400).json({
					message: "Verification code has expired. Please register again.",
				});
				return;
			}

			// Verify OTP
			if (user.emailOtp !== otp) {
				authLogger.error(`Invalid OTP for user: ${user.id}`);
				res.status(400).json({ message: "Invalid verification code" });
				return;
			}

			// Update user as verified and clear OTP
			await prisma.user.update({
				where: { id: user.id },
				data: {
					emailVerified: true,
					emailOtp: null,
					emailOtpExpiry: null,
				},
			});

			authLogger.info(`Email verified successfully for user: ${user.id}`);
			res.status(200).json({
				message: "Email verified successfully",
				emailVerified: true,
			});
		} catch (error) {
			authLogger.error(`Error during email verification: ${error}`);
			res.status(500).json({ message: "Error during email verification" });
		}
	};

	const resendOTP = async (req: Request, res: Response, _next: NextFunction) => {
		const { email } = req.body;

		if (!email) {
			authLogger.error("Email is required for OTP resend");
			res.status(400).json({ message: "Email is required" });
			return;
		}

		// Check if email is from PUP domain
		if (!email.endsWith("@iskolarngbayan.pup.edu.ph")) {
			authLogger.error(`Invalid email domain: ${email}`);
			res.status(400).json({
				message: "Only PUP email addresses (@iskolarngbayan.pup.edu.ph) are allowed",
			});
			return;
		}

		try {
			const person = await prisma.person.findFirst({
				where: {
					email,
					isDeleted: false,
				},
				include: {
					users: {
						where: {
							isDeleted: false,
						},
						take: 1,
					},
				},
			});

			if (!person || person.users.length === 0) {
				authLogger.error(`No user found with email: ${email}`);
				res.status(404).json({ message: "User not found" });
				return;
			}

			const user = person.users[0];

			// Check if email is already verified
			if (user.emailVerified) {
				authLogger.info(`Email already verified for user: ${user.id}`);
				res.status(200).json({
					message: "Email is already verified",
					emailVerified: true,
				});
				return;
			}

			// Generate new OTP
			const otpEmailHelper = initOTPEmailHelper();

			if (!otpEmailHelper) {
				authLogger.error("Email service not configured");
				res.status(500).json({ message: "Email service not available" });
				return;
			}

			const newOtp = otpEmailHelper.generateOTP();
			const newOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

			// Update user with new OTP
			await prisma.user.update({
				where: { id: user.id },
				data: {
					emailOtp: newOtp,
					emailOtpExpiry: newOtpExpiry,
				},
			});

			// Send new OTP email
			try {
				const emailResult = await otpEmailHelper.sendOTPEmail(
					email,
					newOtp,
					person.firstName || undefined,
				);

				if (emailResult.success) {
					authLogger.info(`New OTP email sent successfully to ${email}`);
					res.status(200).json({
						message: "New verification code sent to your email",
						otpSent: true,
					});
				} else {
					authLogger.error(
						`Failed to send new OTP email to ${email}: ${emailResult.error}`,
					);
					res.status(500).json({ message: "Failed to send verification code" });
				}
			} catch (emailError) {
				authLogger.error(`Error sending new OTP email to ${email}: ${emailError}`);
				res.status(500).json({ message: "Failed to send verification code" });
			}
		} catch (error) {
			authLogger.error(`Error during OTP resend: ${error}`);
			res.status(500).json({ message: "Error during OTP resend" });
		}
	};

	return {
		register,
		registerAdmin,
		login,
		verifyEmail,
		resendOTP,
	};
};
