import { controller } from "../../app/user/user.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma, Role } from "../../generated/prisma";
import { AuthRequest } from "../../middleware/verifyToken";
import { ObjectId } from "mongodb";

// Increase timeout for all tests
const TEST_TIMEOUT = 5000;

describe("User Controller", () => {
	let userController: any;
	let req: Partial<AuthRequest>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockPerson = {
		id: new ObjectId().toString(),
		firstName: "John",
		lastName: "Doe",
		contactNumber: "+1234567890",
		isDeleted: false,
	};

	const mockUser = {
		id: new ObjectId().toString(),
		userName: "johndoe",
		isDeleted: false,
		person: mockPerson,
	};

	beforeEach(() => {
		// Mock Prisma client
		prisma = {
			user: {
				findMany: async (params: Prisma.UserFindManyArgs) => [mockUser],
				count: async (params: Prisma.UserCountArgs) => 1,
				findFirst: async (params: Prisma.UserFindFirstArgs) =>
					params.where?.id === mockUser.id ? mockUser : null,
				findUnique: async (params: Prisma.UserFindUniqueArgs) =>
					params.where?.id === mockUser.id ? mockUser : null,
				update: async (params: Prisma.UserUpdateArgs) => {
					const updatedUser = {
						...mockUser,
						...params.data,
					};
					// Keep the person reference but don't update it here
					updatedUser.person = mockUser.person;
					return updatedUser;
				},
			},
			person: {
				update: async (params: Prisma.PersonUpdateArgs) => {
					const updatedPerson = {
						...mockPerson,
						...params.data,
					};
					return updatedPerson;
				},
			},
			$transaction: async (operations: Promise<any>[]) => {
				// Execute all operations and return results
				const results = await Promise.all(operations);
				// For update operations, we need to combine user and person updates
				if (results.length === 2) {
					const [updatedUser, updatedPerson] = results;
					return [
						{
							...updatedUser,
							person: updatedPerson,
						},
					];
				}
				return results;
			},
		};

		userController = controller(prisma as PrismaClient);
		sentData = undefined;
		statusCode = 200;
		req = {
			query: {},
			params: {},
			body: {},
			role: Role.admin, // Default to admin for tests
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
		it("should return paginated users for admin", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10" };
			req.role = Role.admin;
			await userController.getAll(req as AuthRequest, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("users").that.is.an("array");
			expect(sentData).to.have.property("total").that.equals(1);
			expect(sentData).to.have.property("page").that.equals(1);
			expect(sentData).to.have.property("totalPages").that.equals(1);
		});

		it("should deny access for regular users", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10" };
			req.role = Role.user;
			await userController.getAll(req as AuthRequest, res, next);
			expect(statusCode).to.equal(403);
			expect(sentData).to.have.property("message", "Insufficient permissions");
		});
	});

	describe(".getById()", () => {
		it("should return a user for admin", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockUser.id };
			req.role = Role.admin;
			await userController.getById(req as AuthRequest, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.deep.equal(mockUser);
		});

		it("should allow user to view their own profile", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockUser.id };
			req.role = Role.user;
			req.userId = mockUser.id; // User viewing their own profile
			await userController.getById(req as AuthRequest, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.deep.equal(mockUser);
		});

		it("should deny user from viewing other profiles", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockUser.id };
			req.role = Role.user;
			req.userId = new ObjectId().toString(); // Different user ID
			await userController.getById(req as AuthRequest, res, next);
			expect(statusCode).to.equal(403);
			expect(sentData).to.have.property("error", "You can only view your own profile");
		});

		it("should handle non-existent user", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: new ObjectId().toString() };
			req.role = Role.admin;
			await userController.getById(req as AuthRequest, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("error", "User not found");
		});
	});

	describe(".update()", () => {
		it("should update user details as admin", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				userName: "janesmith",
				firstName: "Jane",
				lastName: "Smith",
				contactNumber: "+1987654321",
			};
			req.params = { id: mockUser.id };
			req.body = updateData;
			req.role = Role.admin;
			await userController.update(req as AuthRequest, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("userName", updateData.userName);
			expect(sentData.person).to.have.property("firstName", updateData.firstName);
			expect(sentData.person).to.have.property("lastName", updateData.lastName);
			expect(sentData.person).to.have.property("contactNumber", updateData.contactNumber);
		});

		it("should allow user to update their own profile", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				userName: "janesmith",
				firstName: "Jane",
				lastName: "Smith",
				contactNumber: "+1987654321",
			};
			req.params = { id: mockUser.id };
			req.body = updateData;
			req.role = Role.user;
			req.userId = mockUser.id; // User updating their own profile
			await userController.update(req as AuthRequest, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("userName", updateData.userName);
		});

		it("should deny user from updating other profiles", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = { userName: "hacker" };
			req.params = { id: mockUser.id };
			req.body = updateData;
			req.role = Role.user;
			req.userId = new ObjectId().toString(); // Different user ID
			await userController.update(req as AuthRequest, res, next);
			expect(statusCode).to.equal(403);
			expect(sentData).to.have.property("error", "You can only update your own profile");
		});

		it("should validate contactNumber format", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = { contactNumber: "invalid-phone" };
			req.params = { id: mockUser.id };
			req.body = updateData;
			req.role = Role.admin;
			await userController.update(req as AuthRequest, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error").that.includes("Invalid");
		});
	});

	describe(".remove()", () => {
		it("should delete a user as super_admin", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockUser.id };
			req.role = Role.super_admin;
			await userController.remove(req as AuthRequest, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("message", "User deleted");
		});

		it("should deny deletion for non-super_admin users", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockUser.id };
			req.role = Role.admin; // Admin but not super_admin
			await userController.remove(req as AuthRequest, res, next);
			expect(statusCode).to.equal(403);
			expect(sentData).to.have.property("message", "Insufficient permissions");
		});

		it("should handle non-existent user deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: new ObjectId().toString() };
			req.role = Role.super_admin;
			await userController.remove(req as AuthRequest, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("error", "User not found");
		});
	});
});
