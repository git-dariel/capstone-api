import { DepressionFrequency, DepressionSeverityLevel } from "../generated/prisma";

// PHQ-9 scoring helper functions
export const getDepressionFrequencyScore = (frequency: DepressionFrequency): number => {
	switch (frequency) {
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
	little_interest_pleasure_doing_things: DepressionFrequency;
	feeling_down_depressed_hopeless: DepressionFrequency;
	trouble_falling_staying_asleep_too_much: DepressionFrequency;
	feeling_tired_having_little_energy: DepressionFrequency;
	poor_appetite_overeating: DepressionFrequency;
	feeling_bad_about_yourself_failure: DepressionFrequency;
	trouble_concentrating_things: DepressionFrequency;
	moving_speaking_slowly_fidgety_restless: DepressionFrequency;
	thoughts_better_off_dead_hurting_yourself: DepressionFrequency;
}): number => {
	return (
		getDepressionFrequencyScore(responses.little_interest_pleasure_doing_things) +
		getDepressionFrequencyScore(responses.feeling_down_depressed_hopeless) +
		getDepressionFrequencyScore(responses.trouble_falling_staying_asleep_too_much) +
		getDepressionFrequencyScore(responses.feeling_tired_having_little_energy) +
		getDepressionFrequencyScore(responses.poor_appetite_overeating) +
		getDepressionFrequencyScore(responses.feeling_bad_about_yourself_failure) +
		getDepressionFrequencyScore(responses.trouble_concentrating_things) +
		getDepressionFrequencyScore(responses.moving_speaking_slowly_fidgety_restless) +
		getDepressionFrequencyScore(responses.thoughts_better_off_dead_hurting_yourself)
	);
};

export const determineSeverityLevel = (totalScore: number): DepressionSeverityLevel => {
	if (totalScore >= 1 && totalScore <= 4) return "minimal";
	if (totalScore >= 5 && totalScore <= 9) return "mild";
	if (totalScore >= 10 && totalScore <= 14) return "moderate";
	if (totalScore >= 15 && totalScore <= 19) return "moderately_severe";
	if (totalScore >= 20 && totalScore <= 27) return "severe";
	return "minimal";
};

export const getSeverityDescription = (severity: DepressionSeverityLevel): string => {
	switch (severity) {
		case "minimal":
			return "Minimal depression - No significant depressive symptoms";
		case "mild":
			return "Mild depression - Some depressive symptoms present";
		case "moderate":
			return "Moderate depression - Significant depressive symptoms that may benefit from treatment";
		case "moderately_severe":
			return "Moderately severe depression - Significant depressive symptoms that require clinical attention";
		case "severe":
			return "Severe depression - Severe depressive symptoms that require immediate clinical attention";
		default:
			return "Unknown severity level";
	}
};

export const validateDepressionFrequency = (value: any): boolean => {
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
	if (totalScore >= 20) {
		return "Score indicates severe depression. Immediate professional help is strongly recommended.";
	}
	if (totalScore >= 15) {
		return "Score indicates moderately severe depression. Professional help is recommended.";
	}
	if (totalScore >= 10) {
		return "Score indicates moderate depression. Consider seeking professional help.";
	}
	if (totalScore >= 5) {
		return "Score indicates mild depression. Monitor symptoms and consider stress management techniques.";
	}
	return "Score indicates minimal depressive symptoms.";
};

export const createAnalysisResult = (
	totalScore: number,
	severityLevel: DepressionSeverityLevel,
) => {
	return {
		totalScore,
		severityLevel,
		severityDescription: getSeverityDescription(severityLevel),
		recommendationMessage: getRecommendationMessage(totalScore),
		needsProfessionalHelp: totalScore >= 10,
		requiresImmediateAttention: totalScore >= 20,
	};
};

export const createDetailedAnalysisResult = (
	responses: {
		little_interest_pleasure_doing_things: DepressionFrequency;
		feeling_down_depressed_hopeless: DepressionFrequency;
		trouble_falling_staying_asleep_too_much: DepressionFrequency;
		feeling_tired_having_little_energy: DepressionFrequency;
		poor_appetite_overeating: DepressionFrequency;
		feeling_bad_about_yourself_failure: DepressionFrequency;
		trouble_concentrating_things: DepressionFrequency;
		moving_speaking_slowly_fidgety_restless: DepressionFrequency;
		thoughts_better_off_dead_hurting_yourself: DepressionFrequency;
	},
	totalScore: number,
	severityLevel: DepressionSeverityLevel,
) => {
	return {
		...createAnalysisResult(totalScore, severityLevel),
		scoreBreakdown: {
			little_interest_pleasure_doing_things: getDepressionFrequencyScore(
				responses.little_interest_pleasure_doing_things,
			),
			feeling_down_depressed_hopeless: getDepressionFrequencyScore(
				responses.feeling_down_depressed_hopeless,
			),
			trouble_falling_staying_asleep_too_much: getDepressionFrequencyScore(
				responses.trouble_falling_staying_asleep_too_much,
			),
			feeling_tired_having_little_energy: getDepressionFrequencyScore(
				responses.feeling_tired_having_little_energy,
			),
			poor_appetite_overeating: getDepressionFrequencyScore(
				responses.poor_appetite_overeating,
			),
			feeling_bad_about_yourself_failure: getDepressionFrequencyScore(
				responses.feeling_bad_about_yourself_failure,
			),
			trouble_concentrating_things: getDepressionFrequencyScore(
				responses.trouble_concentrating_things,
			),
			moving_speaking_slowly_fidgety_restless: getDepressionFrequencyScore(
				responses.moving_speaking_slowly_fidgety_restless,
			),
			thoughts_better_off_dead_hurting_yourself: getDepressionFrequencyScore(
				responses.thoughts_better_off_dead_hurting_yourself,
			),
		},
		suicidalIdeationDetected:
			getDepressionFrequencyScore(responses.thoughts_better_off_dead_hurting_yourself) > 0,
	};
};

// Helper function to check if immediate intervention is needed (suicidal ideation)
export const checkSuicidalIdeation = (
	thoughts_better_off_dead_hurting_yourself: DepressionFrequency,
): boolean => {
	return getDepressionFrequencyScore(thoughts_better_off_dead_hurting_yourself) > 0;
};

// Helper function to determine if major depressive disorder criteria might be met
export const checkMajorDepressionCriteria = (responses: {
	little_interest_pleasure_doing_things: DepressionFrequency;
	feeling_down_depressed_hopeless: DepressionFrequency;
	trouble_falling_staying_asleep_too_much: DepressionFrequency;
	feeling_tired_having_little_energy: DepressionFrequency;
	poor_appetite_overeating: DepressionFrequency;
	feeling_bad_about_yourself_failure: DepressionFrequency;
	trouble_concentrating_things: DepressionFrequency;
	moving_speaking_slowly_fidgety_restless: DepressionFrequency;
	thoughts_better_off_dead_hurting_yourself: DepressionFrequency;
}): boolean => {
	const symptomScores = [
		getDepressionFrequencyScore(responses.little_interest_pleasure_doing_things),
		getDepressionFrequencyScore(responses.feeling_down_depressed_hopeless),
		getDepressionFrequencyScore(responses.trouble_falling_staying_asleep_too_much),
		getDepressionFrequencyScore(responses.feeling_tired_having_little_energy),
		getDepressionFrequencyScore(responses.poor_appetite_overeating),
		getDepressionFrequencyScore(responses.feeling_bad_about_yourself_failure),
		getDepressionFrequencyScore(responses.trouble_concentrating_things),
		getDepressionFrequencyScore(responses.moving_speaking_slowly_fidgety_restless),
		getDepressionFrequencyScore(responses.thoughts_better_off_dead_hurting_yourself),
	];

	const symptomsPresent = symptomScores.filter((score) => score >= 2).length; // "More than half the days" or "Nearly every day"
	const coreSymptoms = [
		getDepressionFrequencyScore(responses.little_interest_pleasure_doing_things),
		getDepressionFrequencyScore(responses.feeling_down_depressed_hopeless),
	];
	const coreSymptomPresent = coreSymptoms.some((score) => score >= 2);

	// Major depression criteria: at least 5 symptoms present most days, including at least one core symptom
	return symptomsPresent >= 5 && coreSymptomPresent;
};
