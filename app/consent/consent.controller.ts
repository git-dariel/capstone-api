import { NextFunction, Request, Response } from "express";
import { config } from "../../config/error.config";
import {
	Financial,
	Live,
	PhysicalProblem,
	PhysicalSymptoms,
	Prisma,
	PrismaClient,
	Referred,
	Services,
} from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { createNotificationHelper } from "../../helper/notification.helper";

const logger = getLogger();
const consentLogger = logger.child({ module: "consent" });

export const controller = (prisma: PrismaClient) => {
	const notificationHelper = createNotificationHelper(prisma);
	const getById = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		if (!id) {
			consentLogger.error(config.ERROR.CONSENT.MISSING_ID);
			res.status(400).json({ error: config.ERROR.CONSENT.MISSING_ID });
			return;
		}

		if (fields && typeof fields !== "string") {
			consentLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.CONSENT.POPULATE_MUST_BE_STRING });
			return;
		}

		consentLogger.info(`${config.SUCCESS.CONSENT.GETTING_BY_ID}: ${id}`);

		try {
			const query: Prisma.ConsentFindFirstArgs = {
				where: {
					id,
					isDeleted: false,
					student: {
						isDeleted: false,
					},
				},
			};

			if (fields) {
				const fieldSelections = fields.split(",").reduce(
					(acc, field) => {
						const parts = field.trim().split(".");
						if (parts.length > 1) {
							const [parent, ...children] = parts;
							acc[parent] = acc[parent] || { select: {} };

							let current = acc[parent].select;
							for (let i = 0; i < children.length - 1; i++) {
								current[children[i]] = current[children[i]] || { select: {} };
								current = current[children[i]].select;
							}
							current[children[children.length - 1]] = true;
						} else {
							acc[parts[0]] = true;
						}
						return acc;
					},
					{ id: true } as Record<string, any>,
				);

				query.select = fieldSelections;
			} else {
				// Default include student with person when no specific fields are requested
				query.include = {
					student: {
						include: {
							person: true,
						},
					},
				};
			}

			const consent = await prisma.consent.findFirst(query);

			if (!consent) {
				consentLogger.error(`${config.ERROR.CONSENT.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.CONSENT.NOT_FOUND });
				return;
			}

			consentLogger.info(`${config.SUCCESS.CONSENT.RETRIEVED}: ${consent.id}`);
			res.status(200).json(consent);
		} catch (error) {
			consentLogger.error(`${config.ERROR.CONSENT.ERROR_GETTING_CONSENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.CONSENT.INTERNAL_SERVER_ERROR });
		}
	};

	const getByStudentId = async (req: Request, res: Response, _next: NextFunction) => {
		const { studentId } = req.params;
		const { fields } = req.query;

		if (!studentId) {
			consentLogger.error(config.ERROR.CONSENT.STUDENT_ID_REQUIRED);
			res.status(400).json({ error: config.ERROR.CONSENT.STUDENT_ID_REQUIRED });
			return;
		}

		if (fields && typeof fields !== "string") {
			consentLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.CONSENT.POPULATE_MUST_BE_STRING });
			return;
		}

		consentLogger.info(`Getting consent by student ID: ${studentId}`);

		try {
			const query: Prisma.ConsentFindFirstArgs = {
				where: {
					studentId,
					isDeleted: false,
					student: {
						isDeleted: false,
					},
				},
			};

			if (fields) {
				const fieldSelections = fields.split(",").reduce(
					(acc, field) => {
						const parts = field.trim().split(".");
						if (parts.length > 1) {
							const [parent, ...children] = parts;
							acc[parent] = acc[parent] || { select: {} };

							let current = acc[parent].select;
							for (let i = 0; i < children.length - 1; i++) {
								current[children[i]] = current[children[i]] || { select: {} };
								current = current[children[i]].select;
							}
							current[children[children.length - 1]] = true;
						} else {
							acc[parts[0]] = true;
						}
						return acc;
					},
					{ id: true } as Record<string, any>,
				);

				query.select = fieldSelections;
			} else {
				// Default include student with person when no specific fields are requested
				query.include = {
					student: {
						include: {
							person: true,
						},
					},
				};
			}

			const consent = await prisma.consent.findFirst(query);

			if (!consent) {
				consentLogger.error(`Consent not found for student: ${studentId}`);
				res.status(404).json({ error: config.ERROR.CONSENT.NOT_FOUND });
				return;
			}

			consentLogger.info(`${config.SUCCESS.CONSENT.RETRIEVED}: ${consent.id}`);
			res.status(200).json(consent);
		} catch (error) {
			consentLogger.error(`${config.ERROR.CONSENT.ERROR_GETTING_CONSENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.CONSENT.INTERNAL_SERVER_ERROR });
		}
	};

	const getAll = async (req: Request, res: Response, _next: NextFunction) => {
		const { page = 1, limit = 10, sort, fields, query, order = "desc" } = req.query;

		if (isNaN(Number(page)) || Number(page) < 1) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_PAGE}: ${page}`);
			res.status(400).json({ error: config.ERROR.CONSENT.INVALID_PAGE });
			return;
		}

		if (isNaN(Number(limit)) || Number(limit) < 1) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_LIMIT}: ${limit}`);
			res.status(400).json({ error: config.ERROR.CONSENT.INVALID_LIMIT });
			return;
		}

		if (order && !["asc", "desc"].includes(order as string)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_ORDER}: ${order}`);
			res.status(400).json({ error: config.ERROR.CONSENT.ORDER_MUST_BE_ASC_OR_DESC });
			return;
		}

		if (fields && typeof fields !== "string") {
			consentLogger.error(`Invalid fields: ${fields}`);
			res.status(400).json({ error: config.ERROR.CONSENT.POPULATE_MUST_BE_STRING });
			return;
		}

		const skip = (Number(page) - 1) * Number(limit);

		consentLogger.info(
			`${config.SUCCESS.CONSENT.GETTING_ALL}, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
		);

		try {
			const whereClause: Prisma.ConsentWhereInput = {
				isDeleted: false,
				student: {
					isDeleted: false,
				},
				...(query
					? {
							OR: [
								{
									student: {
										studentNumber: {
											contains: String(query),
											mode: Prisma.QueryMode.insensitive,
										},
									},
								},
								{
									student: {
										program: {
											contains: String(query),
											mode: Prisma.QueryMode.insensitive,
										},
									},
								},
								{
									student: {
										year: {
											contains: String(query),
											mode: Prisma.QueryMode.insensitive,
										},
									},
								},
								{
									student: {
										person: {
											firstName: {
												contains: String(query),
												mode: Prisma.QueryMode.insensitive,
											},
										},
									},
								},
								{
									student: {
										person: {
											lastName: {
												contains: String(query),
												mode: Prisma.QueryMode.insensitive,
											},
										},
									},
								},
								{
									student: {
										person: {
											email: {
												contains: String(query),
												mode: Prisma.QueryMode.insensitive,
											},
										},
									},
								},
								{
									what_brings_you_to_guidance: {
										contains: String(query),
										mode: Prisma.QueryMode.insensitive,
									},
								},
							],
						}
					: {}),
			};

			const findManyQuery: Prisma.ConsentFindManyArgs = {
				where: whereClause,
				skip,
				take: Number(limit),
				orderBy: sort
					? typeof sort === "string" && !sort.startsWith("{")
						? { [sort as string]: order }
						: JSON.parse(sort as string)
					: { createdAt: order as Prisma.SortOrder },
			};

			if (fields) {
				const fieldSelections = fields.split(",").reduce(
					(acc, field) => {
						const parts = field.trim().split(".");
						if (parts.length > 1) {
							const [parent, ...children] = parts;
							acc[parent] = acc[parent] || { select: {} };

							let current = acc[parent].select;
							for (let i = 0; i < children.length - 1; i++) {
								current[children[i]] = current[children[i]] || { select: {} };
								current = current[children[i]].select;
							}
							current[children[children.length - 1]] = true;
						} else {
							acc[parts[0]] = true;
						}
						return acc;
					},
					{ id: true } as Record<string, any>,
				);

				findManyQuery.select = fieldSelections;
			} else {
				// Default include student with person when no specific fields are requested
				findManyQuery.include = {
					student: {
						include: {
							person: true,
						},
					},
				};
			}

			const [consents, total] = await Promise.all([
				prisma.consent.findMany(findManyQuery),
				prisma.consent.count({ where: whereClause }),
			]);

			consentLogger.info(`Retrieved ${consents.length} consents`);
			res.status(200).json({
				consents,
				total,
				page: Number(page),
				totalPages: Math.ceil(total / Number(limit)),
			});
		} catch (error) {
			consentLogger.error(`${config.ERROR.CONSENT.ERROR_GETTING_CONSENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.CONSENT.INTERNAL_SERVER_ERROR });
		}
	};

	const create = async (req: Request, res: Response, _next: NextFunction) => {
		const {
			studentId,
			referred,
			with_whom_do_you_live,
			financial_status,
			what_brings_you_to_guidance,
			physical_problem,
			physical_symptoms,
			concerns,
			services,
		} = req.body;

		if (!studentId) {
			consentLogger.error(config.ERROR.CONSENT.STUDENT_ID_REQUIRED);
			res.status(400).json({
				error: config.ERROR.CONSENT.STUDENT_ID_REQUIRED,
			});
			return;
		}

		if (!financial_status) {
			consentLogger.error("Financial status is required");
			res.status(400).json({
				error: "Financial status is required",
			});
			return;
		}

		if (!physical_problem) {
			consentLogger.error("Physical problem status is required");
			res.status(400).json({
				error: "Physical problem status is required",
			});
			return;
		}

		if (!physical_symptoms) {
			consentLogger.error("Physical symptoms is required");
			res.status(400).json({
				error: "Physical symptoms is required",
			});
			return;
		}

		if (!concerns) {
			consentLogger.error("Present concerns is required");
			res.status(400).json({
				error: "Present concerns is required",
			});
			return;
		}

		// Validate enum values
		if (referred && !Object.values(Referred).includes(referred)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_REFERRED}: ${referred}`);
			res.status(400).json({
				error: `Invalid referred value. Must be one of: ${Object.values(Referred).join(", ")}`,
			});
			return;
		}

		if (with_whom_do_you_live && !Object.values(Live).includes(with_whom_do_you_live)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_LIVE}: ${with_whom_do_you_live}`);
			res.status(400).json({
				error: `Invalid living situation. Must be one of: ${Object.values(Live).join(", ")}`,
			});
			return;
		}

		if (!Object.values(Financial).includes(financial_status)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_FINANCIAL}: ${financial_status}`);
			res.status(400).json({
				error: `Invalid financial status. Must be one of: ${Object.values(Financial).join(", ")}`,
			});
			return;
		}

		if (!Object.values(PhysicalProblem).includes(physical_problem)) {
			consentLogger.error(
				`${config.ERROR.CONSENT.INVALID_PHYSICAL_PROBLEM}: ${physical_problem}`,
			);
			res.status(400).json({
				error: `Invalid physical problem value. Must be one of: ${Object.values(PhysicalProblem).join(", ")}`,
			});
			return;
		}

		if (!Object.values(PhysicalSymptoms).includes(physical_symptoms)) {
			consentLogger.error(
				`${config.ERROR.CONSENT.INVALID_PHYSICAL_SYMPTOMS}: ${physical_symptoms}`,
			);
			res.status(400).json({
				error: `Invalid physical symptoms. Must be one of: ${Object.values(PhysicalSymptoms).join(", ")}`,
			});
			return;
		}

		if (!Object.values(Services).includes(services)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_SERVICES}: ${services}`);
			res.status(400).json({
				error: `Invalid services value. Must be one of: ${Object.values(Services).join(", ")}`,
			});
			return;
		}

		try {
			// Check if student exists
			const existingStudent = await prisma.student.findFirst({
				where: {
					id: studentId,
					isDeleted: false,
				},
			});

			if (!existingStudent) {
				consentLogger.error(`${config.ERROR.CONSENT.STUDENT_NOT_FOUND}: ${studentId}`);
				res.status(404).json({
					error: config.ERROR.CONSENT.STUDENT_NOT_FOUND,
				});
				return;
			}

			// Check if consent already exists for this student
			const existingConsent = await prisma.consent.findFirst({
				where: {
					studentId,
					isDeleted: false,
				},
			});

			if (existingConsent) {
				consentLogger.error(`${config.ERROR.CONSENT.EXISTING_CONSENT}: ${studentId}`);
				res.status(409).json({
					error: config.ERROR.CONSENT.EXISTING_CONSENT,
				});
				return;
			}

			const newConsent = await prisma.consent.create({
				data: {
					studentId,
					referred: referred || Referred.self,
					with_whom_do_you_live: with_whom_do_you_live || Live.guardians,
					financial_status,
					what_brings_you_to_guidance: what_brings_you_to_guidance || null,
					physical_problem,
					physical_symptoms,
					concerns,
					services,
				},
				include: {
					student: {
						include: {
							person: true,
						},
					},
				},
			});

			consentLogger.info(`${config.SUCCESS.CONSENT.CREATED}: ${newConsent.id}`);

			// Create notification for consent creation
			try {
				await notificationHelper.createConsentNotification(
					"CREATED",
					newConsent.studentId,
					newConsent.id,
					{
						financialStatus: newConsent.financial_status,
						services: newConsent.services,
						concerns: newConsent.concerns,
						studentName: newConsent.student?.person
							? `${newConsent.student.person.firstName} ${newConsent.student.person.lastName}`
							: "Unknown Student",
					},
				);
			} catch (notificationError) {
				consentLogger.warn(`Failed to create consent notification: ${notificationError}`);
			}

			res.status(201).json({
				message: "Consent created successfully",
				consent: newConsent,
			});
		} catch (error) {
			consentLogger.error(`${config.ERROR.CONSENT.ERROR_GETTING_CONSENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.CONSENT.INTERNAL_SERVER_ERROR });
		}
	};

	const update = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const {
			referred,
			with_whom_do_you_live,
			financial_status,
			what_brings_you_to_guidance,
			physical_problem,
			physical_symptoms,
			concerns,
			services,
		} = req.body;

		if (!id) {
			consentLogger.error(config.ERROR.CONSENT.MISSING_ID);
			res.status(400).json({ error: config.ERROR.CONSENT.MISSING_ID });
			return;
		}

		if (Object.keys(req.body).length === 0) {
			consentLogger.error(config.ERROR.CONSENT.NO_UPDATE_FIELDS);
			res.status(400).json({
				error: config.ERROR.CONSENT.AT_LEAST_ONE_FIELD_REQUIRED,
			});
			return;
		}

		// Validate enum values if provided
		if (referred && !Object.values(Referred).includes(referred)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_REFERRED}: ${referred}`);
			res.status(400).json({
				error: `Invalid referred value. Must be one of: ${Object.values(Referred).join(", ")}`,
			});
			return;
		}

		if (with_whom_do_you_live && !Object.values(Live).includes(with_whom_do_you_live)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_LIVE}: ${with_whom_do_you_live}`);
			res.status(400).json({
				error: `Invalid living situation. Must be one of: ${Object.values(Live).join(", ")}`,
			});
			return;
		}

		if (financial_status && !Object.values(Financial).includes(financial_status)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_FINANCIAL}: ${financial_status}`);
			res.status(400).json({
				error: `Invalid financial status. Must be one of: ${Object.values(Financial).join(", ")}`,
			});
			return;
		}

		if (physical_problem && !Object.values(PhysicalProblem).includes(physical_problem)) {
			consentLogger.error(
				`${config.ERROR.CONSENT.INVALID_PHYSICAL_PROBLEM}: ${physical_problem}`,
			);
			res.status(400).json({
				error: `Invalid physical problem value. Must be one of: ${Object.values(PhysicalProblem).join(", ")}`,
			});
			return;
		}

		if (physical_symptoms && !Object.values(PhysicalSymptoms).includes(physical_symptoms)) {
			consentLogger.error(
				`${config.ERROR.CONSENT.INVALID_PHYSICAL_SYMPTOMS}: ${physical_symptoms}`,
			);
			res.status(400).json({
				error: `Invalid physical symptoms. Must be one of: ${Object.values(PhysicalSymptoms).join(", ")}`,
			});
			return;
		}

		if (services && !Object.values(Services).includes(services)) {
			consentLogger.error(`${config.ERROR.CONSENT.INVALID_SERVICES}: ${services}`);
			res.status(400).json({
				error: `Invalid services value. Must be one of: ${Object.values(Services).join(", ")}`,
			});
			return;
		}

		consentLogger.info(`Updating consent: ${id}`);

		try {
			const existingConsent = await prisma.consent.findFirst({
				where: {
					id,
					isDeleted: false,
				},
			});

			if (!existingConsent) {
				consentLogger.error(`${config.ERROR.CONSENT.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.CONSENT.NOT_FOUND });
				return;
			}

			const updateData: Prisma.ConsentUpdateInput = {
				updatedAt: new Date(),
			};

			if (referred !== undefined) updateData.referred = referred;
			if (with_whom_do_you_live !== undefined)
				updateData.with_whom_do_you_live = with_whom_do_you_live;
			if (financial_status !== undefined) updateData.financial_status = financial_status;
			if (what_brings_you_to_guidance !== undefined)
				updateData.what_brings_you_to_guidance = what_brings_you_to_guidance;
			if (physical_problem !== undefined) updateData.physical_problem = physical_problem;
			if (physical_symptoms !== undefined) updateData.physical_symptoms = physical_symptoms;
			if (concerns !== undefined) updateData.concerns = concerns;
			if (services !== undefined) updateData.services = services;

			const updatedConsent = await prisma.consent.update({
				where: { id },
				data: updateData,
				include: {
					student: {
						include: {
							person: true,
						},
					},
				},
			});

			consentLogger.info(`${config.SUCCESS.CONSENT.UPDATE}: ${updatedConsent.id}`);

			// Create notification for consent update
			try {
				await notificationHelper.createConsentNotification(
					"UPDATED",
					updatedConsent.studentId,
					updatedConsent.id,
					{
						financialStatus: updatedConsent.financial_status,
						services: updatedConsent.services,
						concerns: updatedConsent.concerns,
						studentName: updatedConsent.student?.person
							? `${updatedConsent.student.person.firstName} ${updatedConsent.student.person.lastName}`
							: "Unknown Student",
					},
				);
			} catch (notificationError) {
				consentLogger.warn(
					`Failed to create consent update notification: ${notificationError}`,
				);
			}

			res.status(200).json(updatedConsent);
		} catch (error) {
			consentLogger.error(`${config.ERROR.CONSENT.ERROR_UPDATING_CONSENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.CONSENT.INTERNAL_SERVER_ERROR });
		}
	};

	const remove = async (req: Request, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!id) {
			consentLogger.error(config.ERROR.CONSENT.MISSING_ID);
			res.status(400).json({ error: config.ERROR.CONSENT.MISSING_ID });
			return;
		}

		consentLogger.info(`${config.SUCCESS.CONSENT.SOFT_DELETING}: ${id}`);

		try {
			const existingConsent = await prisma.consent.findFirst({
				where: {
					id,
					isDeleted: false,
				},
			});

			if (!existingConsent) {
				consentLogger.error(`${config.ERROR.CONSENT.NOT_FOUND}: ${id}`);
				res.status(404).json({ error: config.ERROR.CONSENT.NOT_FOUND });
				return;
			}

			await prisma.consent.update({
				where: { id },
				data: {
					isDeleted: true,
					updatedAt: new Date(),
				},
			});

			consentLogger.info(`${config.SUCCESS.CONSENT.DELETED}: ${id}`);
			res.status(200).json({ message: config.SUCCESS.CONSENT.DELETED });
		} catch (error) {
			consentLogger.error(`${config.ERROR.CONSENT.ERROR_DELETING_CONSENT}: ${error}`);
			res.status(500).json({ error: config.ERROR.CONSENT.INTERNAL_SERVER_ERROR });
		}
	};

	return {
		getById,
		getByStudentId,
		getAll,
		create,
		update,
		remove,
	};
};
