import { StressFrequency, StressSeverityLevel } from "../generated/prisma";

// PSS-10 scoring helper functions
export const getStressFrequencyScore = (frequency: StressFrequency): number => {
	switch (frequency) {
		case "never":
			return 0;
		case "almost_never":
			return 1;
		case "sometimes":
			return 2;
		case "fairly_often":
			return 3;
		case "very_often":
			return 4;
		default:
			return 0;
	}
};

// Reverse scoring for questions 4, 5, 7, 8 (positive coping questions)
export const getReverseStressFrequencyScore = (frequency: StressFrequency): number => {
	switch (frequency) {
		case "never":
			return 4;
		case "almost_never":
			return 3;
		case "sometimes":
			return 2;
		case "fairly_often":
			return 1;
		case "very_often":
			return 0;
		default:
			return 4;
	}
};

export const calculateTotalScore = (responses: {
	upset_because_something_unexpected: StressFrequency;
	unable_control_important_things: StressFrequency;
	feeling_nervous_and_stressed: StressFrequency;
	confident_handle_personal_problems: StressFrequency;
	feeling_things_going_your_way: StressFrequency;
	unable_cope_with_all_things: StressFrequency;
	able_control_irritations: StressFrequency;
	feeling_on_top_of_things: StressFrequency;
	angered_things_outside_control: StressFrequency;
	difficulties_piling_up_cant_overcome: StressFrequency;
}): number => {
	return (
		getStressFrequencyScore(responses.upset_because_something_unexpected) +
		getStressFrequencyScore(responses.unable_control_important_things) +
		getStressFrequencyScore(responses.feeling_nervous_and_stressed) +
		getReverseStressFrequencyScore(responses.confident_handle_personal_problems) + // Q4 - reverse
		getReverseStressFrequencyScore(responses.feeling_things_going_your_way) + // Q5 - reverse
		getStressFrequencyScore(responses.unable_cope_with_all_things) +
		getReverseStressFrequencyScore(responses.able_control_irritations) + // Q7 - reverse
		getReverseStressFrequencyScore(responses.feeling_on_top_of_things) + // Q8 - reverse
		getStressFrequencyScore(responses.angered_things_outside_control) +
		getStressFrequencyScore(responses.difficulties_piling_up_cant_overcome)
	);
};

export const determineSeverityLevel = (totalScore: number): StressSeverityLevel => {
	if (totalScore >= 0 && totalScore <= 13) return "low";
	if (totalScore >= 14 && totalScore <= 26) return "moderate";
	if (totalScore >= 27 && totalScore <= 40) return "high";
	return "low";
};

export const getSeverityDescription = (severity: StressSeverityLevel): string => {
	switch (severity) {
		case "low":
			return "Low stress - Your stress level is manageable and within normal range";
		case "moderate":
			return "Moderate stress - You may benefit from stress management techniques";
		case "high":
			return "High perceived stress - Consider seeking professional support or stress management resources";
		default:
			return "Unknown severity level";
	}
};

export const validateStressFrequency = (value: any): boolean => {
	return ["never", "almost_never", "sometimes", "fairly_often", "very_often"].includes(value);
};

export const getRecommendationMessage = (totalScore: number): string => {
	if (totalScore >= 27) {
		return "Score indicates high perceived stress. Consider seeking professional help or stress management resources.";
	}
	if (totalScore >= 14) {
		return "Score indicates moderate stress levels. Consider implementing stress reduction techniques and monitoring your stress levels.";
	}
	return "Score indicates low stress levels. Continue with current coping strategies.";
};

export const createAnalysisResult = (totalScore: number, severityLevel: StressSeverityLevel) => {
	return {
		totalScore,
		severityLevel,
		severityDescription: getSeverityDescription(severityLevel),
		recommendationMessage: getRecommendationMessage(totalScore),
		needsProfessionalHelp: totalScore >= 27,
	};
};

export const createDetailedAnalysisResult = (
	responses: {
		upset_because_something_unexpected: StressFrequency;
		unable_control_important_things: StressFrequency;
		feeling_nervous_and_stressed: StressFrequency;
		confident_handle_personal_problems: StressFrequency;
		feeling_things_going_your_way: StressFrequency;
		unable_cope_with_all_things: StressFrequency;
		able_control_irritations: StressFrequency;
		feeling_on_top_of_things: StressFrequency;
		angered_things_outside_control: StressFrequency;
		difficulties_piling_up_cant_overcome: StressFrequency;
	},
	totalScore: number,
	severityLevel: StressSeverityLevel,
) => {
	return {
		...createAnalysisResult(totalScore, severityLevel),
		scoreBreakdown: {
			upset_because_something_unexpected: getStressFrequencyScore(
				responses.upset_because_something_unexpected,
			),
			unable_control_important_things: getStressFrequencyScore(
				responses.unable_control_important_things,
			),
			feeling_nervous_and_stressed: getStressFrequencyScore(
				responses.feeling_nervous_and_stressed,
			),
			confident_handle_personal_problems: getReverseStressFrequencyScore(
				responses.confident_handle_personal_problems,
			),
			feeling_things_going_your_way: getReverseStressFrequencyScore(
				responses.feeling_things_going_your_way,
			),
			unable_cope_with_all_things: getStressFrequencyScore(
				responses.unable_cope_with_all_things,
			),
			able_control_irritations: getReverseStressFrequencyScore(
				responses.able_control_irritations,
			),
			feeling_on_top_of_things: getReverseStressFrequencyScore(
				responses.feeling_on_top_of_things,
			),
			angered_things_outside_control: getStressFrequencyScore(
				responses.angered_things_outside_control,
			),
			difficulties_piling_up_cant_overcome: getStressFrequencyScore(
				responses.difficulties_piling_up_cant_overcome,
			),
		},
	};
};
