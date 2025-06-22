import { controller } from "../../app/person/person.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { ObjectId } from "mongodb";

// Increase timeout for all tests
const TEST_TIMEOUT = 5000;

describe("Person Controller", () => {
	let personController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockPerson = {
		id: new ObjectId().toString(),
		firstName: "John",
		lastName: "Doe",
		middleName: "Michael",
		contactNumber: "+1234567890",
		isDeleted: false,
	};

	beforeEach(() => {
		// Mock Prisma client
		prisma = {
			person: {
				findMany: async (params: Prisma.PersonFindManyArgs) => [mockPerson],
				count: async (params: Prisma.PersonCountArgs) => 1,
				findFirst: async (params: Prisma.PersonFindFirstArgs) => {
					// Handle the case for existing person check with contactNumber
					if (params.where?.AND) {
						const conditions = params.where.AND as any[];
						const hasContactNumber = conditions.some(
							(c) => c.contactNumber === mockPerson.contactNumber,
						);
						const hasFirstName = conditions.some(
							(c) => c.firstName === mockPerson.firstName,
						);
						const hasLastName = conditions.some(
							(c) => c.lastName === mockPerson.lastName,
						);
						const hasIsDeleted = conditions.some((c) => c.isDeleted === false);

						// Updated logic: if contactNumber matches and isDeleted is false,
						// and either no firstName/lastName conditions or they match
						if (hasContactNumber && hasIsDeleted) {
							const firstNameCondition = conditions.find((c) => c.firstName);
							const lastNameCondition = conditions.find((c) => c.lastName);

							// If firstName condition exists, it must match
							if (
								firstNameCondition &&
								firstNameCondition.firstName !== mockPerson.firstName
							) {
								return null;
							}

							// If lastName condition exists, it must match
							if (
								lastNameCondition &&
								lastNameCondition.lastName !== mockPerson.lastName
							) {
								return null;
							}

							return mockPerson;
						}
					}

					// Handle the case for existing person check without contactNumber (legacy)
					if (
						params.where?.firstName === mockPerson.firstName &&
						params.where?.lastName === mockPerson.lastName &&
						params.where?.isDeleted === false
					) {
						return mockPerson;
					}

					// Handle the case for ID lookup
					if (params.where?.id === mockPerson.id) {
						return mockPerson;
					}

					return null;
				},
				findUnique: async (params: Prisma.PersonFindUniqueArgs) =>
					params.where?.id === mockPerson.id ? mockPerson : null,
				create: async (params: Prisma.PersonCreateArgs) => ({
					id: new ObjectId().toString(),
					...params.data,
					isDeleted: false,
				}),
				update: async (params: Prisma.PersonUpdateArgs) => ({
					...mockPerson,
					...params.data,
				}),
			},
		};

		personController = controller(prisma as PrismaClient);
		sentData = undefined;
		statusCode = 200;
		req = {
			query: {},
			params: {},
			body: {},
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
		it("should return paginated persons", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10" };
			await personController.getAll(req as Request, res, next);
			expect(sentData).to.have.property("person").that.is.an("array");
			expect(sentData).to.have.property("total").that.equals(1);
			expect(sentData).to.have.property("page").that.equals(1);
			expect(sentData).to.have.property("totalPages").that.equals(1);
		});

		it("should handle invalid page parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "invalid", limit: "10" };
			await personController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid page number");
		});

		it("should handle invalid limit parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "invalid" };
			await personController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid limit number");
		});
	});

	describe(".getById()", () => {
		it("should return a person", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockPerson.id };
			await personController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.deep.equal(mockPerson);
		});

		it("should handle non-existent person", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: new ObjectId().toString() };
			await personController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("error", "Person not found");
		});

		it("should handle missing id parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = {};
			await personController.getById(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Person ID is required");
		});
	});

	describe(".create()", () => {
		it("should create a new person", async function () {
			this.timeout(TEST_TIMEOUT);
			const newPerson = {
				firstName: "Jane",
				lastName: "Smith",
				middleName: "Elizabeth",
			};
			req.body = newPerson;
			await personController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.include(newPerson);
			expect(sentData).to.have.property("id");
			expect(sentData).to.have.property("isDeleted", false);
		});

		it("should return existing person if found", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				firstName: mockPerson.firstName,
				lastName: mockPerson.lastName,
				contactNumber: "+1234567890",
			};
			await personController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.deep.equal(mockPerson);
		});

		it("should create a person with only firstName", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = { firstName: "Jane" };
			await personController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("firstName", "Jane");
			expect(sentData).to.have.property("id");
			expect(sentData).to.have.property("isDeleted", false);
		});

		it("should create a person with only lastName", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = { lastName: "Smith" };
			await personController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("lastName", "Smith");
			expect(sentData).to.have.property("id");
			expect(sentData).to.have.property("isDeleted", false);
		});

		it("should create a person with only contactNumber", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = { contactNumber: "+9876543210" };
			await personController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("contactNumber", "+9876543210");
			expect(sentData).to.have.property("id");
			expect(sentData).to.have.property("isDeleted", false);
		});
	});

	describe(".update()", () => {
		it("should update person details", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				firstName: "Jane",
				lastName: "Smith",
				middleName: "Elizabeth",
			};
			req.params = { id: mockPerson.id };
			req.body = updateData;
			await personController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.include(updateData);
		});

		it("should handle non-existent person", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: new ObjectId().toString() };
			req.body = { firstName: "Jane" };
			await personController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("error", "Person not found");
		});

		it("should handle missing update fields", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockPerson.id };
			req.body = {};
			await personController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "At least one field is required for update");
		});
	});

	describe(".remove()", () => {
		it("should soft delete a person", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockPerson.id };
			await personController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("message", "Person deleted");
		});

		it("should handle non-existent person deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: new ObjectId().toString() };
			await personController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("error", "Person not found");
		});

		it("should handle missing id parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = {};
			await personController.remove(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Person ID is required");
		});
	});
});
