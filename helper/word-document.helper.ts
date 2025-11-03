import * as fs from "fs";
import * as path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { getLogger } from "./logger";

const logger = getLogger();
const docLogger = logger.child({ module: "document" });

interface DocumentData {
	[key: string]: any;
}

interface AssessmentHistoryItem {
	assessment_name: string;
	score: string;
	severity_level: string;
	date: string;
}

interface ConsultationItem {
	note_title: string;
	note_description: string;
	note_date: string;
}

interface MentalHealthAssessmentData {
	// Student Details
	student_number: string;
	program: string;
	year_level: string;
	date_created: string;
	last_updated: string;

	// Person Details
	first_name: string;
	last_name: string;
	middle_name: string;
	gender: string;
	birth_date: string;
	age: string;
	civil_status: string;

	// User Details
	email: string;
	contact_number: string;

	// Inventory Details - Physical Information
	height: string;
	weight: string;
	complexion: string;

	// Emergency Contact
	name: string;
	relationship: string;
	address: string;

	// Educational Background
	education_level: string;
	status: string;
	graduation: string;
	honors: string;

	// Nature of Schooling
	continuous: string;
	interrupted: string;

	// Home and Family Background
	marital_relationship: string;
	ordinal_position: string;
	children_in_family: string;
	brothers: string;
	sisters: string;
	employed_siblings: string;
	finances_schooling: string;
	weekly_allowance: string;
	quiet_place_to_study: string;
	residence_type: string;
	room_sharing: string;

	// Health Information
	vision: string;
	hearing: string;
	speech: string;
	general_health: string;
	specifications: string;
	consulted: string;
	status_consulted: string;

	// Interest and Hobbies
	academic_club: string;
	organization: string;
	position: string;
	favorite_subject: string;
	least_favorite: string;
	hobbies: string;

	// Mental Health Prediction
	risk_level: string;
	urgency: string;
	description: string;
	assessment_summary: string;
	confidence: string;
	decision_tree: string;
	random_forest: string;
	risk_factors: string;
	recommendations: string;
	prediction_date: string;

	// Assessment History - Array for table loops
	assessments: AssessmentHistoryItem[];
	// Legacy single assessment for backward compatibility
	assessment_name: string;
	score: string;
	severity_level: string;
	date: string;
	assessment_history: string; // Comprehensive history as text

	// Consultation Details - Array for table loops
	consultations: ConsultationItem[];
	// Legacy single consultation for backward compatibility
	note_name: string;
	description_consultation: string;

	// Consent Details - Basic Information
	referred_by: string;
	living_with: string;
	financial_status: string;
	physical_problem: string;
	physical_symptoms: string;

	// Present Concerns - Individual concern fields
	personal_growth: string;
	depression_concern: string;
	suicidal_thoughts: string;
	study_skills: string;
	family_concerns: string;
	sexual_concerns: string;
	educational_concerns: string;
	anxiety_concern: string;
	drug_use: string;
	physical_concerns: string;
	self_concept: string;
	decision_making_about_leaving_pup: string;
	financial_concerns: string;
	relationship_with_others: string;
	spirituality: string;
	weight_eating_issues: string;
	career: string;
}

/**
 * Template Usage Instructions for Dynamic Tables:
 *
 * For Assessment History Table:
 * In your Word template, create a table with the following structure:
 *
 * | Assessment Name | Score | Severity Level | Date |
 * |-----------------|-------|----------------|------|
 * | {#assessments}{assessment_name} | {score} | {severity_level} | {date}{/assessments} |
 *
 * For Consultation Details Table:
 * In your Word template, create a table with the following structure:
 *
 * | Note Title | Description | Date |
 * |------------|-------------|------|
 * | {#consultations}{note_title} | {note_description} | {note_date}{/consultations} |
 *
 * IMPORTANT: The {#arrayName} and {/arrayName} tags must be in the SAME ROW as the data fields.
 * Put the opening tag in the same cell as the first field, and the closing tag in the same cell as the last field.
 * Do NOT put the loop tags in separate rows - this creates blank rows in the output!
 * Each assessment/consultation will create a new row in the table.
 * If no data is available, the table will show empty or can be conditionally hidden.
 */ export const generateDocxFromTemplate = async (
	templatePath: string,
	data: DocumentData,
	outputFileName: string,
): Promise<Buffer> => {
	try {
		docLogger.info(`Generating document from template: ${templatePath}`);

		// Read the template file
		const templateBuffer = fs.readFileSync(templatePath);

		// Create a PizZip instance with the template
		const zip = new PizZip(templateBuffer);

		// Create docxtemplater instance
		const doc = new Docxtemplater(zip, {
			paragraphLoop: true,
			linebreaks: true,
		});

		// Set the template data
		doc.setData(data);

		try {
			// Render the document
			doc.render();
		} catch (error: any) {
			docLogger.error(`Error rendering template: ${error.message}`);
			throw new Error(`Template rendering failed: ${error.message}`);
		}

		// Generate the document buffer
		const documentBuffer = doc.getZip().generate({
			type: "nodebuffer",
			compression: "DEFLATE",
		});

		docLogger.info(`Document generated successfully: ${outputFileName}`);
		return documentBuffer;
	} catch (error: any) {
		docLogger.error(`Error generating document: ${error.message}`);
		throw new Error(`Document generation failed: ${error.message}`);
	}
};

export const getTemplateFilePath = (templateName: string): string => {
	const templatePath = path.join(__dirname, "..", "config", "data", templateName);

	if (!fs.existsSync(templatePath)) {
		throw new Error(`Template file not found: ${templatePath}`);
	}

	return templatePath;
};

export const fetchMentalHealthAssessmentData = async (
	prisma: any,
	studentId: string,
): Promise<any> => {
	try {
		docLogger.info(`Fetching mental health assessment data for student: ${studentId}`);

		// Fetch comprehensive student data with all related information
		const studentData = await prisma.student.findFirst({
			where: {
				id: studentId,
				isDeleted: false,
			},
			include: {
				person: {
					include: {
						users: {
							where: {
								type: "student",
								isDeleted: false,
							},
							include: {
								anxietyAssessments: {
									where: { isDeleted: false },
									orderBy: { assessmentDate: "desc" },
								},
								depressionAssessments: {
									where: { isDeleted: false },
									orderBy: { assessmentDate: "desc" },
								},
								stressAssessments: {
									where: { isDeleted: false },
									orderBy: { assessmentDate: "desc" },
								},
								suicideAssessments: {
									where: { isDeleted: false },
									orderBy: { assessmentDate: "desc" },
								},
								personalProblemsChecklist: true,
							},
						},
					},
				},
				individualInventory: true,
				consent: true,
			},
		});

		if (!studentData) {
			throw new Error(`Student not found with ID: ${studentId}`);
		}

		return studentData;
	} catch (error: any) {
		docLogger.error(`Error fetching student data: ${error.message}`);
		throw new Error(`Failed to fetch student data: ${error.message}`);
	}
};

export const formatMentalHealthAssessmentData = (studentData: any): MentalHealthAssessmentData => {
	const { person, individualInventory, consent } = studentData;
	const user = person?.users?.[0] || {};
	const inventory = individualInventory || {};
	const consentData = consent || {};

	// Debug logging
	docLogger.info(`Formatting data for student: ${studentData?.studentNumber || "Unknown"}`);
	docLogger.info(`Available inventory sections: ${Object.keys(inventory).join(", ")}`);
	docLogger.info(`Available consent sections: ${Object.keys(consentData).join(", ")}`);
	docLogger.info(
		`Available user assessments: ${Object.keys(user)
			.filter((key) => key.includes("Assessment") || key.includes("Checklist"))
			.join(", ")}`,
	);
	docLogger.info(`Student notes count: ${studentData.notes?.length || 0}`);
	docLogger.info(`Personal problems checklist available: ${!!user.personalProblemsChecklist}`);

	// Enhanced debugging for Home and Family Background
	const familyBgDebug = inventory.home_and_family_background || {};
	docLogger.info(`Home and Family Background keys: ${Object.keys(familyBgDebug).join(", ")}`);
	docLogger.info(
		`Parents marital relationship: ${familyBgDebug.parents_martial_relationship || "Not found"}`,
	);
	docLogger.info(
		`Number of children: ${familyBgDebug.number_of_children_in_the_family_including_yourself || "Not found"}`,
	);
	docLogger.info(`Ordinal position: ${familyBgDebug.ordinal_position || "Not found"}`);

	// Enhanced debugging for Interest and Hobbies
	const interestsDebug = inventory.interest_and_hobbies || {};
	docLogger.info(`Interest and Hobbies keys: ${Object.keys(interestsDebug).join(", ")}`);
	docLogger.info(`Academic: ${interestsDebug.academic || "Not found"}`);
	docLogger.info(
		`Organizations participated: ${interestsDebug.organizations_participated || "Not found"}`,
	);
	docLogger.info(
		`Position in organization: ${interestsDebug.occupational_position_organization || "Not found"}`,
	);
	docLogger.info(`Favorite subject: ${interestsDebug.favorite_subject || "Not found"}`);
	docLogger.info(
		`Least favorite subject: ${interestsDebug.favorite_least_subject || "Not found"}`,
	);
	docLogger.info(
		`Hobbies: ${JSON.stringify(interestsDebug.what_are_your_hobbies) || "Not found"}`,
	);

	// Enhanced debugging for Mental Health Prediction
	const predictionDebug = inventory.mentalHealthPrediction || {};
	docLogger.info(`Mental Health Prediction keys: ${Object.keys(predictionDebug).join(", ")}`);
	docLogger.info(`Confidence: ${predictionDebug.confidence || "Not found"}`);
	docLogger.info(
		`Model Accuracy keys: ${Object.keys(predictionDebug.modelAccuracy || {}).join(", ")}`,
	);
	docLogger.info(`Decision Tree: ${predictionDebug.modelAccuracy?.decisionTree || "Not found"}`);
	docLogger.info(`Random Forest: ${predictionDebug.modelAccuracy?.randomForest || "Not found"}`);
	docLogger.info(
		`Mental Health Risk keys: ${Object.keys(predictionDebug.mentalHealthRisk || {}).join(", ")}`,
	);
	docLogger.info(
		`Assessment Summary: ${predictionDebug.mentalHealthRisk?.assessmentSummary || "Not found"}`,
	);
	docLogger.info(`Risk Factors: ${JSON.stringify(predictionDebug.riskFactors) || "Not found"}`);
	docLogger.info(
		`Recommendations: ${JSON.stringify(predictionDebug.recommendations) || "Not found"}`,
	);

	// Format date helper
	const formatDate = (date: Date | string | null | undefined): string => {
		if (!date) return "";
		const dateObj = typeof date === "string" ? new Date(date) : date;
		return dateObj.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	// Helper to get latest assessment
	const getLatestAssessment = (assessments: any[]): any => {
		return assessments && assessments.length > 0 ? assessments[0] : null;
	};

	// Helper to get all assessments formatted
	const getAllAssessments = (assessments: any[], assessmentName: string): any[] => {
		return (assessments || []).map((assessment) => ({
			name: assessmentName,
			...assessment,
		}));
	};

	// Helper to get single assessment (for fields that return single objects)
	const getSingleAssessment = (assessment: any): any => {
		return assessment || null;
	};

	// Get latest assessments for primary assessment
	const latestAnxiety = getLatestAssessment(user.anxietyAssessments);
	const latestDepression = getLatestAssessment(user.depressionAssessments);
	const latestStress = getLatestAssessment(user.stressAssessments);
	const latestSuicide = getLatestAssessment(user.suicideAssessments);
	const latestChecklist = getSingleAssessment(user.personalProblemsChecklist);

	// Get all assessments for comprehensive history
	const allAnxietyAssessments = getAllAssessments(
		user.anxietyAssessments || [],
		"Anxiety (GAD-7)",
	);
	const allDepressionAssessments = getAllAssessments(
		user.depressionAssessments || [],
		"Depression (PHQ-9)",
	);
	const allStressAssessments = getAllAssessments(user.stressAssessments || [], "Stress (PSS-10)");
	const allSuicideAssessments = getAllAssessments(
		user.suicideAssessments || [],
		"Suicide Risk (C-SSRS)",
	);
	// For checklist, it's a single object, not an array
	const allChecklistAssessments = latestChecklist
		? [
				{
					name: "Personal Problems Checklist",
					...latestChecklist,
					assessmentDate: latestChecklist.date_completed,
					severityLevel: latestChecklist.checklist_analysis?.riskLevel,
					totalScore: latestChecklist.checklist_analysis?.totalProblemsChecked,
				},
			]
		: [];

	// Collect all assessments for comprehensive history
	const allAssessments = [
		...allAnxietyAssessments,
		...allDepressionAssessments,
		...allStressAssessments,
		...allSuicideAssessments,
		...allChecklistAssessments,
	];

	// Format assessment history array for table loops
	const formattedAssessments: AssessmentHistoryItem[] = allAssessments
		.filter((assessment) => assessment.assessmentDate) // Only include assessments with valid dates
		.sort((a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime())
		.map((assessment) => ({
			assessment_name: assessment.name || "",
			score: String(
				assessment.totalScore || assessment.score || assessment.riskLevel || "N/A",
			),
			severity_level: assessment.severityLevel || assessment.riskLevel || "N/A",
			date: formatDate(assessment.assessmentDate),
		}));

	// Format consultation notes array for table loops
	const formattedConsultations: ConsultationItem[] = (studentData.notes || []).map(
		(note: any) => ({
			note_title: note.title || "Clinical Note",
			note_description: note.content || "",
			note_date: formatDate(note.createdAt || studentData.createdAt || new Date()),
		}),
	);

	// Debug logging for arrays
	docLogger.info(`Formatted assessments count: ${formattedAssessments.length}`);
	docLogger.info(`Assessment details: ${JSON.stringify(formattedAssessments.slice(0, 3))}`);
	docLogger.info(`Formatted consultations count: ${formattedConsultations.length}`);
	docLogger.info(`Consultation details: ${JSON.stringify(formattedConsultations.slice(0, 3))}`);
	docLogger.info(`Student notes raw count: ${studentData.notes?.length || 0}`);
	if (studentData.notes && studentData.notes.length > 0) {
		docLogger.info(
			`First note structure: ${JSON.stringify(Object.keys(studentData.notes[0]))}`,
		);
		docLogger.info(`First note full data: ${JSON.stringify(studentData.notes[0])}`);
		docLogger.info(`First note createdAt: ${studentData.notes[0].createdAt}`);
		docLogger.info(`First note createdAt type: ${typeof studentData.notes[0].createdAt}`);
	}

	// Format emergency contact
	const emergencyContact = inventory.person_to_be_contacted_in_case_of_accident_or_illness || {};
	const emergencyAddress = emergencyContact.address || {};
	const formattedEmergencyAddress = [
		emergencyAddress.street,
		emergencyAddress.barangay,
		emergencyAddress.city,
		emergencyAddress.province,
		emergencyAddress.country,
	]
		.filter(Boolean)
		.join(", ");

	// Format educational background
	const educationalBg = inventory.educational_background || {};
	const schoolAddress = educationalBg.school_address || {};

	// Format home and family background
	const familyBg = inventory.home_and_family_background || {};

	// Format health information
	const health = inventory.health || {};
	const physical = health.physical || {};
	const psychological = health.psychological || {};

	// Format interest and hobbies
	const interests = inventory.interest_and_hobbies || {};

	// Get mental health prediction data from inventory
	const prediction = inventory.mentalHealthPrediction || {};

	// Determine the most recent/severe assessment for the summary
	let primaryAssessment = null;
	let assessmentHistory = "";

	// Use the sorted assessments from the formatted array
	const sortedAssessments = formattedAssessments;

	// Find the most recent assessment
	if (sortedAssessments.length > 0) {
		// Convert back to the expected format for primaryAssessment
		const mostRecentFormatted = sortedAssessments[0];
		primaryAssessment = {
			name: mostRecentFormatted.assessment_name,
			totalScore: mostRecentFormatted.score,
			severityLevel: mostRecentFormatted.severity_level,
			assessmentDate: mostRecentFormatted.date,
		};

		// Format assessment history - include ALL assessments as a text summary
		assessmentHistory = sortedAssessments
			.map((assessment) => {
				return `${assessment.assessment_name}: ${assessment.score} (${assessment.severity_level}) - ${assessment.date}`;
			})
			.join("; ");
	}

	// Format consultation notes - get all consultation notes from Student.notes
	let consultationNotes = "";
	if (studentData.notes && Array.isArray(studentData.notes)) {
		consultationNotes = studentData.notes
			.map((note: any) => {
				const title = note.title || "Clinical Note";
				const content = note.content || "";
				const date = formatDate(note.createdAt);
				return `${title} (${date}): ${content}`;
			})
			.join("; ");
	}

	// Format concerns from consent
	const concerns = consentData.concerns || {};
	const formatConcern = (value: any): string => {
		if (!value) return "Not answered";

		// Convert enum values to human-readable format
		const concernMap: { [key: string]: string } = {
			not_applicable: "Not Applicable",
			leat_important: "Least Important", // Note: typo in enum, but keeping as is
			somewhat_important: "Somewhat Important",
			important: "Important",
			very_important: "Very Important",
			most_important: "Most Important",
		};

		// If it's an enum value, return the mapped version
		if (typeof value === "string" && concernMap[value]) {
			return concernMap[value];
		}

		// Otherwise return as is
		if (typeof value === "string") return value;
		if (typeof value === "boolean") return value ? "Yes" : "No";
		return String(value);
	};

	// Debug logging for concerns
	docLogger.info(`Concerns data structure: ${JSON.stringify(concerns)}`);
	docLogger.info(`Available concern keys: ${Object.keys(concerns).join(", ")}`);
	docLogger.info(`Personal Growth: ${concerns.personal_growth || "Not found"}`);
	docLogger.info(`Depression: ${concerns.depression || "Not found"}`);
	docLogger.info(`Anxiety: ${concerns.anxiety || "Not found"}`);
	docLogger.info(`Study Skills: ${concerns.study_skills || "Not found"}`);
	docLogger.info(`Family Concerns: ${concerns.family_concerns || "Not found"}`);
	docLogger.info(`Suicidal Thoughts: ${concerns.suicidal_thoughts || "Not found"}`);
	docLogger.info(`Self Concept: ${concerns.self_concept || "Not found"}`);
	docLogger.info(`Career: ${concerns.career || "Not found"}`);
	docLogger.info(`Financial Concerns: ${concerns.financial_concerns || "Not found"}`);
	docLogger.info(`Relationship with Others: ${concerns.relationship_with_others || "Not found"}`);
	docLogger.info(`Spirituality: ${concerns.spirituality || "Not found"}`);
	docLogger.info(`Weight Eating Issues: ${concerns.weight_eating_issues || "Not found"}`);
	docLogger.info(`Educational Concerns: ${concerns.educational_concerns || "Not found"}`);
	docLogger.info(`Sexual Concerns: ${concerns.sexual_concerns || "Not found"}`);
	docLogger.info(`Drug Use: ${concerns.drug_use || "Not found"}`);
	docLogger.info(`Physical Concerns: ${concerns.physical_concerns || "Not found"}`);
	docLogger.info(
		`Decision Making About Leaving PUP: ${concerns.decision_making_about_leaving_pup || "Not found"}`,
	);

	return {
		// Student Details
		student_number: studentData.studentNumber || "",
		program: studentData.program || "",
		year_level: studentData.year || "",
		date_created: formatDate(studentData.createdAt),
		last_updated: formatDate(studentData.updatedAt),

		// Person Details
		first_name: person?.firstName || "",
		last_name: person?.lastName || "",
		middle_name: person?.middleName || "",
		gender: person?.gender || "",
		birth_date: formatDate(person?.birthDate),
		age: String(person?.age || ""),
		civil_status: person?.civilStatus || "",

		// User Details
		email: person?.email || "",
		contact_number: person?.contactNumber || "",

		// Inventory Details - Physical Information
		height: inventory.height || "",
		weight: inventory.weight || "",
		complexion: inventory.complexion || inventory.coplexion || "",

		// Emergency Contact
		name: `${emergencyContact.firstName || ""} ${emergencyContact.lastName || ""}`.trim(),
		relationship: emergencyContact.relationship || "",
		address: formattedEmergencyAddress,

		// Educational Background
		education_level: educationalBg.level || "",
		status: educationalBg.status || "",
		graduation: educationalBg.school_graduation || "",
		honors: educationalBg.honors_received || "",

		// Nature of Schooling
		continuous: String(inventory.nature_of_schooling?.continuous || false),
		interrupted: String(inventory.nature_of_schooling?.interrupted || false),

		// Home and Family Background
		marital_relationship: familyBg.parents_martial_relationship || "",
		ordinal_position: familyBg.ordinal_position || "",
		children_in_family: String(
			familyBg.number_of_children_in_the_family_including_yourself || "",
		),
		brothers: String(familyBg.number_of_brothers || ""),
		sisters: String(familyBg.number_of_sisters || ""),
		employed_siblings: String(familyBg.number_of_brothers_or_sisters_employed || ""),
		finances_schooling: familyBg.who_finances_your_schooling || "",
		weekly_allowance: String(familyBg.how_much_is_your_weekly_allowance || ""),
		quiet_place_to_study: String(familyBg.do_you_have_quiet_place_to_study || ""),
		residence_type: familyBg.nature_of_residence_while_attending_school || "",
		room_sharing: familyBg.do_you_share_your_room_with_anyone?.status || "",

		// Health Information
		vision: String(physical.your_vision || ""),
		hearing: String(physical.your_hearing || ""),
		speech: String(physical.your_speech || ""),
		general_health: String(physical.your_general_health || ""),
		specifications: physical.if_yes_please_specify || "",
		consulted: String(psychological.consulted || ""),
		status_consulted: psychological.status || "",

		// Interest and Hobbies
		academic_club: interests.academic || "",
		organization: interests.organizations_participated || "",
		position: interests.occupational_position_organization || "",
		favorite_subject: interests.favorite_subject || "",
		least_favorite: interests.favorite_least_subject || "",
		hobbies: Array.isArray(interests.what_are_your_hobbies)
			? interests.what_are_your_hobbies.join(", ")
			: String(interests.what_are_your_hobbies || ""),

		// Mental Health Prediction
		risk_level: prediction.mentalHealthRisk?.level || "",
		urgency: prediction.mentalHealthRisk?.urgency || "",
		description: prediction.mentalHealthRisk?.description || "",
		assessment_summary: prediction.mentalHealthRisk?.assessmentSummary || "",
		confidence: prediction.confidence ? Math.round(prediction.confidence * 100).toString() : "",
		decision_tree: prediction.modelAccuracy?.decisionTree
			? Math.round(prediction.modelAccuracy.decisionTree * 100).toString()
			: "",
		random_forest: prediction.modelAccuracy?.randomForest
			? Math.round(prediction.modelAccuracy.randomForest * 100).toString()
			: "",
		risk_factors: Array.isArray(prediction.riskFactors)
			? prediction.riskFactors.join(", ")
			: String(prediction.riskFactors || ""),
		recommendations: Array.isArray(prediction.recommendations)
			? prediction.recommendations.join(", ")
			: String(prediction.recommendations || ""),
		prediction_date: formatDate(prediction.predictionDate),

		// Assessment History - Array for table loops
		assessments: formattedAssessments,
		// Legacy single assessment for backward compatibility
		assessment_name: primaryAssessment?.name || "",
		score: primaryAssessment?.totalScore || "",
		severity_level: primaryAssessment?.severityLevel || "",
		date: primaryAssessment?.assessmentDate || "",

		// Comprehensive Assessment History - All assessments
		assessment_history: assessmentHistory,

		// Consultation Details - Array for table loops
		consultations: formattedConsultations,
		// Legacy single consultation for backward compatibility
		note_name: consultationNotes ? "Clinical Notes" : "",
		description_consultation: consultationNotes,

		// Consent Details - Basic Information
		referred_by: consentData.referred || "",
		living_with: consentData.with_whom_do_you_live || "",
		financial_status: consentData.financial_status || "",
		physical_problem: consentData.physical_problem || "",
		physical_symptoms: Array.isArray(consentData.physical_symptoms)
			? consentData.physical_symptoms.join(", ")
			: String(consentData.physical_symptoms || ""),

		// Present Concerns - Individual concern fields
		personal_growth: formatConcern(concerns.personal_growth || ""),
		depression_concern: formatConcern(concerns.depression || ""),
		suicidal_thoughts: formatConcern(concerns.suicidal_thoughts || ""),
		study_skills: formatConcern(concerns.study_skills || ""),
		family_concerns: formatConcern(concerns.family_concerns || ""),
		sexual_concerns: formatConcern(concerns.sexual_concerns || ""),
		educational_concerns: formatConcern(concerns.educational_concerns || ""),
		anxiety_concern: formatConcern(concerns.anxiety || ""),
		drug_use: formatConcern(concerns.drug_use || ""),
		physical_concerns: formatConcern(concerns.physical_concerns || ""),
		self_concept: formatConcern(concerns.self_concept || ""),
		decision_making_about_leaving_pup: formatConcern(
			concerns.decision_making_about_leaving_pup || "",
		),
		financial_concerns: formatConcern(concerns.financial_concerns || ""),
		relationship_with_others: formatConcern(concerns.relationship_with_others || ""),
		spirituality: formatConcern(concerns.spirituality || ""),
		weight_eating_issues: formatConcern(concerns.weight_eating_issues || ""),
		career: formatConcern(concerns.career || ""),
	};
};

export const generateMentalHealthAssessmentReport = async (
	prisma: any,
	studentId: string,
	requestingUserId: string,
): Promise<{ buffer: Buffer; fileName: string }> => {
	try {
		docLogger.info(
			`Generating mental health assessment report for student: ${studentId}, requested by: ${requestingUserId}`,
		);

		// Fetch student data
		const studentData = await fetchMentalHealthAssessmentData(prisma, studentId);

		// Format data for template
		const formattedData = formatMentalHealthAssessmentData(studentData);

		// Get template file path
		const templatePath = getTemplateFilePath("Template.docx");

		// Generate filename with student name and date
		const studentName = `${formattedData.first_name}_${formattedData.last_name}`.replace(
			/\s+/g,
			"_",
		);
		const currentDate = new Date().toISOString().split("T")[0];
		const fileName = `Mental_Health_Assessment_${studentName}_${currentDate}.docx`;

		// Generate document
		const documentBuffer = await generateDocxFromTemplate(
			templatePath,
			formattedData,
			fileName,
		);

		docLogger.info(
			`Mental health assessment report generated successfully for student: ${studentId}`,
		);

		return {
			buffer: documentBuffer,
			fileName: fileName,
		};
	} catch (error: any) {
		docLogger.error(`Error generating mental health assessment report: ${error.message}`);
		throw new Error(`Failed to generate mental health assessment report: ${error.message}`);
	}
};
