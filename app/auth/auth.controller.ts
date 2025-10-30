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
			// Check if email already exists in either person or pending registration tables
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

			// Check if student number already exists (if provided)
			if (studentNumber) {
				const existingStudent = await prisma.student.findFirst({
					where: {
						studentNumber,
						isDeleted: false,
					},
				});

				if (existingStudent) {
					authLogger.error(`Student number already exists: ${studentNumber}`);
					res.status(400).json({ message: "Student number already exists" });
					return;
				}

				// Also check pending registrations for the same student number
				const existingPendingStudent = await prisma.pendingRegistration.findFirst({
					where: {
						studentNumber,
						isDeleted: false,
					},
				});

				if (existingPendingStudent) {
					authLogger.error(
						`Student number already exists in pending registration: ${studentNumber}`,
					);
					res.status(400).json({ message: "Student number already exists" });
					return;
				}
			}

			// Check if there's already a pending registration for this email
			const existingPendingRegistration = await prisma.pendingRegistration.findFirst({
				where: {
					email,
					isDeleted: false,
				},
			});

			if (existingPendingRegistration) {
				// Check if OTP is still valid
				if (new Date() <= existingPendingRegistration.emailOtpExpiry) {
					authLogger.error(`Pending registration already exists for email: ${email}`);
					res.status(400).json({
						message:
							"Registration already in progress. Please try signing in with your credentials to complete verification, or wait for the current verification code to expire.",
					});
					return;
				} else {
					// Delete expired pending registration
					await prisma.pendingRegistration.delete({
						where: { id: existingPendingRegistration.id },
					});
				}
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

			// Initialize OTP Email Helper
			const otpEmailHelper = initOTPEmailHelper();

			if (!otpEmailHelper) {
				authLogger.error("Email service not configured");
				res.status(500).json({
					message: "Email service not available. Cannot send verification code.",
				});
				return;
			}

			// Generate OTP for email verification
			const otp = otpEmailHelper.generateOTP();
			const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

			// Hash the password before storing
			const hashedPassword = await bcrypt.hash(password, 10);

			// Create pending registration record instead of actual user
			const pendingRegistration = await prisma.pendingRegistration.create({
				data: {
					email,
					userName: userNameToUse,
					password: hashedPassword,
					role: (role as Role) || "user",
					type: (type as Type) || "student",
					firstName,
					lastName,
					...(middleName && { middleName }),
					...(suffix && { suffix }),
					...(contactNumber && { contactNumber }),
					...(gender && { gender }),
					...(birthDate && { birthDate: new Date(birthDate) }),
					...(birthPlace && { birthPlace }),
					...(age && { age }),
					...(religion && { religion }),
					...(civilStatus && { civilStatus }),
					...(address && { address }),
					...(guardian && { guardian }),
					...(studentNumber && { studentNumber }),
					...(program && { program }),
					...(year && { year }),
					emailOtp: otp,
					emailOtpExpiry: otpExpiry,
				},
			});

			// Send OTP email
			try {
				const emailResult = await otpEmailHelper.sendOTPEmail(
					email,
					otp,
					firstName || undefined,
				);

				if (emailResult.success) {
					authLogger.info(`OTP email sent successfully to ${email}`);
				} else {
					authLogger.error(`Failed to send OTP email to ${email}: ${emailResult.error}`);
					// Delete the pending registration if email fails
					await prisma.pendingRegistration.delete({
						where: { id: pendingRegistration.id },
					});
					res.status(500).json({
						message: "Failed to send verification email. Please try again.",
					});
					return;
				}
			} catch (emailError) {
				authLogger.error(`Error sending OTP email to ${email}: ${emailError}`);
				// Delete the pending registration if email fails
				await prisma.pendingRegistration.delete({
					where: { id: pendingRegistration.id },
				});
				res.status(500).json({
					message: "Failed to send verification email. Please try again.",
				});
				return;
			}

			authLogger.info(`Pending registration created for email: ${email}`);

			const responseData = {
				message:
					"Registration initiated. Please check your email for the verification code.",
				emailVerificationRequired: true,
				otpSent: true,
			};

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
			// First check if there's a pending registration for this email
			const pendingRegistration = await prisma.pendingRegistration.findFirst({
				where: {
					email,
					isDeleted: false,
				},
			});

			if (pendingRegistration) {
				// Check if OTP is still valid
				if (new Date() <= pendingRegistration.emailOtpExpiry) {
					authLogger.info(`Found pending registration for email: ${email}`);

					// Resend OTP for the pending registration
					const otpEmailHelper = initOTPEmailHelper();

					if (otpEmailHelper) {
						// Generate new OTP
						const newOtp = otpEmailHelper.generateOTP();
						const newOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);

						// Update pending registration with new OTP
						await prisma.pendingRegistration.update({
							where: { id: pendingRegistration.id },
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
								pendingRegistration.firstName || undefined,
							);

							if (emailResult.success) {
								authLogger.info(
									`OTP resent successfully for pending registration: ${email}`,
								);
							}
						} catch (emailError) {
							authLogger.error(
								`Error sending OTP for pending registration: ${emailError}`,
							);
						}
					}

					// Return response indicating pending registration
					res.status(200).json({
						message:
							"Account registration is pending email verification. Please check your email for the verification code.",
						emailVerificationRequired: true,
						otpSent: true,
						isPendingRegistration: true,
					});
					return;
				} else {
					// Delete expired pending registration
					await prisma.pendingRegistration.delete({
						where: { id: pendingRegistration.id },
					});
					authLogger.info(`Deleted expired pending registration for email: ${email}`);
				}
			}

			// Continue with normal login flow for existing users
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

			// If email is not verified, generate/send OTP and do NOT sign in yet
			if (!user.emailVerified) {
				const otpEmailHelper = initOTPEmailHelper();

				if (!otpEmailHelper) {
					authLogger.error("Email service not configured");
					res.status(500).json({ message: "Email service not available" });
					return;
				}

				const newOtp = otpEmailHelper.generateOTP();
				const newOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

				await prisma.user.update({
					where: { id: user.id },
					data: {
						emailOtp: newOtp,
						emailOtpExpiry: newOtpExpiry,
					},
				});

				try {
					const emailResult = await otpEmailHelper.sendOTPEmail(
						email,
						newOtp,
						person.firstName || undefined,
					);

					if (!emailResult.success) {
						authLogger.error(
							`Failed to send OTP email to ${email}: ${emailResult.error}`,
						);
					}
				} catch (emailError) {
					authLogger.error(`Error sending OTP email to ${email}: ${emailError}`);
				}

				authLogger.info(`Email not verified. OTP sent for user: ${user.id}`);

				const responseData: any = {
					message: "Email not verified. Verification code sent to your email",
					user: {
						id: user.id,
						role: user.role,
						type: user.type,
						avatar: user.avatar,
						person,
					},
					emailVerificationRequired: true,
					otpSent: true,
				};

				// Include student data if available to maintain response shape
				if (person.students && person.students.length > 0) {
					responseData.student = person.students[0];
				}

				res.status(200).json(responseData);
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
					avatar: user.avatar,
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

	const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
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
			// First check if this is a pending registration
			const pendingRegistration = await prisma.pendingRegistration.findFirst({
				where: {
					email,
					isDeleted: false,
				},
			});

			if (pendingRegistration) {
				// Check if OTP is expired
				if (new Date() > pendingRegistration.emailOtpExpiry) {
					authLogger.error(`OTP expired for pending registration: ${email}`);
					res.status(400).json({
						message: "Verification code has expired. Please register again.",
					});
					return;
				}

				// Verify OTP
				if (pendingRegistration.emailOtp !== otp) {
					authLogger.error(`Invalid OTP for pending registration: ${email}`);
					res.status(400).json({ message: "Invalid verification code" });
					return;
				}

				// Create the actual user, person, and student records
				const result = await prisma.$transaction(async (tx) => {
					// Create person
					const mockReq = {
						body: {
							firstName: pendingRegistration.firstName,
							lastName: pendingRegistration.lastName,
							...(pendingRegistration.middleName && {
								middleName: pendingRegistration.middleName,
							}),
							...(pendingRegistration.suffix && {
								suffix: pendingRegistration.suffix,
							}),
							email: pendingRegistration.email,
							...(pendingRegistration.contactNumber && {
								contactNumber: pendingRegistration.contactNumber,
							}),
							...(pendingRegistration.gender && {
								gender: pendingRegistration.gender,
							}),
							...(pendingRegistration.birthDate && {
								birthDate: pendingRegistration.birthDate,
							}),
							...(pendingRegistration.birthPlace && {
								birthPlace: pendingRegistration.birthPlace,
							}),
							...(pendingRegistration.age && { age: pendingRegistration.age }),
							...(pendingRegistration.religion && {
								religion: pendingRegistration.religion,
							}),
							...(pendingRegistration.civilStatus && {
								civilStatus: pendingRegistration.civilStatus,
							}),
							...(pendingRegistration.address && {
								address: pendingRegistration.address,
							}),
							...(pendingRegistration.guardian && {
								guardian: pendingRegistration.guardian,
							}),
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

					// Create user
					const user = await tx.user.create({
						data: {
							userName: pendingRegistration.userName || pendingRegistration.email,
							password: pendingRegistration.password, // Already hashed
							role: pendingRegistration.role || "user",
							type: pendingRegistration.type || "student",
							loginMethod: "email",
							emailVerified: true, // Mark as verified since OTP was successful
							person: {
								connect: {
									id: person.id,
								},
							},
						},
					});

					// Create student record if needed
					let student = null;
					if (
						pendingRegistration.type === "student" &&
						pendingRegistration.studentNumber &&
						pendingRegistration.program &&
						pendingRegistration.year
					) {
						const studentReq = {
							body: {
								studentNumber: pendingRegistration.studentNumber,
								program: pendingRegistration.program,
								year: pendingRegistration.year,
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

					// Get complete user data
					const completeUser = await tx.user.findUnique({
						where: { id: user.id },
						include: {
							person: true,
						},
					});

					let completeStudent = null;
					if (student) {
						completeStudent = await tx.student.findUnique({
							where: { id: student.id },
							include: {
								person: true,
							},
						});
					}

					// Delete the pending registration
					await tx.pendingRegistration.delete({
						where: { id: pendingRegistration.id },
					});

					return { user: completeUser, student: completeStudent };
				});

				authLogger.info(`Email verified and user created successfully: ${result.user?.id}`);
				res.status(200).json({
					message: "Email verified and account created successfully",
					verified: true,
				});
				return;
			}

			// Fallback: Check existing user (for backward compatibility)
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
				authLogger.error(`No user or pending registration found with email: ${email}`);
				res.status(404).json({ message: "No registration found for this email" });
				return;
			}

			const user = person.users[0];

			// Check if email is already verified
			if (user.emailVerified) {
				authLogger.info(`Email already verified for user: ${user.id}`);
				res.status(200).json({
					message: "Email is already verified",
					verified: true,
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

			authLogger.info(`Email verified successfully for existing user: ${user.id}`);
			res.status(200).json({
				message: "Email verified successfully",
				verified: true,
			});
		} catch (error) {
			authLogger.error(`Error during email verification: ${error}`);
			res.status(500).json({ message: "Error during email verification" });
		}
	};

	const resendOTP = async (req: Request, res: Response, next: NextFunction) => {
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
			// First check if this is a pending registration
			const pendingRegistration = await prisma.pendingRegistration.findFirst({
				where: {
					email,
					isDeleted: false,
				},
			});

			if (pendingRegistration) {
				// Generate new OTP for pending registration
				const otpEmailHelper = initOTPEmailHelper();

				if (!otpEmailHelper) {
					authLogger.error("Email service not configured");
					res.status(500).json({ message: "Email service not available" });
					return;
				}

				const newOtp = otpEmailHelper.generateOTP();
				const newOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

				// Update pending registration with new OTP
				await prisma.pendingRegistration.update({
					where: { id: pendingRegistration.id },
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
						pendingRegistration.firstName || undefined,
					);

					if (emailResult.success) {
						authLogger.info(
							`New OTP email sent successfully to ${email} for pending registration`,
						);
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
				return;
			}

			// Fallback: Check existing user (for backward compatibility)
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
				authLogger.error(`No user or pending registration found with email: ${email}`);
				res.status(404).json({ message: "No registration found for this email" });
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

	// Helper function to clean up expired pending registrations
	const cleanupExpiredPendingRegistrations = async () => {
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

	return {
		register,
		registerAdmin,
		login,
		verifyEmail,
		resendOTP,
		cleanupExpiredPendingRegistrations,
	};
};
