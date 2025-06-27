import { AnxietyLevel, SeverityLevel, DifficultyLevel } from "../generated/prisma";

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
