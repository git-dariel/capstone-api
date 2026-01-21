export type RiskLevel = "low" | "moderate" | "high" | "critical";

/**
 * Helper to normalize risk level strings from ML predictions
 * Converts "low risk", "moderate risk", "high risk" to "low", "moderate", "high"
 */
const normalizeRiskLevel = (riskLevel: string | undefined | null): RiskLevel | null => {
	if (!riskLevel) return null;

	const normalized = riskLevel.toLowerCase().trim();

	if (normalized.includes("critical")) return "critical";
	if (normalized.includes("high")) return "high";
	if (normalized.includes("moderate")) return "moderate";
	if (normalized.includes("low")) return "low";

	return null;
};

/**
 * Get the highest risk level from ML predictions
 * Priority: critical > high > moderate > low
 */
const getHighestRiskFromMLPredictions = (mlPredictions: any): RiskLevel | null => {
	if (!mlPredictions) return null;

	const riskLevels: (RiskLevel | null)[] = [
		normalizeRiskLevel(mlPredictions.anxiety?.riskLevel),
		normalizeRiskLevel(mlPredictions.depression?.riskLevel),
		normalizeRiskLevel(mlPredictions.stress?.riskLevel),
	].filter((level): level is RiskLevel => level !== null);

	if (riskLevels.length === 0) return null;

	// Return highest priority risk level
	if (riskLevels.includes("critical")) return "critical";
	if (riskLevels.includes("high")) return "high";
	if (riskLevels.includes("moderate")) return "moderate";
	if (riskLevels.includes("low")) return "low";

	return null;
};

export interface InventoryReminderInfo {
	needsUpdate: boolean;
	riskLevel: RiskLevel | null;
	lastUpdated: Date | null;
	nextUpdateDue: Date | null;
	monthsUntilDue: number;
	daysUntilDue: number;
	isOverdue: boolean;
	updateFrequencyMonths: number;
}

/**
 * Update frequency based on risk level (in months)
 */
const RISK_LEVEL_UPDATE_FREQUENCY: Record<RiskLevel, number> = {
	low: 7,
	moderate: 6,
	high: 4,
	critical: 3,
};

/**
 * Get the latest mental health prediction from inventory
 */
export const getLatestPrediction = (inventory: any) => {
	if (!inventory?.mentalHealthPredictions || inventory.mentalHealthPredictions.length === 0) {
		return null;
	}

	// Sort by predictionDate or createdAt (most recent first) and return the first one
	const sortedPredictions = [...inventory.mentalHealthPredictions].sort((a: any, b: any) => {
		const dateA = new Date(a.predictionDate || a.createdAt).getTime();
		const dateB = new Date(b.predictionDate || b.createdAt).getTime();
		return dateB - dateA;
	});

	return sortedPredictions[0];
};

/**
 * Calculate inventory reminder information based on risk level and last update
 */
export const calculateInventoryReminder = (inventory: any): InventoryReminderInfo => {
	const latestPrediction = getLatestPrediction(inventory);

	// Try to get risk level from new ML predictions first, fallback to old structure
	let riskLevel: RiskLevel | null = null;

	if (latestPrediction?.mlPredictions) {
		// New ML predictions structure
		riskLevel = getHighestRiskFromMLPredictions(latestPrediction.mlPredictions);
	}

	// Fallback to old mentalHealthRisk structure if ML predictions not available
	if (!riskLevel && latestPrediction?.mentalHealthRisk?.level) {
		riskLevel = normalizeRiskLevel(latestPrediction.mentalHealthRisk.level);
	}

	// If no prediction or risk level, default to suggesting update every 6 months
	const updateFrequencyMonths = riskLevel ? RISK_LEVEL_UPDATE_FREQUENCY[riskLevel] : 6;

	const lastUpdated = inventory?.updatedAt ? new Date(inventory.updatedAt) : null;
	const now = new Date();

	if (!lastUpdated) {
		return {
			needsUpdate: true,
			riskLevel,
			lastUpdated: null,
			nextUpdateDue: now,
			monthsUntilDue: 0,
			daysUntilDue: 0,
			isOverdue: true,
			updateFrequencyMonths,
		};
	}

	// Calculate next update date
	const nextUpdateDue = new Date(lastUpdated);
	nextUpdateDue.setMonth(nextUpdateDue.getMonth() + updateFrequencyMonths);

	// Calculate time until due
	const timeDiff = nextUpdateDue.getTime() - now.getTime();
	const daysUntilDue = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
	const monthsUntilDue = Math.ceil(daysUntilDue / 30);

	const isOverdue = timeDiff <= 0;
	const needsUpdate = daysUntilDue <= 30; // Show reminder 30 days before due date

	return {
		needsUpdate,
		riskLevel,
		lastUpdated,
		nextUpdateDue,
		monthsUntilDue,
		daysUntilDue,
		isOverdue,
		updateFrequencyMonths,
	};
};

/**
 * Get reminder message based on inventory status
 */
export const getReminderMessage = (reminderInfo: InventoryReminderInfo): string => {
	const { riskLevel, isOverdue, daysUntilDue, updateFrequencyMonths } = reminderInfo;

	if (isOverdue) {
		return `Your inventory record is overdue for an update. Based on your ${riskLevel} risk level, we recommend updating every ${updateFrequencyMonths} months.`;
	}

	if (daysUntilDue <= 7) {
		return `Your inventory record will need to be updated in ${daysUntilDue} day(s). Please consider updating it soon.`;
	}

	if (daysUntilDue <= 30) {
		return `Your inventory record will need to be updated in ${daysUntilDue} day(s). You can update it anytime to keep your mental health assessment current.`;
	}

	return `Based on your ${riskLevel} risk level, your next inventory update is recommended in ${daysUntilDue} days.`;
};

/**
 * Get reminder severity based on how close to due date
 */
export const getReminderSeverity = (
	reminderInfo: InventoryReminderInfo,
): "low" | "medium" | "high" | "critical" => {
	const { isOverdue, daysUntilDue } = reminderInfo;

	if (isOverdue) return "critical";
	if (daysUntilDue <= 7) return "high";
	if (daysUntilDue <= 14) return "medium";
	return "low";
};

/**
 * Format time remaining in a human-readable way
 */
export const formatTimeRemaining = (reminderInfo: InventoryReminderInfo): string => {
	const { isOverdue, daysUntilDue } = reminderInfo;

	if (isOverdue) {
		const daysOverdue = Math.abs(daysUntilDue);
		if (daysOverdue === 1) return "1 day overdue";
		if (daysOverdue < 30) return `${daysOverdue} days overdue`;
		const monthsOverdue = Math.ceil(daysOverdue / 30);
		return `${monthsOverdue} month${monthsOverdue > 1 ? "s" : ""} overdue`;
	}

	if (daysUntilDue === 1) return "Due tomorrow";
	if (daysUntilDue < 30) return `${daysUntilDue} days remaining`;

	const monthsRemaining = Math.ceil(daysUntilDue / 30);
	return `${monthsRemaining} month${monthsRemaining > 1 ? "s" : ""} remaining`;
};
