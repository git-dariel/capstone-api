import { controller } from "../../app/announcement/announcement.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { ObjectId } from "mongodb";

// Increase timeout for all tests
const TEST_TIMEOUT = 5000;

describe("Announcement Controller", () => {
	let announcementController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockAnnouncement = {
		id: new ObjectId().toString(),
		title: "System Maintenance Notice",
		description: "The system will be under maintenance from 2AM to 4AM tomorrow.",
		attachement: "https://example.com/maintenance-schedule.pdf",
		createdAt: new Date("2024-01-15T10:00:00.000Z"),
		updatedAt: new Date("2024-01-15T10:00:00.000Z"),
		isDeleted: false,
	};

	beforeEach(() => {
		// Mock Prisma client
		let createdAnnouncement: any = null;
		let updatedAnnouncementData = { ...mockAnnouncement };

		prisma = {
			announcement: {
				findMany: async (params: Prisma.AnnouncementFindManyArgs) => [
					updatedAnnouncementData,
				],
				count: async (params: Prisma.AnnouncementCountArgs) => 1,
				findFirst: async (params: Prisma.AnnouncementFindFirstArgs) => {
					if (params.where?.id === mockAnnouncement.id) {
						return updatedAnnouncementData;
					}
					if (params.where?.title === mockAnnouncement.title) {
						return updatedAnnouncementData;
					}
					return null;
				},
				findUnique: async (params: Prisma.AnnouncementFindUniqueArgs) => {
					if (params.where?.id === mockAnnouncement.id) {
						return updatedAnnouncementData;
					}
					if (createdAnnouncement && params.where?.id === createdAnnouncement.id) {
						return createdAnnouncement;
					}
					return null;
				},
				create: async (params: Prisma.AnnouncementCreateArgs) => {
					const newAnnouncement = {
						id: new ObjectId().toString(),
						...(params.data as any),
						createdAt: new Date(),
						isDeleted: false,
					};
					createdAnnouncement = newAnnouncement;
					return newAnnouncement;
				},
				update: async (params: Prisma.AnnouncementUpdateArgs) => {
					updatedAnnouncementData = {
						...updatedAnnouncementData,
						...(params.data as any),
						updatedAt: new Date(),
					};
					return updatedAnnouncementData;
				},
			},
		};

		announcementController = controller(prisma as PrismaClient);
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
		it("should return paginated announcements", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10" };
			await announcementController.getAll(req as Request, res, next);
			expect(sentData).to.have.property("announcements").that.is.an("array");
			expect(sentData).to.have.property("total").that.equals(1);
			expect(sentData).to.have.property("page").that.equals(1);
			expect(sentData).to.have.property("totalPages").that.equals(1);
		});

		it("should handle invalid page parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "0", limit: "10" };
			await announcementController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid page number");
		});

		it("should handle invalid limit parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "0" };
			await announcementController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid limit number");
		});

		it("should handle invalid order parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", order: "invalid" };
			await announcementController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Order must be either 'asc' or 'desc'");
		});

		it("should handle invalid fields parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", fields: 123 as any };
			await announcementController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property(
				"error",
				"Populate parameter must be a comma-separated string",
			);
		});

		it("should handle search query", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", query: "System" };
			await announcementController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("announcements").that.is.an("array");
		});

		it("should sort by createdAt by default", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10" };
			await announcementController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("announcements").that.is.an("array");
		});
	});

	describe(".getById()", () => {
		it("should return an announcement", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockAnnouncement.id };
			await announcementController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.deep.equal(mockAnnouncement);
		});

		it("should handle missing ID", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = {};
			await announcementController.getById(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Missing announcement ID");
		});

		it("should handle non-existent announcement", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: new ObjectId().toString() };
			await announcementController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("error", "Announcement not found");
		});

		it("should handle invalid fields parameter", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockAnnouncement.id };
			req.query = { fields: 123 as any };
			await announcementController.getById(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property(
				"error",
				"Populate parameter must be a comma-separated string",
			);
		});

		it("should handle field selection", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockAnnouncement.id };
			req.query = { fields: "title,description" };
			await announcementController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
		});
	});

	describe(".create()", () => {
		it("should create a new announcement", async function () {
			this.timeout(TEST_TIMEOUT);
			const announcementData = {
				title: "Holiday Notice",
				description: "The office will be closed on Christmas Day and New Year's Day.",
				attachement: "https://example.com/holiday-schedule.pdf",
			};
			req.body = announcementData;

			// Mock to return null for existing announcement check
			prisma.announcement.findFirst = async () => null;

			await announcementController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("title", announcementData.title);
			expect(sentData).to.have.property("description", announcementData.description);
			expect(sentData).to.have.property("attachement", announcementData.attachement);
		});

		it("should create announcement without attachment", async function () {
			this.timeout(TEST_TIMEOUT);
			const announcementData = {
				title: "Policy Update",
				description: "Our privacy policy has been updated to comply with new regulations.",
			};
			req.body = announcementData;

			// Mock to return null for existing announcement check
			prisma.announcement.findFirst = async () => null;

			await announcementController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("title", announcementData.title);
			expect(sentData).to.have.property("description", announcementData.description);
			expect(sentData).to.have.property("attachement", null);
		});

		it("should handle missing title", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				description: "This announcement is missing a title.",
			};
			await announcementController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid announcement data provided");
		});

		it("should handle missing description", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				title: "Title Without Description",
			};
			await announcementController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid announcement data provided");
		});

		it("should handle empty title", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				title: "",
				description: "This has an empty title.",
			};
			await announcementController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid announcement data provided");
		});

		it("should handle whitespace-only title", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				title: "   ",
				description: "This has a whitespace-only title.",
			};
			await announcementController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid announcement title");
		});

		it("should handle empty description", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				title: "Title With Empty Description",
				description: "",
			};
			await announcementController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid announcement data provided");
		});

		it("should handle whitespace-only description", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				title: "Title With Whitespace Description",
				description: "   ",
			};
			await announcementController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid announcement description");
		});

		it("should handle non-string title", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				title: 123,
				description: "Valid description",
			};
			await announcementController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid announcement title");
		});

		it("should handle non-string description", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				title: "Valid Title",
				description: 123,
			};
			await announcementController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid announcement description");
		});

		it("should handle existing announcement", async function () {
			this.timeout(TEST_TIMEOUT);
			const announcementData = {
				title: mockAnnouncement.title,
				description: "Different description but same title.",
			};
			req.body = announcementData;

			await announcementController.create(req as Request, res, next);
			expect(statusCode).to.equal(409);
			expect(sentData).to.have.property("message", "Announcement already exists");
		});

		it("should trim title and description", async function () {
			this.timeout(TEST_TIMEOUT);
			const announcementData = {
				title: "  Trimmed Title  ",
				description: "  Trimmed Description  ",
			};
			req.body = announcementData;

			// Mock to return null for existing announcement check
			prisma.announcement.findFirst = async () => null;

			await announcementController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
		});
	});

	describe(".update()", () => {
		it("should update announcement", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				title: "Updated System Maintenance Notice",
				description: "The maintenance window has been extended to 6AM.",
			};
			req.params = { id: mockAnnouncement.id };
			req.body = updateData;

			await announcementController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("title", updateData.title);
			expect(sentData).to.have.property("description", updateData.description);
		});

		it("should update only title", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				title: "Updated Title Only",
			};
			req.params = { id: mockAnnouncement.id };
			req.body = updateData;

			await announcementController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("title", updateData.title);
		});

		it("should update only description", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				description: "Updated description only.",
			};
			req.params = { id: mockAnnouncement.id };
			req.body = updateData;

			await announcementController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("description", updateData.description);
		});

		it("should update attachment", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				attachement: "https://example.com/updated-file.pdf",
			};
			req.params = { id: mockAnnouncement.id };
			req.body = updateData;

			await announcementController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("attachement", updateData.attachement);
		});

		it("should clear attachment", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				attachement: null,
			};
			req.params = { id: mockAnnouncement.id };
			req.body = updateData;

			await announcementController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("attachement", null);
		});

		it("should handle missing ID", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = {};
			req.body = { title: "Updated Title" };
			await announcementController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Missing announcement ID");
		});

		it("should handle empty update data", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockAnnouncement.id };
			req.body = {};
			await announcementController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "At least one field is required for update");
		});

		it("should handle non-existent announcement", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: new ObjectId().toString() };
			req.body = { title: "Updated Title" };
			await announcementController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("error", "Announcement not found");
		});

		it("should handle invalid title in update", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockAnnouncement.id };
			req.body = { title: "" };
			await announcementController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid announcement title");
		});

		it("should handle invalid description in update", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockAnnouncement.id };
			req.body = { description: "" };
			await announcementController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid announcement description");
		});

		it("should handle non-string title in update", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockAnnouncement.id };
			req.body = { title: 123 };
			await announcementController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid announcement title");
		});

		it("should handle non-string description in update", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockAnnouncement.id };
			req.body = { description: 123 };
			await announcementController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Invalid announcement description");
		});

		it("should trim title and description in update", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockAnnouncement.id };
			req.body = {
				title: "  Trimmed Updated Title  ",
				description: "  Trimmed Updated Description  ",
			};
			await announcementController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
		});
	});

	describe(".remove()", () => {
		it("should delete an announcement", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockAnnouncement.id };
			await announcementController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("message", "Announcement deleted successfully");
		});

		it("should handle missing ID", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = {};
			await announcementController.remove(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("error", "Missing announcement ID");
		});

		it("should handle non-existent announcement deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: new ObjectId().toString() };
			await announcementController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("error", "Announcement not found");
		});
	});
});
