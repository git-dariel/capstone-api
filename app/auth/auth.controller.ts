import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma, Role, Type } from "../../generated/prisma";
import jwt from "jsonwebtoken";
import { getLogger } from "../../helper/logger";
import { controller as personController } from "../person/person.controller";
import bcrypt from "bcrypt";

const logger = getLogger();
const authLogger = logger.child({ module: "auth" });

export const controller = (prisma: PrismaClient) => {
	const personCtrl = personController(prisma);

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
						...(address ? { address } : {}),
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

				const user = await tx.user.create({
					data: {
						userName: userNameToUse,
						password: hashedPassword,
						role: (role as Role) || "user",
						type: (type as Type) || "client",
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
					include: { person: true },
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
					firstName: result.user.person?.firstName,
					lastName: result.user.person?.lastName,
				},
				process.env.JWT_SECRET || "",
				{
					expiresIn: "1h",
				},
			);

			authLogger.info(`User registered successfully: ${result.user.id}`);
			res.cookie("token", token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				maxAge: 1 * 24 * 60 * 60 * 1000,
			});

			res.status(201).json({
				message: "Registration successful",
				user: result.user,
			});
		} catch (error) {
			authLogger.error(`Error during registration: ${error}`);
			res.status(500).json({ message: "Error during registration" });
		}
	};

	const login = async (req: Request, res: Response, _next: NextFunction) => {
		const { email, password } = req.body;

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

			const token = jwt.sign(
				{
					userId: user.id,
					role: user.role,
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

			authLogger.info(`User logged in successfully: ${user.id}`);
			res.status(200).json({
				message: "Logged in successfully",
				user: {
					id: user.id,
					role: user.role,
					person,
				},
			});
		} catch (error) {
			authLogger.error(`Error during login: ${error}`);
			res.status(500).json({ message: "Error during login" });
		}
	};

	return {
		register,
		login,
	};
};
