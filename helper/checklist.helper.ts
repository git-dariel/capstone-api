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
