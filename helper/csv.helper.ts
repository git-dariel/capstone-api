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
	// Timestamps
	createdAt: string;
	updatedAt: string;
}

export const exportStudentDataCsv = async (prisma: PrismaClient): Promise<string> => {
	try {
		csvLogger.info("Starting CSV export for student data with mental health assessments");

		// Fetch all students with their related data
		const students = await prisma.student.findMany({
			where: {
				isDeleted: false,
			},
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
			}

			csvData.push(baseData);
		}

		// Generate CSV content
		const csvContent = generateCsvContent(csvData);

		csvLogger.info("CSV export completed successfully");
		return csvContent;
	} catch (error) {
		csvLogger.error(`Error exporting CSV data: ${error}`);
		throw error;
	}
};

const generateCsvContent = (data: StudentExportData[]): string => {
	if (data.length === 0) {
		return "No data available";
	}

	// CSV Headers
	const headers = [
		"Student ID",
		"Student Number",
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
		"Anxiety Score",
		"Anxiety Severity",
		"Anxiety Assessment Date",
		"Depression Score",
		"Depression Severity",
		"Depression Assessment Date",
		"Stress Score",
		"Stress Severity",
		"Stress Assessment Date",
		"Suicide Risk Level",
		"Suicide Assessment Date",
		"Created At",
		"Updated At",
	];

	// Create CSV rows
	const csvRows = [headers.join(",")];

	for (const row of data) {
		const csvRow = [
			escapeCsvValue(row.studentId),
			escapeCsvValue(row.studentNumber),
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
			row.anxietyScore.toString(),
			escapeCsvValue(row.anxietySeverity),
			escapeCsvValue(row.anxietyDate),
			row.depressionScore.toString(),
			escapeCsvValue(row.depressionSeverity),
			escapeCsvValue(row.depressionDate),
			row.stressScore.toString(),
			escapeCsvValue(row.stressSeverity),
			escapeCsvValue(row.stressDate),
			escapeCsvValue(row.suicideRisk),
			escapeCsvValue(row.suicideDate),
			escapeCsvValue(row.createdAt),
			escapeCsvValue(row.updatedAt),
		];

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
