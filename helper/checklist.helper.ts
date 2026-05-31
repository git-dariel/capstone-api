// Helper function to generate comprehensive recommendations based on checklist analysis
export function generateRecommendations(analysis: {
	totalProblemsChecked: number;
	totalCircledImportant: number;
	categoryScores: Record<string, number>;
	riskLevel: "low" | "moderate" | "high" | "critical";
	urgencyLevel: "none" | "monitor" | "schedule" | "immediate";
}): string[] {
	const recommendations: string[] = [];
	const { categoryScores, riskLevel } = analysis;

	// Base recommendations based on risk level (limited to 3-4 key recommendations)
	switch (riskLevel) {
		case "critical":
			recommendations.push(
				"Seek immediate professional counseling intervention",
				"Contact campus crisis counseling services immediately",
				"Consider temporary academic accommodations or medical leave",
				"Establish daily check-ins with mental health professionals",
			);
			break;
		case "high":
			recommendations.push(
				"Schedule counseling session within the week",
				"Contact campus counseling center for immediate support",
				"Develop comprehensive coping strategies with professional guidance",
				"Implement daily stress management and self-care routines",
			);
			break;
		case "moderate":
			recommendations.push(
				"Schedule regular check-ins with counselor or advisor",
				"Explore campus mental health and wellness resources",
				"Develop proactive problem-solving strategies",
				"Practice stress management and resilience-building techniques",
			);
			break;
		case "low":
			recommendations.push(
				"Continue current positive coping strategies",
				"Maintain awareness of personal challenges and early warning signs",
				"Stay connected with supportive relationships and resources",
			);
			break;
	}

	// Add only the most critical category-specific recommendation
	const topCategory = Object.entries(categoryScores).reduce(
		(max, [key, value]) => (value > max.value ? { key, value } : max),
		{ key: "", value: 0 },
	);

	if (topCategory.value >= 3) {
		switch (topCategory.key) {
			case "emotional_problems":
				recommendations.push("Focus on emotional regulation and coping skills development");
				break;
			case "school_problems":
				recommendations.push("Meet with academic advisor to develop success strategies");
				break;
			case "social_friends_problems":
				recommendations.push("Join social clubs or activity groups to build connections");
				break;
			case "family_home_problems":
				recommendations.push("Consider family therapy resources and conflict resolution");
				break;
			case "money_problems":
				recommendations.push(
					"Meet with financial aid counselor to explore assistance options",
				);
				break;
			default:
				recommendations.push("Work with counselor to address primary area of concern");
				break;
		}
	}

	return recommendations;
}

// Helper function to analyze checklist data
export function analyzeChecklistData(checklist: any) {
	let totalProblemsChecked = 0;
	let totalCircledImportant = 0;
	const categoryScores: Record<string, number> = {};
	const riskFactors: string[] = [];
	const recommendations: string[] = [];

	// Count problems in each category
	const categories = [
		"social_friends_problems",
		"appearance_problems",
		"attitude_opinion_problems",
		"parents_problems",
		"family_home_problems",
		"school_problems",
		"money_problems",
		"religion_problems",
		"emotional_problems",
		"dating_sex_problems",
	];

	categories.forEach((category) => {
		const problems = checklist[category];
		if (problems) {
			let categoryCount = 0;
			let categoryImportant = 0;

			Object.values(problems).forEach((value: any) => {
				if (value === "checked" || value === "circled_most_important") {
					totalProblemsChecked++;
					categoryCount++;
				}
				if (value === "circled_most_important") {
					totalCircledImportant++;
					categoryImportant++;
				}
			});

			categoryScores[category] = categoryCount;

			// Add risk factors based on category scores
			if (categoryCount >= 5) {
				riskFactors.push(`High number of problems in ${category.replace(/_/g, " ")}`);
			}
			if (categoryImportant >= 2) {
				riskFactors.push(`Multiple critical issues in ${category.replace(/_/g, " ")}`);
			}
		}
	});

	// Determine risk level
	let riskLevel: "low" | "moderate" | "high" | "critical" = "low";
	let urgencyLevel: "none" | "monitor" | "schedule" | "immediate" = "none";

	if (totalCircledImportant >= 5 || totalProblemsChecked >= 30) {
		riskLevel = "critical";
		urgencyLevel = "immediate";
		recommendations.push("Immediate counseling intervention required");
		recommendations.push("Consider mental health professional referral");
	} else if (totalCircledImportant >= 3 || totalProblemsChecked >= 20) {
		riskLevel = "high";
		urgencyLevel = "schedule";
		recommendations.push("Schedule counseling session within the week");
		recommendations.push("Monitor closely for any changes");
	} else if (totalCircledImportant >= 1 || totalProblemsChecked >= 10) {
		riskLevel = "moderate";
		urgencyLevel = "monitor";
		recommendations.push("Regular check-ins recommended");
		recommendations.push("Consider peer support groups");
	} else {
		riskLevel = "low";
		urgencyLevel = "none";
		recommendations.push("Continue regular monitoring");
		recommendations.push("Maintain open communication");
	}

	// Add specific recommendations based on problem areas
	if (categoryScores.emotional_problems >= 3) {
		recommendations.push("Focus on emotional regulation strategies");
	}
	if (categoryScores.school_problems >= 3) {
		recommendations.push("Academic support and study skills training");
	}
	if (categoryScores.family_home_problems >= 3) {
		recommendations.push("Family counseling may be beneficial");
	}

	return {
		totalProblemsChecked,
		totalCircledImportant,
		categoryScores,
		riskLevel,
		urgencyLevel,
		riskFactors,
		recommendations,
		needsAttention: riskLevel !== "low",
		analysisDate: new Date(),
		disclaimer:
			"This checklist is for informational purposes only and does not replace professional psychological assessment. Please consult with a qualified mental health professional for proper evaluation and treatment.",
	};
}
