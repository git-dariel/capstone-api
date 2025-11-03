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

export const generateDocxFromTemplate = async (
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
	const templatePath = path.join(__dirname, "..", "config", "files", templateName);

	if (!fs.existsSync(templatePath)) {
		throw new Error(`Template file not found: ${templatePath}`);
	}

	return templatePath;
};

export const formatDocumentData = (pkrfData: any): DocumentData => {
	const { person } = pkrfData;

	// Format address
	let formattedAddress = "";
	if (person?.address && person.address.length > 0) {
		const addr = person.address[0]; // Get the first address
		const addressParts = [
			addr.unit,
			addr.buildingName,
			addr.houseNo,
			addr.street,
			addr.barangay,
			addr.city,
			addr.province,
		].filter(Boolean);
		formattedAddress = addressParts.join(", ");
	}

	// Format full name
	const fullName = [person?.firstName, person?.middleName, person?.lastName]
		.filter(Boolean)
		.join(" ");

	// Format date
	const formatDate = (date: Date | string | null | undefined): string => {
		if (!date) return "";
		const dateObj = typeof date === "string" ? new Date(date) : date;
		return dateObj.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	return {
		clientType: pkrfData.clientType || "",
		date: formatDate(pkrfData.date),
		pin: person?.philHealthIdNumber || "",
		fName1: person?.firstName || "",
		mName1: person?.middleName || "",
		lName1: person?.lastName || "",
		"person.fullName": fullName,
		brgy1: person?.address?.[0]?.barangay || "",
		city1: person?.address?.[0]?.city || "",
		province1: person?.address?.[0]?.province || "",
		"person.address.full": formattedAddress,
		birth1: formatDate(person?.birthDate),
		contact: person?.mobileNumber || "",
		kpp1: pkrfData.kpp || "",
		fName2: "",
		mName2: "",
		lName2: "",

		brgy2: "",
		city2: "",
		province2: "",

		kpp2: "",
	};
};

export const formatFPEDocumentData = (fpeData: any): DocumentData => {
	const { person, reviews, history, physicalExam, pediatricData } = fpeData;

	// Format address
	let formattedAddress = "";
	if (person?.address && person.address.length > 0) {
		const addr = person.address[0];
		const addressParts = [
			addr.unit,
			addr.buildingName,
			addr.houseNo,
			addr.street,
			addr.barangay,
			addr.city,
			addr.province,
		].filter(Boolean);
		formattedAddress = addressParts.join(", ");
	}

	// Format full name
	const fullName = [person?.firstName, person?.middleName, person?.lastName]
		.filter(Boolean)
		.join(" ");

	// Format date
	const formatDate = (date: Date | string | null | undefined): string => {
		if (!date) return "";
		const dateObj = typeof date === "string" ? new Date(date) : date;
		return dateObj.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	// Format medical conditions
	const formatMedicalCondition = (condition: any) => {
		if (!condition) return "";
		return condition.isDiagnosed
			? `${condition.type || "Yes"} - ${condition.details || ""}`
			: "No";
	};

	// Format explain type
	const formatExplain = (explain: any) => {
		if (!explain) return "";
		return explain.hasIssues ? explain.explain || "Yes" : "No";
	};

	return {
		// Basic info
		screeningDate: formatDate(fpeData.screeningDate),
		a1: fpeData.visitType === "walk_in_clients" ? "☑" : "□",
		b1: fpeData.visitType === "with_appointment" ? "☑" : "□",
		caseNumber: fpeData.caseNumber || "",
		"person.philHealthIdNumber": person?.philHealthIdNumber || "",

		// Person details
		"person.lastName": person?.lastName || "",
		"person.firstName": person?.firstName || "",
		"person.middleName": person?.middleName || "",
		"person.fullName": fullName,
		"person.address.barangay": person?.address?.[0]?.barangay || "",
		"person.address.city": person?.address?.[0]?.city || "",
		"person.address.province": person?.address?.[0]?.province || "",
		"person.address.full": formattedAddress,
		"person.birthDate": formatDate(person?.birthDate),
		"person.age": person?.age || "",
		"person.gender": person?.gender || "",
		"person.mobileNumber": person?.mobileNumber || "",

		// Review of Systems

		"reviews.chiefComplaint": reviews?.chiefComplaint || "",
		reviewA1: reviews?.mental?.hasIssues ? "●" : "◯",
		reviewA2: reviews?.mental?.hasIssues ? "◯" : "●",
		"reviews.mental.explain": formatExplain(reviews?.mental),
		reviewB1: reviews?.respiratory?.hasIssues ? "●" : "◯",
		reviewB2: reviews?.respiratory?.hasIssues ? "◯" : "●",
		"reviews.respiratory.explain": formatExplain(reviews?.respiratory),
		reviewC1: reviews?.gi?.hasIssues ? "●" : "◯",
		reviewC2: reviews?.gi?.hasIssues ? "◯" : "●",
		"reviews.gi.explain": formatExplain(reviews?.gi),
		"reviews.urinary.hasIssues": reviews?.urinary?.hasIssues ? "true" : "false",
		reviewD1: reviews?.urinary?.hasIssues ? "●" : "◯",
		reviewD2: reviews?.urinary?.hasIssues ? "◯" : "●",
		"reviews.urinary.explain": formatExplain(reviews?.urinary),
		"reviews.genital.hasIssues": reviews?.genital?.hasIssues ? "true" : "false",
		reviewE1: reviews?.genital?.hasIssues ? "●" : "◯",
		reviewE2: reviews?.genital?.hasIssues ? "◯" : "●",
		"reviews.genital.explain": formatExplain(reviews?.genital),
		"reviews.musculoskeletal.hasIssues": reviews?.musculoskeletal?.hasIssues ? "true" : "false",
		reviewF1: reviews?.musculoskeletal?.hasIssues ? "●" : "◯",
		reviewF2: reviews?.musculoskeletal?.hasIssues ? "◯" : "●",
		"reviews.musculoskeletal.explain": formatExplain(reviews?.musculoskeletal),
		lastMenstrualPeriod: formatDate(reviews?.lastMenstrualPeriod),
		firstMenstrualPeriod: formatDate(reviews?.firstMenstrualPeriod),
		NumOfPregnancy: reviews?.pregnancyCount || "",

		// Social History
		a2: history?.social?.smoker ? "●" : "◯",
		b2: history?.social?.smoker ? "◯" : "●",
		"history.social.smokingYears": history?.social?.smokingYears || "",
		a3: history?.social?.alcohol ? "●" : "◯",
		b3: history?.social?.alcohol ? "◯" : "●",
		"history.social.alcoholYears": history?.social?.alcoholYears || "",
		// Medical History
		mh1: history?.medical?.conditions?.cancer?.hasIssues ? "☑" : "□",
		mh2: history?.medical?.conditions?.allergies?.hasIssues ? "☑" : "□",
		mh3: history?.medical?.conditions?.diabetesMellitus?.hasIssues ? "☑" : "□",
		mh4: history?.medical?.conditions?.hypertension?.hasIssues ? "☑" : "□",
		mh5: history?.medical?.conditions?.heartDisease?.hasIssues ? "☑" : "□",
		mh6: history?.medical?.conditions?.stroke?.hasIssues ? "☑" : "□",
		mh7: history?.medical?.conditions?.bronchialAsthma?.hasIssues ? "☑" : "□",
		mh8: history?.medical?.conditions?.copd?.hasIssues ? "☑" : "□",
		mh9: history?.medical?.conditions?.tuberculosis?.hasIssues ? "☑" : "□",
		mh10: history?.medical?.conditions?.others?.hasIssues ? "☑" : "□",
		mhSpecify: history?.medical?.conditions?.others?.details || "",
		mh11: "□",

		// Physical Examination
		bp1: physicalExam?.bloodPressure?.systolic || "",
		bp2: physicalExam?.bloodPressure?.diastolic || "",
		heartRate: physicalExam?.heartRate?.value || "",
		respiRate: physicalExam?.respiratoryRate?.value || "",
		visual1: physicalExam?.visualAcuity.split("/")[0] || "",
		visual2: physicalExam?.visualAcuity.split("/")[1] || "",
		height1: physicalExam?.height?.centimeter || "",
		height2: physicalExam?.height?.inches || "",
		weight1: physicalExam?.weight?.kilograms || "",
		weight2: physicalExam?.weight?.pounds || "",
		bmi: physicalExam?.bmi || "",
		temperature: physicalExam?.temperature?.value || "",
		bt1: physicalExam?.bloodType === "a_positive" ? "●" : "◯",
		bt2: physicalExam?.bloodType === "a_negative" ? "●" : "◯",
		bt3: physicalExam?.bloodType === "b_positive" ? "●" : "◯",
		bt4: physicalExam?.bloodType === "b_negative" ? "●" : "◯",
		bt5: physicalExam?.bloodType === "ab_positive" ? "●" : "◯",
		bt6: physicalExam?.bloodType === "ab_negative" ? "●" : "◯",
		bt7: physicalExam?.bloodType === "o_positive" ? "●" : "◯",
		bt8: physicalExam?.bloodType === "o_negative" ? "●" : "◯",
		// Pediatric Data
		"pediatricData.length": pediatricData?.length || "",
		"pediatricData.headCircumference": pediatricData?.headCircumference || "",
		"pediatricData.skinfoldThickness": pediatricData?.skinfoldThickness || "",
		"pediatricData.waist": pediatricData?.waist || "",
		"pediatricData.hip": pediatricData?.hip || "",
		"pediatricData.limbs": pediatricData?.limbs || "",
		"pediatricData.muac": pediatricData?.muac || "",
	};
};
