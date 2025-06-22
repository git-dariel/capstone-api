import { controller } from "../../app/loggings/loggings.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import {
	PrismaClient,
	Prisma,
	LogType,
	LogStatus,
	LogSeverity,
	Role,
} from "../../generated/prisma";
import { AuthRequest } from "../../middleware/verifyToken";
import { ObjectId } from "mongodb";

// Increase timeout for all tests
const TEST_TIMEOUT = 5000;

describe("Loggings Controller", () => {
	let loggingsController: any;
	let req: Partial<AuthRequest>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockUser = {
		id: new ObjectId().toString(),
		userName: "testuser",
		isDeleted: false,
		person: {
			firstName: "John",
			lastName: "Doe",
		},
	};

	const mockLog = {
		id: new ObjectId().toString(),
		type: LogType.activity,
		action: "LOGIN",
		title: "User logged in",
		message: "User successfully logged into the system",
		userId: mockUser.id,
		entityType: "User",
		entityId: mockUser.id,
		data: { ip: "192.168.1.1", userAgent: "Mozilla/5.0" },
		status: LogStatus.success,
		severity: LogSeverity.info,
		readAt: null,
		createdAt: new Date("2024-01-15T10:00:00.000Z"),
		user: mockUser,
	};

	beforeEach(() => {
		// Mock Prisma client
		let createdLog: any = null;
		let updatedLogData = { ...mockLog };

		prisma = {
			log: {
				findMany: async (params: Prisma.LogFindManyArgs) => [updatedLogData],
				count: async (params: Prisma.LogCountArgs) => 1,
				findFirst: async (params: Prisma.LogFindFirstArgs) => {
					if (params.where?.id === mockLog.id) {
						return updatedLogData;
					}
					if (createdLog && params.where?.id === createdLog.id) {
						return createdLog;
					}
					return null;
				},
				findUnique: async (params: Prisma.LogFindUniqueArgs) => {
					if (params.where?.id === mockLog.id) {
						return updatedLogData;
					}
					if (createdLog && params.where?.id === createdLog.id) {
						return createdLog;
					}
					return null;
				},
				create: async (params: Prisma.LogCreateArgs) => {
					const newLog = {
						id: new ObjectId().toString(),
						...(params.data as any),
						createdAt: new Date(),
						user: mockUser,
					};
					createdLog = newLog;
					return newLog;
				},
				update: async (params: Prisma.LogUpdateArgs) => {
					updatedLogData = {
						...updatedLogData,
						...(params.data as any),
					};
					return updatedLogData;
				},
				delete: async (params: Prisma.LogDeleteArgs) => {
					return updatedLogData;
				},
			},
			user: {
				findFirst: async (params: Prisma.UserFindFirstArgs) => {
					if (params.where?.id === mockUser.id) {
						return mockUser;
					}
					return null;
				},
			},
		};

		loggingsController = controller(prisma as PrismaClient);
		sentData = undefined;
		statusCode = 200;
		req = {
			query: {},
			params: {},
			body: {},
			role: Role.admin, // Default to admin for most tests
			userId: new ObjectId().toString(),
		};
		res = {
			send: (data: any) => {
				sentData = data;
				return res;
			},
			status: (code: number) => {
				statusCode = code;
				return res;
			},
			json: (data: any) => {
				sentData = data;
				return res;
			},
			end: () => res,
		} as Response;
		next = () => {};
	});

	describe(".getAll()", () => {
		it("should return paginated logs for admin", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10" };
			req.role = Role.admin;
			await loggingsController.getAll(req as AuthRequest, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("logs").that.is.an("array");
			expect(sentData).to.have.property("total").that.equals(1);
			expect(sentData).to.have.property("page").that.equals(1);
			expect(sentData).to.have.property("totalPages").that.equals(1);
		});

		it("should deny access for regular users", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10" };
			req.role = Role.user;
			await loggingsController.getAll(req as AuthRequest, res, next);
			expect(statusCode).to.equal(403);
			expect(sentData).to.have.property("message", "Insufficient permissions");
		});

		it("should handle invalid page parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "0", limit: "10" };
			req.role = Role.admin;
			await loggingsController.getAll(req as AuthRequest, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid page number");
		});

		it("should handle invalid limit parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "0" };
			req.role = Role.admin;
			await loggingsController.getAll(req as AuthRequest, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid limit number");
		});

		it("should handle invalid order parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", order: "invalid" };
			req.role = Role.admin;
			await loggingsController.getAll(req as AuthRequest, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Order must be either 'asc' or 'desc'");
		});

		it("should handle filter by type", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", type: "activity" };
			req.role = Role.admin;
			await loggingsController.getAll(req as AuthRequest, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("logs").that.is.an("array");
		});

		it("should handle filter by status", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", status: "success" };
			req.role = Role.admin;
			await loggingsController.getAll(req as AuthRequest, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("logs").that.is.an("array");
		});

		it("should handle filter by severity", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", severity: "info" };
			req.role = Role.admin;
			await loggingsController.getAll(req as AuthRequest, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("logs").that.is.an("array");
		});

		it("should handle filter by userId", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", userId: mockUser.id };
			req.role = Role.admin;
			await loggingsController.getAll(req as AuthRequest, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("logs").that.is.an("array");
		});

		it("should handle search query", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", query: "login" };
			req.role = Role.admin;
			await loggingsController.getAll(req as AuthRequest, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("logs").that.is.an("array");
		});
	});

	describe(".getById()", () => {
		it("should return a log for admin", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockLog.id };
			req.role = Role.admin;
			await loggingsController.getById(req as AuthRequest, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("id", mockLog.id);
		});

		it("should return a log for regular user", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockLog.id };
			req.role = Role.user;
			await loggingsController.getById(req as AuthRequest, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("id", mockLog.id);
		});

		it("should handle missing ID", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = {};
			req.role = Role.admin;
			await loggingsController.getById(req as AuthRequest, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Missing log ID");
		});

		it("should handle non-existent log", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: new ObjectId().toString() };
			req.role = Role.admin;
			await loggingsController.getById(req as AuthRequest, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("error", "Log not found");
		});

		it("should handle invalid fields parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockLog.id };
			req.query = { fields: 123 as any };
			req.role = Role.admin;
			await loggingsController.getById(req as AuthRequest, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property(
				"error",
				"Populate parameter must be a comma-separated string",
			);
		});
	});

	describe(".create()", () => {
		it("should create a log as admin", async function () {
			this.timeout(TEST_TIMEOUT);
			const logData = {
				type: LogType.activity,
				action: "CREATE",
				title: "User created",
				message: "A new user was created",
				userId: mockUser.id,
				entityType: "User",
				entityId: mockUser.id,
				status: LogStatus.success,
				severity: LogSeverity.info,
			};
			req.body = logData;
			req.role = Role.admin;
			await loggingsController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("type", logData.type);
			expect(sentData).to.have.property("action", logData.action);
			expect(sentData).to.have.property("title", logData.title);
		});

		it("should deny access for regular users", async function () {
			this.timeout(TEST_TIMEOUT);
			const logData = {
				type: LogType.activity,
				action: "CREATE",
				title: "User created",
				userId: mockUser.id,
			};
			req.body = logData;
			req.role = Role.user;
			await loggingsController.create(req as Request, res, next);
			expect(statusCode).to.equal(403);
			expect(sentData).to.have.property("message", "Insufficient permissions");
		});

		it("should handle missing required fields", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = { type: LogType.activity };
			req.role = Role.admin;
			await loggingsController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid log data provided");
		});

		it("should handle invalid type", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				type: "invalid_type",
				action: "CREATE",
				title: "Test log",
				userId: mockUser.id,
			};
			req.role = Role.admin;
			await loggingsController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid log type");
		});

		it("should handle invalid action", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				type: LogType.activity,
				action: "",
				title: "Test log",
				userId: mockUser.id,
			};
			req.role = Role.admin;
			await loggingsController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid log action");
		});

		it("should handle invalid title", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				type: LogType.activity,
				action: "CREATE",
				title: "",
				userId: mockUser.id,
			};
			req.role = Role.admin;
			await loggingsController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid log title");
		});

		it("should handle non-existent user", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				type: LogType.activity,
				action: "CREATE",
				title: "Test log",
				userId: new ObjectId().toString(),
			};
			req.role = Role.admin;
			await loggingsController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "User not found for this log");
		});

		it("should handle invalid status", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				type: LogType.activity,
				action: "CREATE",
				title: "Test log",
				userId: mockUser.id,
				status: "invalid_status",
			};
			req.role = Role.admin;
			await loggingsController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid log status");
		});

		it("should handle invalid severity", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				type: LogType.activity,
				action: "CREATE",
				title: "Test log",
				userId: mockUser.id,
				severity: "invalid_severity",
			};
			req.role = Role.admin;
			await loggingsController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid log severity");
		});
	});

	describe(".update()", () => {
		it("should update a log as admin", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				title: "Updated log title",
				message: "Updated log message",
				status: LogStatus.read,
			};
			req.params = { id: mockLog.id };
			req.body = updateData;
			req.role = Role.admin;
			await loggingsController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("title", updateData.title);
		});

		it("should deny access for regular users", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockLog.id };
			req.body = { title: "Updated title" };
			req.role = Role.user;
			await loggingsController.update(req as Request, res, next);
			expect(statusCode).to.equal(403);
			expect(sentData).to.have.property("message", "Insufficient permissions");
		});

		it("should handle missing ID", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = {};
			req.body = { title: "Updated title" };
			req.role = Role.admin;
			await loggingsController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Missing log ID");
		});

		it("should handle empty update data", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockLog.id };
			req.body = {};
			req.role = Role.admin;
			await loggingsController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "No update fields provided");
		});

		it("should handle non-existent log", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: new ObjectId().toString() };
			req.body = { title: "Updated title" };
			req.role = Role.admin;
			await loggingsController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("error", "Log not found");
		});

		it("should handle invalid type in update", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockLog.id };
			req.body = { type: "invalid_type" };
			req.role = Role.admin;
			await loggingsController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid log type");
		});

		it("should handle invalid status in update", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockLog.id };
			req.body = { status: "invalid_status" };
			req.role = Role.admin;
			await loggingsController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid log status");
		});

		it("should handle invalid severity in update", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockLog.id };
			req.body = { severity: "invalid_severity" };
			req.role = Role.admin;
			await loggingsController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid log severity");
		});
	});

	describe(".markAsRead()", () => {
		it("should mark log as read for admin", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockLog.id };
			req.role = Role.admin;
			await loggingsController.markAsRead(req as AuthRequest, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", LogStatus.read);
		});

		it("should mark log as read for regular user", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockLog.id };
			req.role = Role.user;
			await loggingsController.markAsRead(req as AuthRequest, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", LogStatus.read);
		});

		it("should handle missing ID", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = {};
			req.role = Role.admin;
			await loggingsController.markAsRead(req as AuthRequest, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Missing log ID");
		});

		it("should handle non-existent log", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: new ObjectId().toString() };
			req.role = Role.admin;
			await loggingsController.markAsRead(req as AuthRequest, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("error", "Log not found");
		});
	});

	describe(".remove()", () => {
		it("should delete a log as admin", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockLog.id };
			req.role = Role.admin;
			await loggingsController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("message", "Log deleted");
		});

		it("should deny access for regular users", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockLog.id };
			req.role = Role.user;
			await loggingsController.remove(req as Request, res, next);
			expect(statusCode).to.equal(403);
			expect(sentData).to.have.property("message", "Insufficient permissions");
		});

		it("should handle missing ID", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = {};
			req.role = Role.admin;
			await loggingsController.remove(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Missing log ID");
		});

		it("should handle non-existent log", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: new ObjectId().toString() };
			req.role = Role.admin;
			await loggingsController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("error", "Log not found");
		});
	});
});
