import { SuicideResponse, SuicideRiskLevel, SuicideBehaviorTimeframe } from "../generated/prisma";

// CSSRS scoring helper functions
export const getSuicideResponseScore = (response: SuicideResponse): number => {
	switch (response) {
		case "no":
			return 0;
		case "yes":
			return 1;
		default:
			return 0;
	}
};

export const calculateRiskScore = (responses: {
	wished_dead_or_sleep_not_wake_up: SuicideResponse;
	actually_had_thoughts_killing_self: SuicideResponse;
	thinking_about_how_might_do_this?: SuicideResponse | null;
	had_thoughts_and_some_intention?: SuicideResponse | null;
	started_worked_out_details_how_kill?: SuicideResponse | null;
	done_anything_started_prepared_end_life?: SuicideResponse | null;
}): number => {
	let score = 0;

	// Questions 1 and 2 are always scored
	score += getSuicideResponseScore(responses.wished_dead_or_sleep_not_wake_up);
	score += getSuicideResponseScore(responses.actually_had_thoughts_killing_self);

	// Questions 3-6 only if previous questions were answered
	if (responses.thinking_about_how_might_do_this) {
		score += getSuicideResponseScore(responses.thinking_about_how_might_do_this);
	}
	if (responses.had_thoughts_and_some_intention) {
		score += getSuicideResponseScore(responses.had_thoughts_and_some_intention);
	}
	if (responses.started_worked_out_details_how_kill) {
		score += getSuicideResponseScore(responses.started_worked_out_details_how_kill);
	}
	if (responses.done_anything_started_prepared_end_life) {
		score += getSuicideResponseScore(responses.done_anything_started_prepared_end_life);
	}

	return score;
};

export const determineRiskLevel = (responses: {
	wished_dead_or_sleep_not_wake_up: SuicideResponse;
	actually_had_thoughts_killing_self: SuicideResponse;
	thinking_about_how_might_do_this?: SuicideResponse | null;
	had_thoughts_and_some_intention?: SuicideResponse | null;
	started_worked_out_details_how_kill?: SuicideResponse | null;
	done_anything_started_prepared_end_life?: SuicideResponse | null;
	behavior_timeframe?: SuicideBehaviorTimeframe | null;
}): SuicideRiskLevel => {
	// High risk: Any behavior in past 3 months OR detailed planning with intention
	if (
		responses.done_anything_started_prepared_end_life === "yes" &&
		responses.behavior_timeframe === "past_three_months"
	) {
		return "high";
	}

	// High risk: Has detailed plan with some intention
	if (
		responses.started_worked_out_details_how_kill === "yes" &&
		responses.had_thoughts_and_some_intention === "yes"
	) {
		return "high";
	}

	// Moderate risk: Active ideation with method or intention (but not both)
	if (
		responses.actually_had_thoughts_killing_self === "yes" &&
		(responses.thinking_about_how_might_do_this === "yes" ||
			responses.had_thoughts_and_some_intention === "yes")
	) {
		return "moderate";
	}

	// Low risk: Only passive ideation or no ideation
	if (
		responses.wished_dead_or_sleep_not_wake_up === "yes" &&
		responses.actually_had_thoughts_killing_self === "no"
	) {
		return "low";
	}

	// Low risk: No ideation
	return "low";
};

export const requiresImmediateIntervention = (
	riskLevel: SuicideRiskLevel,
	responses: {
		done_anything_started_prepared_end_life?: SuicideResponse | null;
		behavior_timeframe?: SuicideBehaviorTimeframe | null;
		started_worked_out_details_how_kill?: SuicideResponse | null;
		had_thoughts_and_some_intention?: SuicideResponse | null;
	},
): boolean => {
	// Immediate intervention required for high risk
	if (riskLevel === "high") return true;

	// Also immediate intervention if recent behaviors or detailed planning
	if (
		responses.done_anything_started_prepared_end_life === "yes" &&
		responses.behavior_timeframe === "past_three_months"
	) {
		return true;
	}

	return false;
};

export const getRiskDescription = (risk: SuicideRiskLevel): string => {
	switch (risk) {
		case "low":
			return "Low suicide risk - Minimal or no current suicidal ideation";
		case "moderate":
			return "Moderate suicide risk - Active suicidal thoughts present, requires monitoring and support";
		case "high":
			return "High suicide risk - Immediate intervention and safety planning required";
		default:
			return "Unknown risk level";
	}
};

export const validateSuicideResponse = (value: any): boolean => {
	return ["yes", "no"].includes(value);
};

export const validateBehaviorTimeframe = (value: any): boolean => {
	return ["past_three_months", "lifetime_but_not_recent", "never"].includes(value);
};

export const getRecommendationMessage = (
	riskLevel: SuicideRiskLevel,
	requiresIntervention: boolean,
): string => {
	if (requiresIntervention) {
		return "IMMEDIATE ACTION REQUIRED: Contact emergency services or crisis hotline immediately. Do not leave person alone.";
	}

	switch (riskLevel) {
		case "high":
			return "High risk detected. Immediate professional intervention required. Implement safety planning and close monitoring.";
		case "moderate":
			return "Moderate risk present. Schedule immediate professional assessment and develop safety plan. Monitor closely.";
		case "low":
			return "Low risk indicated. Continue supportive care and regular check-ins. Consider preventive mental health resources.";
		default:
			return "Risk assessment completed. Follow standard protocols for mental health support.";
	}
};

export const createAnalysisResult = (
	riskLevel: SuicideRiskLevel,
	requiresIntervention: boolean,
) => {
	return {
		riskLevel,
		requiresImmediateIntervention: requiresIntervention,
		riskDescription: getRiskDescription(riskLevel),
		recommendationMessage: getRecommendationMessage(riskLevel, requiresIntervention),
		crisisProtocolRequired: requiresIntervention,
		safetyPlanNeeded: riskLevel !== "low" || requiresIntervention,
	};
};

export const createDetailedAnalysisResult = (
	responses: {
		wished_dead_or_sleep_not_wake_up: SuicideResponse;
		actually_had_thoughts_killing_self: SuicideResponse;
		thinking_about_how_might_do_this?: SuicideResponse | null;
		had_thoughts_and_some_intention?: SuicideResponse | null;
		started_worked_out_details_how_kill?: SuicideResponse | null;
		done_anything_started_prepared_end_life?: SuicideResponse | null;
		behavior_timeframe?: SuicideBehaviorTimeframe | null;
	},
	riskLevel: SuicideRiskLevel,
	requiresIntervention: boolean,
) => {
	const riskScore = calculateRiskScore(responses);

	return {
		...createAnalysisResult(riskLevel, requiresIntervention),
		riskScore,
		responseBreakdown: {
			wished_dead_or_sleep_not_wake_up: getSuicideResponseScore(
				responses.wished_dead_or_sleep_not_wake_up,
			),
			actually_had_thoughts_killing_self: getSuicideResponseScore(
				responses.actually_had_thoughts_killing_self,
			),
			thinking_about_how_might_do_this: responses.thinking_about_how_might_do_this
				? getSuicideResponseScore(responses.thinking_about_how_might_do_this)
				: null,
			had_thoughts_and_some_intention: responses.had_thoughts_and_some_intention
				? getSuicideResponseScore(responses.had_thoughts_and_some_intention)
				: null,
			started_worked_out_details_how_kill: responses.started_worked_out_details_how_kill
				? getSuicideResponseScore(responses.started_worked_out_details_how_kill)
				: null,
			done_anything_started_prepared_end_life:
				responses.done_anything_started_prepared_end_life
					? getSuicideResponseScore(responses.done_anything_started_prepared_end_life)
					: null,
		},
		cssrsQuestionFlow: {
			shouldAskQuestions3to6: responses.actually_had_thoughts_killing_self === "yes",
			shouldAskBehaviorTimeframe: responses.done_anything_started_prepared_end_life === "yes",
		},
	};
};
