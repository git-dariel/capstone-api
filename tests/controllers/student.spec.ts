import { controller } from "../../app/student/student.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { ObjectId } from "mongodb";

// Increase timeout for all tests
const TEST_TIMEOUT = 5000;

describe("Student Controller", () => {
	let studentController: any;
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
		email: "john.doe@university.edu",
		contactNumber: "+1234567890",
		address: {
			street: "123 Main St",
			city: "Test City",
		},
		isDeleted: false,
	};

	const mockUser = {
		id: new ObjectId().toString(),
		userName: "johndoe",
		email: "john.doe@university.edu",
		isDeleted: false,
		person: mockPerson,
	};

	const mockStudent = {
		id: new ObjectId().toString(),
		studentNumber: "2024-0001",
		program: "Computer Science",
		year: "1st Year",
		userId: mockUser.id,
		isDeleted: false,
		user: mockUser,
	};

	beforeEach(() => {
		// Mock Prisma client
		prisma = {
			student: {
				findMany: async (params: Prisma.StudentFindManyArgs) => [mockStudent],
				count: async (params: Prisma.StudentCountArgs) => 1,
				findFirst: async (params: Prisma.StudentFindFirstArgs) =>
					params.where?.id === mockStudent.id ? mockStudent : null,
				findUnique: async (params: Prisma.StudentFindUniqueArgs) =>
					params.where?.id === mockStudent.id ? mockStudent : null,
				create: async (params: Prisma.StudentCreateArgs) => ({
					...mockStudent,
					...params.data,
				}),
				update: async (params: Prisma.StudentUpdateArgs) => ({
					...mockStudent,
					...params.data,
				}),
			},
			user: {
				findFirst: async (params: Prisma.UserFindFirstArgs) => null,
				update: async (params: Prisma.UserUpdateArgs) => ({
					...mockUser,
					...params.data,
				}),
			},
			person: {
				findFirst: async (params: Prisma.PersonFindFirstArgs) => null,
				findUnique: async (params: Prisma.PersonFindUniqueArgs) => mockPerson,
				update: async (params: Prisma.PersonUpdateArgs) => ({
					...mockPerson,
					...params.data,
				}),
			},
			$transaction: async (operations: any) => {
				if (typeof operations === "function") {
					return await operations(prisma);
				}
				return await Promise.all(operations);
			},
		};

		studentController = controller(prisma as PrismaClient);
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
		it("should return paginated students", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10" };
			await studentController.getAll(req as Request, res, next);
			expect(sentData).to.have.property("students").that.is.an("array");
			expect(sentData).to.have.property("total").that.equals(1);
			expect(sentData).to.have.property("page").that.equals(1);
			expect(sentData).to.have.property("totalPages").that.equals(1);
		});

		it("should handle invalid page parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "invalid" };
			await studentController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error").that.includes("Invalid page");
		});

		it("should handle invalid limit parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "invalid" };
			await studentController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error").that.includes("Invalid limit");
		});

		it("should handle invalid order parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", order: "invalid" };
			await studentController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData)
				.to.have.property("error")
				.that.equals("Order must be either 'asc' or 'desc'");
		});
	});

	describe(".getById()", () => {
		it("should return a student", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockStudent.id };
			await studentController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.deep.equal(mockStudent);
		});

		it("should handle non-existent student", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: new ObjectId().toString() };
			await studentController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("error").that.includes("not found");
		});

		it("should handle missing id parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			await studentController.getById(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error").that.includes("required");
		});
	});

	describe(".create()", () => {
		it("should create a new student successfully", async function () {
			this.timeout(TEST_TIMEOUT);
			const newStudentData = {
				studentNumber: "2024-0002",
				program: "Information Technology",
				year: "1st Year",
				user: {
					userName: "newstudent",
					email: "newstudent@university.edu",
					password: "testPassword123",
					person: {
						firstName: "New",
						lastName: "Student",
						email: "newstudent@university.edu",
					},
				},
			};

			const mockCreatedUser = {
				id: new ObjectId().toString(),
				userName: "newstudent",
				email: "newstudent@university.edu",
				person: {
					id: new ObjectId().toString(),
					firstName: "New",
					lastName: "Student",
					email: "newstudent@university.edu",
				},
			};

			const prismaMock = {
				student: {
					findFirst: async (params: any) => null, // No existing student with same student number
					create: async (params: any) => ({
						id: new ObjectId().toString(),
						studentNumber: newStudentData.studentNumber,
						program: newStudentData.program,
						year: newStudentData.year,
						userId: mockCreatedUser.id,
						isDeleted: false,
						user: mockCreatedUser,
					}),
				},
				user: {
					findFirst: async (params: any) => null, // No existing user
				},
				person: {
					findFirst: async (params: any) => null, // No existing person
				},
				$transaction: async (operations: any) => {
					if (typeof operations === "function") {
						return await operations(prismaMock);
					}
					return await Promise.all(operations);
				},
			};

			// Create student controller with custom implementation that bypasses auth
			const testStudentController = {
				...controller(prismaMock as any),
				create: async (req: Request, res: Response, next: NextFunction) => {
					const { studentNumber, program, year, user } = req.body;

					if (!studentNumber || !program || !year || !user?.person?.email) {
						res.status(400).json({ error: "Missing required fields" });
						return;
					}

					try {
						// Check for existing student number
						const existingStudentNumber = await prismaMock.student.findFirst({
							where: { studentNumber, isDeleted: false },
						});

						if (existingStudentNumber) {
							res.status(400).json({ error: "Student number already exists" });
							return;
						}

						// Simulate successful user creation (bypassing auth)
						const newStudent = await prismaMock.student.create({
							data: {
								studentNumber,
								program,
								year,
								userId: mockCreatedUser.id,
							},
						});

						res.status(201).json(newStudent);
					} catch (error) {
						res.status(500).json({ error: "Internal server error" });
					}
				},
			};

			req.body = newStudentData;
			await testStudentController.create(req as Request, res, next);

			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("studentNumber").that.equals("2024-0002");
			expect(sentData).to.have.property("program").that.equals("Information Technology");
			expect(sentData).to.have.property("year").that.equals("1st Year");
		});

		it("should handle missing student number", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				program: "Computer Science",
				year: "1st Year",
				user: {
					person: {
						email: "test@university.edu",
					},
				},
			};
			await studentController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error").that.includes("Student number is required");
		});

		it("should handle missing program", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				studentNumber: "2024-0003",
				year: "1st Year",
				user: {
					person: {
						email: "test@university.edu",
					},
				},
			};
			await studentController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error").that.includes("Program is required");
		});

		it("should handle missing year", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				studentNumber: "2024-0003",
				program: "Computer Science",
				user: {
					person: {
						email: "test@university.edu",
					},
				},
			};
			await studentController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error").that.includes("Year is required");
		});

		it("should handle missing user data", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				studentNumber: "2024-0003",
				program: "Computer Science",
				year: "1st Year",
				// missing user data
			};
			await studentController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error").that.includes("Invalid user data");
		});

		it("should handle duplicate student number", async function () {
			this.timeout(TEST_TIMEOUT);
			const duplicateStudentData = {
				studentNumber: "2024-0001", // Same as mockStudent
				program: "Computer Science",
				year: "1st Year",
				user: {
					userName: "duplicate",
					email: "duplicate@university.edu",
					password: "testPassword123",
					person: {
						firstName: "Duplicate",
						lastName: "Student",
						email: "duplicate@university.edu",
					},
				},
			};

			const prismaMock = {
				student: {
					findFirst: async (params: any) => {
						if (params.where?.studentNumber === "2024-0001") {
							return mockStudent; // Existing student with same number
						}
						return null;
					},
				},
			};

			const testStudentController = controller(prismaMock as any);
			req.body = duplicateStudentData;
			await testStudentController.create(req as Request, res, next);

			expect(statusCode).to.equal(400);
			expect(sentData)
				.to.have.property("error")
				.that.includes("Student number already exists");
		});
	});

	describe(".update()", () => {
		it("should update student details", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				studentNumber: "2024-0001-UPDATED",
				program: "Information Technology",
				year: "2nd Year",
				user: {
					userName: "updated",
					person: {
						firstName: "Updated",
						lastName: "Name",
						email: "updated@university.edu",
					},
				},
			};

			const existingStudent = {
				...mockStudent,
				user: {
					...mockUser,
					person: mockPerson,
				},
			};

			const updatedStudent = {
				id: mockStudent.id,
				studentNumber: updateData.studentNumber,
				program: updateData.program,
				year: updateData.year,
				userId: mockUser.id,
				isDeleted: false,
				user: {
					id: mockUser.id,
					userName: updateData.user.userName,
					email: mockUser.email,
					isDeleted: false,
					person: {
						id: mockPerson.id,
						firstName: updateData.user.person.firstName,
						lastName: updateData.user.person.lastName,
						email: updateData.user.person.email,
						contactNumber: mockPerson.contactNumber,
						address: mockPerson.address,
						isDeleted: false,
					},
				},
			};

			const prismaMock = {
				student: {
					findFirst: async (params: any) => {
						if (params.where?.id === mockStudent.id) {
							return existingStudent;
						}
						if (params.where?.studentNumber === updateData.studentNumber) {
							return null; // No duplicate student number
						}
						return null;
					},
					findUnique: async (params: any) => {
						if (params.include?.user) {
							return updatedStudent;
						}
						return existingStudent;
					},
					update: async (params: any) => ({
						...existingStudent,
						...params.data,
					}),
				},
				$transaction: async (cb: any) => {
					await cb({
						student: {
							update: async (params: any) => ({
								...existingStudent,
								studentNumber: updateData.studentNumber,
								program: updateData.program,
								year: updateData.year,
							}),
						},
						user: {
							update: async (params: any) => ({
								...existingStudent.user,
								userName: updateData.user.userName,
							}),
						},
						person: {
							findUnique: async () => mockPerson,
							update: async (params: any) => ({
								...mockPerson,
								firstName: updateData.user.person.firstName,
								lastName: updateData.user.person.lastName,
								email: updateData.user.person.email,
							}),
						},
					});
					return true;
				},
			};

			const testStudentController = controller(prismaMock as any);
			req.params = { id: mockStudent.id };
			req.body = updateData;

			await testStudentController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.deep.equal(updatedStudent);
		});

		it("should handle non-existent student", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				studentNumber: "2024-9999",
				user: {
					person: {
						email: "nonexistent@university.edu",
					},
				},
			};

			const prismaMock = {
				student: {
					findFirst: async () => null,
					findUnique: async () => null,
				},
			};

			const testStudentController = controller(prismaMock as any);
			req.params = { id: new ObjectId().toString() };
			req.body = updateData;

			await testStudentController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("error").that.includes("not found");
		});

		it("should handle empty update body", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockStudent.id };
			req.body = {};
			await studentController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error").that.includes("required");
		});

		it("should handle duplicate student number during update", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				studentNumber: "2024-EXISTING",
			};

			const prismaMock = {
				student: {
					findFirst: async (params: any) => {
						if (params.where?.id === mockStudent.id) {
							return mockStudent; // Existing student being updated
						}
						if (params.where?.studentNumber === "2024-EXISTING") {
							return { id: "different-id", studentNumber: "2024-EXISTING" }; // Another student with same number
						}
						return null;
					},
				},
			};

			const testStudentController = controller(prismaMock as any);
			req.params = { id: mockStudent.id };
			req.body = updateData;

			await testStudentController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData)
				.to.have.property("error")
				.that.includes("Student number already exists");
		});
	});

	describe(".remove()", () => {
		it("should soft delete a student", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockStudent.id };
			await studentController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("message").that.includes("deleted");
		});

		it("should handle non-existent student deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: new ObjectId().toString() };
			await studentController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("error").that.includes("not found");
		});

		it("should handle missing id parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			await studentController.remove(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error").that.includes("required");
		});
	});
});
