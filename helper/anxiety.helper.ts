import { AnxietyLevel, SeverityLevel } from "../generated/prisma";

// Philippines timezone utility functions
export const getPhilippinesTime = (): Date => {
	// Philippines is UTC+8
	const now = new Date();
	const utc = now.getTime() + now.getTimezoneOffset() * 60000;
	const philippinesTime = new Date(utc + 8 * 3600000); // UTC+8
	return philippinesTime;
};

export const toPhilippinesTime = (date: Date): Date => {
	const utc = date.getTime() + date.getTimezoneOffset() * 60000;
	const philippinesTime = new Date(utc + 8 * 3600000); // UTC+8
	return philippinesTime;
};

// GAD-7 scoring helper functions
export const getAnxietyLevelScore = (level: AnxietyLevel): number => {
	switch (level) {
		case "not_at_all":
			return 0;
		case "several_days":
			return 1;
		case "more_than_half_days":
			return 2;
		case "nearly_every_day":
			return 3;
		default:
			return 0;
	}
};

export const calculateTotalScore = (responses: {
	feeling_nervous_anxious_edge: AnxietyLevel;
	not_able_stop_control_worrying: AnxietyLevel;
	worrying_too_much_different_things: AnxietyLevel;
	trouble_relaxing: AnxietyLevel;
	restless_hard_sit_still: AnxietyLevel;
	easily_annoyed_irritable: AnxietyLevel;
	feeling_afraid_awful_happen: AnxietyLevel;
}): number => {
	return (
		getAnxietyLevelScore(responses.feeling_nervous_anxious_edge) +
		getAnxietyLevelScore(responses.not_able_stop_control_worrying) +
		getAnxietyLevelScore(responses.worrying_too_much_different_things) +
		getAnxietyLevelScore(responses.trouble_relaxing) +
		getAnxietyLevelScore(responses.restless_hard_sit_still) +
		getAnxietyLevelScore(responses.easily_annoyed_irritable) +
		getAnxietyLevelScore(responses.feeling_afraid_awful_happen)
	);
};

export const determineSeverityLevel = (totalScore: number): SeverityLevel => {
	if (totalScore >= 0 && totalScore <= 4) return "minimal";
	if (totalScore >= 5 && totalScore <= 9) return "mild";
	if (totalScore >= 10 && totalScore <= 14) return "moderate";
	if (totalScore >= 15 && totalScore <= 21) return "severe";
	return "minimal";
};

export const getSeverityDescription = (severity: SeverityLevel): string => {
	switch (severity) {
		case "minimal":
			return "Minimal anxiety - No significant anxiety symptoms";
		case "mild":
			return "Mild anxiety - Some anxiety symptoms present";
		case "moderate":
			return "Moderate anxiety - Significant anxiety symptoms that may benefit from treatment";
		case "severe":
			return "Severe anxiety - Significant anxiety symptoms that require clinical attention";
		default:
			return "Unknown severity level";
	}
};

export const validateAnxietyLevel = (value: any): boolean => {
	return ["not_at_all", "several_days", "more_than_half_days", "nearly_every_day"].includes(
		value,
	);
};

export const validateDifficultyLevel = (value: any): boolean => {
	return [
		"not_difficult_at_all",
		"somewhat_difficult",
		"very_difficult",
		"extremely_difficult",
	].includes(value);
};

export const getRecommendationMessage = (totalScore: number): string => {
	if (totalScore >= 10) {
		return "Score indicates moderate to severe anxiety. Consider seeking professional help.";
	}
	if (totalScore >= 5) {
		return "Score indicates mild anxiety. Monitor symptoms and consider stress management techniques.";
	}
	return "Score indicates minimal anxiety symptoms.";
};

export const generateRecommendations = (
	totalScore: number,
	severityLevel: SeverityLevel,
): string[] => {
	const recommendations: string[] = [];

	// Base recommendations based on severity level (limited to 3-4 key recommendations)
	switch (severityLevel) {
		case "severe":
			recommendations.push(
				"Seek immediate professional help from a mental health specialist",
				"Practice daily grounding techniques and breathing exercises",
				"Implement crisis management strategies and emergency contacts",
			);
			break;
		case "moderate":
			recommendations.push(
				"Schedule an appointment with a counselor or therapist",
				"Practice regular mindfulness and relaxation techniques",
				"Maintain a consistent sleep schedule and healthy routine",
			);
			break;
		case "mild":
			recommendations.push(
				"Monitor anxiety symptoms and track triggers in a journal",
				"Practice stress management techniques like deep breathing",
				"Engage in regular physical exercise and outdoor activities",
			);
			break;
		case "minimal":
			recommendations.push(
				"Continue current coping strategies that are working well",
				"Maintain healthy lifestyle habits for prevention",
				"Stay aware of early signs of anxiety for early intervention",
			);
			break;
	}

	// Only add one additional recommendation based on score for severe cases
	if (totalScore >= 15) {
		recommendations.push("Create a comprehensive safety plan with trusted individuals");
	}

	return recommendations;
};

export const createAnalysisResult = (totalScore: number, severityLevel: SeverityLevel) => {
	return {
		totalScore,
		severityLevel,
		severityDescription: getSeverityDescription(severityLevel),
		recommendationMessage: getRecommendationMessage(totalScore),
		needsProfessionalHelp: totalScore >= 10,
	};
};

export const createDetailedAnalysisResult = (
	responses: {
		feeling_nervous_anxious_edge: AnxietyLevel;
		not_able_stop_control_worrying: AnxietyLevel;
		worrying_too_much_different_things: AnxietyLevel;
		trouble_relaxing: AnxietyLevel;
		restless_hard_sit_still: AnxietyLevel;
		easily_annoyed_irritable: AnxietyLevel;
		feeling_afraid_awful_happen: AnxietyLevel;
	},
	totalScore: number,
	severityLevel: SeverityLevel,
) => {
	return {
		...createAnalysisResult(totalScore, severityLevel),
		scoreBreakdown: {
			feeling_nervous_anxious_edge: getAnxietyLevelScore(
				responses.feeling_nervous_anxious_edge,
			),
			not_able_stop_control_worrying: getAnxietyLevelScore(
				responses.not_able_stop_control_worrying,
			),
			worrying_too_much_different_things: getAnxietyLevelScore(
				responses.worrying_too_much_different_things,
			),
			trouble_relaxing: getAnxietyLevelScore(responses.trouble_relaxing),
			restless_hard_sit_still: getAnxietyLevelScore(responses.restless_hard_sit_still),
			easily_annoyed_irritable: getAnxietyLevelScore(responses.easily_annoyed_irritable),
			feeling_afraid_awful_happen: getAnxietyLevelScore(
				responses.feeling_afraid_awful_happen,
			),
		},
	};
};

// Cooldown period helper functions (with Philippines timezone support)
export const getCooldownDays = (severityLevel: SeverityLevel): number => {
	switch (severityLevel) {
		case "minimal":
			return 30;
		case "mild":
			return 25;
		case "moderate":
			return 14;
		case "severe":
			return 2;
		default:
			return 30;
	}
};

export const calculateNextAssessmentDate = (
	lastAssessmentDate: Date,
	severityLevel: SeverityLevel,
): Date => {
	const cooldownDays = getCooldownDays(severityLevel);
	const nextDate = new Date(lastAssessmentDate);
	nextDate.setDate(nextDate.getDate() + cooldownDays);
	return nextDate;
};

export const isCooldownActive = (
	lastAssessmentDate: Date,
	severityLevel: SeverityLevel,
): boolean => {
	const nextAllowedDate = calculateNextAssessmentDate(lastAssessmentDate, severityLevel);
	const now = getPhilippinesTime(); // Use Philippines time instead of system time
	return now < nextAllowedDate;
};

export const getCooldownStatus = (
	lastAssessmentDate: Date,
	severityLevel: SeverityLevel,
): {
	isActive: boolean;
	daysRemaining: number;
	nextAvailableDate: Date;
	cooldownPeriodDays: number;
	currentPhilippinesTime: Date;
	debugInfo: {
		lastAssessmentPhTime: Date;
		nextAvailablePhTime: Date;
		timeDifferenceMs: number;
	};
} => {
	const nextAvailableDate = calculateNextAssessmentDate(lastAssessmentDate, severityLevel);
	const now = getPhilippinesTime(); // Use Philippines time
	const isActive = now < nextAvailableDate;
	const timeDifferenceMs = nextAvailableDate.getTime() - now.getTime();
	const daysRemaining = isActive ? Math.ceil(timeDifferenceMs / (1000 * 60 * 60 * 24)) : 0;

	return {
		isActive,
		daysRemaining,
		nextAvailableDate,
		cooldownPeriodDays: getCooldownDays(severityLevel),
		currentPhilippinesTime: now,
		debugInfo: {
			lastAssessmentPhTime: toPhilippinesTime(lastAssessmentDate),
			nextAvailablePhTime: toPhilippinesTime(nextAvailableDate),
			timeDifferenceMs,
		},
	};
};

export const formatCooldownMessage = (
	severityLevel: SeverityLevel,
	daysRemaining: number,
	nextAvailableDate: Date,
): string => {
	const severityText = severityLevel.charAt(0).toUpperCase() + severityLevel.slice(1);
	// Format date in Philippines timezone
	const phDate = toPhilippinesTime(nextAvailableDate);
	const dateStr = phDate.toLocaleDateString("en-PH", {
		timeZone: "Asia/Manila",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});

	return `${severityText} anxiety level requires a ${getCooldownDays(
		severityLevel,
	)}-day cooldown period. You can take your next assessment in ${daysRemaining} day${
		daysRemaining !== 1 ? "s" : ""
	} (${dateStr}).`;
};
