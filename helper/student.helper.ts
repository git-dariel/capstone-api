import { getLogger } from "./logger";
import { getPhilippinesTime } from "./date.helper";

const logger = getLogger();
const studentHelperLogger = logger.child({ module: "student-helper" });

/**
 * Year level mapping
 */
export const YEAR_LEVELS = ["1st", "2nd", "3rd", "4th", "graduated"] as const;
export type YearLevel = (typeof YEAR_LEVELS)[number];

/**
 * Extract enrollment year from student number
 * Student number format: "YYYY-XXXXX-XX-X" or "YYYY-XXXX"
 * Returns the first 4 digits as the enrollment year
 *
 * @param studentNumber - Student number string
 * @returns Enrollment year as number, or null if invalid
 */
export const extractEnrollmentYear = (studentNumber: string | null | undefined): number | null => {
	if (!studentNumber) {
		studentHelperLogger.warn("Student number is empty or null");
		return null;
	}

	// Extract year from student number (format: YYYY-XXXXX-XX-X or YYYY-XXXX)
	const yearMatch = studentNumber.match(/^(\d{4})/);
	if (!yearMatch) {
		studentHelperLogger.warn(`Invalid student number format: ${studentNumber}`);
		return null;
	}

	const year = parseInt(yearMatch[1], 10);
	if (isNaN(year) || year < 1900 || year > 2100) {
		studentHelperLogger.warn(
			`Invalid year extracted from student number: ${studentNumber}, year: ${year}`,
		);
		return null;
	}

	return year;
};

/**
 * Calculate current year level based on enrollment year
 * Assumes students start as 1st year in June of their enrollment year
 * Academic year runs from June to May (e.g., June 2025 - May 2026 = Academic Year 2025-2026)
 * Year level increments each academic year starting in June
 *
 * @param enrollmentYear - Year when student enrolled (extracted from student number)
 * @param currentYear - Current year (defaults to current year in Philippines timezone)
 * @param currentMonth - Current month (0-11, defaults to current month in Philippines timezone)
 * @returns Current year level as string (1st, 2nd, 3rd, 4th, graduated)
 */
export const calculateYearLevel = (
	enrollmentYear: number | null,
	currentYear?: number,
	currentMonth?: number,
): YearLevel => {
	if (!enrollmentYear) {
		studentHelperLogger.warn("Cannot calculate year level: enrollment year is null");
		return "1st"; // Default to 1st year if enrollment year is invalid
	}

	const philippinesTime = getPhilippinesTime();
	const currentYearValue = currentYear ?? philippinesTime.getFullYear();
	const currentMonthValue = currentMonth ?? philippinesTime.getMonth(); // 0-11 (0 = January)

	// Academic year starts in June (month 5, 0-indexed)
	// If we're before June, we're still in the previous academic year
	const academicYearStartMonth = 5; // June

	// Calculate the current academic year
	// If current month is June or later, current academic year = current year
	// If current month is before June, current academic year = previous year
	const currentAcademicYear =
		currentMonthValue >= academicYearStartMonth ? currentYearValue : currentYearValue - 1;

	// Calculate academic years elapsed
	// Student enrolled in enrollmentYear, starts in June of that year
	// Academic year 1: June enrollmentYear - May (enrollmentYear + 1)
	// Academic year 2: June (enrollmentYear + 1) - May (enrollmentYear + 2)
	// So academicYearsElapsed = currentAcademicYear - enrollmentYear
	const academicYearsElapsed = currentAcademicYear - enrollmentYear;

	// Determine year level based on academic years elapsed
	// Academic year 0 (enrollment year, before June): treat as 1st year
	// Academic year 0 (enrollment year, June onwards): 1st year
	// Academic year 1: 2nd year
	// Academic year 2: 3rd year
	// Academic year 3: 4th year
	// Academic year 4+: graduated

	if (academicYearsElapsed < 0) {
		// Student enrolled in the future (shouldn't happen, but handle gracefully)
		studentHelperLogger.warn(
			`Student enrolled in future: enrollmentYear=${enrollmentYear}, currentAcademicYear=${currentAcademicYear}`,
		);
		return "1st";
	}

	if (academicYearsElapsed === 0) {
		return "1st";
	} else if (academicYearsElapsed === 1) {
		return "2nd";
	} else if (academicYearsElapsed === 2) {
		return "3rd";
	} else if (academicYearsElapsed === 3) {
		return "4th";
	} else {
		// 4+ academic years = graduated
		return "graduated";
	}
};

/**
 * Get next year level
 * Used to determine what year level a student should advance to
 *
 * @param currentYearLevel - Current year level
 * @returns Next year level, or null if already graduated
 */
export const getNextYearLevel = (currentYearLevel: string): YearLevel | null => {
	const currentIndex = YEAR_LEVELS.indexOf(currentYearLevel as YearLevel);
	if (currentIndex === -1) {
		studentHelperLogger.warn(`Invalid current year level: ${currentYearLevel}`);
		return "1st"; // Default to 1st if invalid
	}

	if (currentIndex >= YEAR_LEVELS.length - 1) {
		// Already at the last level (graduated)
		return null;
	}

	return YEAR_LEVELS[currentIndex + 1];
};

/**
 * Calculate year level from student number
 * Convenience function that combines extraction and calculation
 *
 * @param studentNumber - Student number string
 * @returns Current year level as string
 */
export const calculateYearLevelFromStudentNumber = (
	studentNumber: string | null | undefined,
): YearLevel => {
	const enrollmentYear = extractEnrollmentYear(studentNumber);
	return calculateYearLevel(enrollmentYear);
};
