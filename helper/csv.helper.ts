import { PrismaClient } from "../generated/prisma";
import { getLogger } from "./logger";

const logger = getLogger();
const csvLogger = logger.child({ module: "csv-export" });

interface StudentExportData {
	// Student Info
	studentId: string;
	studentNumber: string;
	program: string;
	year: string;
	status: string;
	// Person Info
	firstName: string;
	lastName: string;
	middleName: string;
	email: string;
	contactNumber: string;
	gender: string;
	age: number;
	// Anxiety Assessment
	anxietyScore: number;
	anxietySeverity: string;
	anxietyDate: string;
	// Depression Assessment
	depressionScore: number;
	depressionSeverity: string;
	depressionDate: string;
	// Stress Assessment
	stressScore: number;
	stressSeverity: string;
	stressDate: string;
	// Suicide Assessment
	suicideRisk: string;
	suicideDate: string;
	// Personal Checklist Problems
	checklistRisk: string;
	checklistProblems: number;
	checklistDate: string;
	// Timestamps
	createdAt: string;
	updatedAt: string;
}

interface ExportFilters {
	program?: string;
	gender?: string;
	severityLevel?: string;
	status?: string;
	assessmentType?: string;
	studentId?: string;
	firstName?: string;
	lastName?: string;
	year?: string;
}

/**
 * Export student data with mental health assessments to CSV format
 * @param prisma - PrismaClient instance
 * @param filters - Optional filters to apply to the export
 * @param filters.program - Filter by student program (partial match, case insensitive)
 * @param filters.gender - Filter by gender (exact match: male, female, other, prefer_not_to_say)
 * @param filters.severityLevel - Filter by severity level across all assessments (minimal, mild, moderate, moderately_severe, severe, low, high)
 * @param filters.status - Filter by academic status (freshman, sophomore, junior, senior)
 * @param filters.assessmentType - Filter to only include students with specific assessment type (anxiety, depression, stress, suicide, checklist)
 * @param filters.studentId - Filter by specific student ID (exact match)
 * @param filters.firstName - Filter by first name (partial match, case insensitive)
 * @param filters.lastName - Filter by last name (partial match, case insensitive)
 * @param filters.year - Filter by year level (1st, 2nd, 3rd, 4th, graduated)
 * @returns CSV content as string
 */
export const exportStudentDataCsv = async (
	prisma: PrismaClient,
	filters?: ExportFilters,
): Promise<string> => {
	try {
		csvLogger.info("Starting CSV export for student data with mental health assessments", {
			filters,
		});

		// Build where clause based on filters
		const whereClause: any = {
			isDeleted: false,
		};

		// Apply student-specific filters
		if (filters?.studentId) {
			whereClause.id = filters.studentId;
		}

		if (filters?.program) {
			whereClause.program = { contains: filters.program, mode: "insensitive" };
		}

		if (filters?.status) {
			whereClause.status = filters.status;
		}

		if (filters?.year) {
			whereClause.year = filters.year;
		}

		// Apply person-related filters
		if (filters?.gender || filters?.firstName || filters?.lastName) {
			whereClause.person = {
				...whereClause.person,
				...(filters?.gender && { gender: filters.gender }),
				...(filters?.firstName && {
					firstName: { contains: filters.firstName, mode: "insensitive" },
				}),
				...(filters?.lastName && {
					lastName: { contains: filters.lastName, mode: "insensitive" },
				}),
			};
		}

		// Fetch all students with their related data
		const students = await prisma.student.findMany({
			where: whereClause,
			include: {
				person: {
					include: {
						users: {
							where: {
								isDeleted: false,
							},
							include: {
								anxietyAssessments: {
									where: {
										isDeleted: false,
									},
									orderBy: {
										assessmentDate: "desc",
									},
									take: 1, // Get the latest assessment
								},
								depressionAssessments: {
									where: {
										isDeleted: false,
									},
									orderBy: {
										assessmentDate: "desc",
									},
									take: 1, // Get the latest assessment
								},
								stressAssessments: {
									where: {
										isDeleted: false,
									},
									orderBy: {
										assessmentDate: "desc",
									},
									take: 1, // Get the latest assessment
								},
								suicideAssessments: {
									where: {
										isDeleted: false,
									},
									orderBy: {
										assessmentDate: "desc",
									},
									take: 1, // Get the latest assessment
								},
								personalProblemsChecklist: {
									where: {
										isDeleted: false,
									},
								},
							},
						},
					},
				},
			},
		});

		csvLogger.info(`Found ${students.length} students to export`);

		// Transform data for CSV
		const csvData: StudentExportData[] = [];

		for (const student of students) {
			const person = student.person;
			const user = person.users[0]; // Get the primary user account

			const baseData: StudentExportData = {
				// Student Info
				studentId: student.id,
				studentNumber: student.studentNumber || "",
				program: student.program,
				year: student.year,
				status: student.status,
				// Person Info
				firstName: person.firstName || "",
				lastName: person.lastName || "",
				middleName: person.middleName || "",
				email: person.email || "",
				contactNumber: person.contactNumber || "",
				gender: person.gender || "",
				age: person.age || 0,
				// Default values for assessments
				anxietyScore: 0,
				anxietySeverity: "",
				anxietyDate: "",
				depressionScore: 0,
				depressionSeverity: "",
				depressionDate: "",
				stressScore: 0,
				stressSeverity: "",
				stressDate: "",
				suicideRisk: "",
				suicideDate: "",
				// Personal Checklist Problems
				checklistRisk: "",
				checklistProblems: 0,
				checklistDate: "",
				// Timestamps
				createdAt: student.createdAt.toISOString(),
				updatedAt: student.updatedAt.toISOString(),
			};

			if (user) {
				// Get latest anxiety assessment
				const anxietyAssessment = user.anxietyAssessments[0];
				if (anxietyAssessment) {
					baseData.anxietyScore = anxietyAssessment.totalScore;
					baseData.anxietySeverity = anxietyAssessment.severityLevel;
					baseData.anxietyDate = anxietyAssessment.assessmentDate.toISOString();
				}

				// Get latest depression assessment
				const depressionAssessment = user.depressionAssessments[0];
				if (depressionAssessment) {
					baseData.depressionScore = depressionAssessment.totalScore;
					baseData.depressionSeverity = depressionAssessment.severityLevel;
					baseData.depressionDate = depressionAssessment.assessmentDate.toISOString();
				}

				// Get latest stress assessment
				const stressAssessment = user.stressAssessments[0];
				if (stressAssessment) {
					baseData.stressScore = stressAssessment.totalScore;
					baseData.stressSeverity = stressAssessment.severityLevel;
					baseData.stressDate = stressAssessment.assessmentDate.toISOString();
				}

				// Get latest suicide assessment
				const suicideAssessment = user.suicideAssessments[0];
				if (suicideAssessment) {
					baseData.suicideRisk = suicideAssessment.riskLevel;
					baseData.suicideDate = suicideAssessment.assessmentDate.toISOString();
				}

				// Get personal checklist problems assessment
				if (user.personalProblemsChecklist) {
					baseData.checklistRisk =
						user.personalProblemsChecklist.checklist_analysis?.riskLevel || "";
					baseData.checklistProblems =
						user.personalProblemsChecklist.checklist_analysis?.totalProblemsChecked ||
						0;
					baseData.checklistDate =
						user.personalProblemsChecklist.date_completed.toISOString();
				}
			}

			// Apply post-processing filters
			let includeRecord = true;

			// Filter by severity level (check all assessment types)
			if (filters?.severityLevel) {
				const severityMatches =
					baseData.anxietySeverity === filters.severityLevel ||
					baseData.depressionSeverity === filters.severityLevel ||
					baseData.stressSeverity === filters.severityLevel ||
					baseData.suicideRisk === filters.severityLevel ||
					baseData.checklistRisk === filters.severityLevel;

				if (!severityMatches) {
					includeRecord = false;
				}
			}

			// Filter by assessment type (only include if student has that specific assessment)
			if (filters?.assessmentType && includeRecord) {
				switch (filters.assessmentType) {
					case "anxiety":
						includeRecord = baseData.anxietySeverity !== "";
						break;
					case "depression":
						includeRecord = baseData.depressionSeverity !== "";
						break;
					case "stress":
						includeRecord = baseData.stressSeverity !== "";
						break;
					case "suicide":
						includeRecord = baseData.suicideRisk !== "";
						break;
					case "checklist":
						includeRecord = baseData.checklistRisk !== "";
						break;
				}
			}

			if (includeRecord) {
				csvData.push(baseData);
			}
		}

		// Generate CSV content
		const csvContent = generateCsvContent(csvData, filters?.assessmentType);

		csvLogger.info(
			`CSV export completed successfully. ${students.length} students found, ${csvData.length} records after filtering`,
		);
		return csvContent;
	} catch (error) {
		csvLogger.error(`Error exporting CSV data: ${error}`);
		throw error;
	}
};

const generateCsvContent = (data: StudentExportData[], assessmentType?: string): string => {
	if (data.length === 0) {
		return "No data available";
	}

	// Base headers (always included)
	const baseHeaders = [
		"Program",
		"Year",
		"Status",
		"First Name",
		"Last Name",
		"Middle Name",
		"Email",
		"Contact Number",
		"Gender",
		"Age",
	];

	// Assessment-specific headers
	const assessmentHeaders: Record<string, string[]> = {
		anxiety: ["Anxiety Score", "Anxiety Severity", "Anxiety Assessment Date"],
		depression: ["Depression Score", "Depression Severity", "Depression Assessment Date"],
		stress: ["Stress Score", "Stress Severity", "Stress Assessment Date"],
		suicide: ["Suicide Risk Level", "Suicide Assessment Date"],
		checklist: ["Checklist Risk Level", "Total Problems", "Checklist Assessment Date"],
	};

	// Timestamp headers (always included)
	const timestampHeaders = ["Created At", "Updated At"];

	// Build headers based on assessment type filter
	let headers = [...baseHeaders];

	if (assessmentType && assessmentHeaders[assessmentType]) {
		// Only include the specific assessment headers
		headers = [...headers, ...assessmentHeaders[assessmentType]];
	} else {
		// Include all assessment headers (default behavior)
		headers = [
			...headers,
			...assessmentHeaders.anxiety,
			...assessmentHeaders.depression,
			...assessmentHeaders.stress,
			...assessmentHeaders.suicide,
			...assessmentHeaders.checklist,
		];
	}

	headers = [...headers, ...timestampHeaders];

	// Create CSV rows
	const csvRows = [headers.join(",")];

	for (const row of data) {
		// Base row data (always included)
		const baseRowData = [
			escapeCsvValue(row.program),
			escapeCsvValue(row.year),
			escapeCsvValue(row.status),
			escapeCsvValue(row.firstName),
			escapeCsvValue(row.lastName),
			escapeCsvValue(row.middleName),
			escapeCsvValue(row.email),
			escapeCsvValue(row.contactNumber),
			escapeCsvValue(row.gender),
			row.age.toString(),
		];

		// Assessment-specific row data
		const assessmentRowData: Record<string, string[]> = {
			anxiety: [
				row.anxietyScore.toString(),
				escapeCsvValue(row.anxietySeverity),
				escapeCsvValue(row.anxietyDate),
			],
			depression: [
				row.depressionScore.toString(),
				escapeCsvValue(row.depressionSeverity),
				escapeCsvValue(row.depressionDate),
			],
			stress: [
				row.stressScore.toString(),
				escapeCsvValue(row.stressSeverity),
				escapeCsvValue(row.stressDate),
			],
			suicide: [escapeCsvValue(row.suicideRisk), escapeCsvValue(row.suicideDate)],
			checklist: [
				escapeCsvValue(row.checklistRisk),
				row.checklistProblems.toString(),
				escapeCsvValue(row.checklistDate),
			],
		};

		// Timestamp row data (always included)
		const timestampRowData = [escapeCsvValue(row.createdAt), escapeCsvValue(row.updatedAt)];

		// Build row data based on assessment type filter
		let csvRow = [...baseRowData];

		if (assessmentType && assessmentRowData[assessmentType]) {
			// Only include the specific assessment data
			csvRow = [...csvRow, ...assessmentRowData[assessmentType]];
		} else {
			// Include all assessment data (default behavior)
			csvRow = [
				...csvRow,
				...assessmentRowData.anxiety,
				...assessmentRowData.depression,
				...assessmentRowData.stress,
				...assessmentRowData.suicide,
				...assessmentRowData.checklist,
			];
		}

		csvRow = [...csvRow, ...timestampRowData];

		csvRows.push(csvRow.join(","));
	}

	return csvRows.join("\n");
};

const escapeCsvValue = (value: string | undefined | null): string => {
	if (!value) return "";

	// If the value contains comma, newline, or quotes, wrap it in quotes
	if (value.includes(",") || value.includes("\n") || value.includes('"')) {
		// Escape existing quotes by doubling them
		const escapedValue = value.replace(/"/g, '""');
		return `"${escapedValue}"`;
	}

	return value;
};
