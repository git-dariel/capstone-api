# Inventory Reminder ML Predictions Update

## Summary

Updated the inventory reminder system to use the new ML predictions structure instead of the old clinical assessment structure for determining risk levels and notification triggers.

## Issue Description

The inventory reminder notification modal that triggers for students was using the old prediction format which stored risk levels as:
- `mentalHealthRisk.level` = `"low"`, `"moderate"`, `"high"`, `"critical"`

However, the new Machine Learning predictions from `MentalHealthPredictionRecord.mlPredictions` use a different format:
- `mlPredictions.anxiety.riskLevel` = `"low risk"`
- `mlPredictions.anxiety.prediction` = `"Low Risk"`
- `mlPredictions.depression.riskLevel` = `"moderate risk"`
- `mlPredictions.stress.riskLevel` = `"high risk"`

## Changes Made

### 1. API Side - `capstone-api/helper/inventory-reminder.helper.ts`

#### New Helper Functions Added:

**`normalizeRiskLevel(riskLevel: string | undefined | null): RiskLevel | null`**
- Normalizes risk level strings from various formats
- Converts "low risk", "moderate risk", "high risk" to "low", "moderate", "high"
- Handles case-insensitive matching

**`getHighestRiskFromMLPredictions(mlPredictions: any): RiskLevel | null`**
- Extracts risk levels from all three ML prediction categories (anxiety, depression, stress)
- Returns the highest priority risk level
- Priority order: critical > high > moderate > low

#### Updated Functions:

**`getLatestPrediction(inventory: any)`**
- Now sorts by `predictionDate` first, falling back to `createdAt`
- Ensures the most recent prediction is always used

**`calculateInventoryReminder(inventory: any): InventoryReminderInfo`**
- First attempts to get risk level from `mlPredictions` (new structure)
- Falls back to `mentalHealthRisk.level` (old structure) if ML predictions unavailable
- Ensures backward compatibility with existing data

### 2. Frontend Side - `capstone-app/src/utils/inventoryReminder.ts`

Applied the same changes as the API side to ensure consistency:
- Added `normalizeRiskLevel()` helper function
- Added `getHighestRiskFromMLPredictions()` helper function
- Updated `getLatestPrediction()` to sort by predictionDate
- Updated `calculateInventoryReminder()` to use ML predictions with fallback

## How It Works

### Risk Level Determination Logic

1. **Check ML Predictions First (New Structure)**
   - Looks for `latestPrediction.mlPredictions`
   - Extracts risk levels from anxiety, depression, and stress predictions
   - Normalizes the risk level strings (e.g., "low risk" → "low")
   - Selects the highest priority risk level among the three

2. **Fallback to Clinical Assessment (Old Structure)**
   - If ML predictions are not available
   - Uses `latestPrediction.mentalHealthRisk.level`
   - Normalizes the risk level for consistency

3. **Default Behavior**
   - If no predictions exist, defaults to 6-month update frequency

### Update Frequency by Risk Level

| Risk Level | Update Frequency |
|------------|------------------|
| Low        | 7 months         |
| Moderate   | 6 months         |
| High       | 4 months         |
| Critical   | 3 months         |

### Notification Trigger Logic

The notification modal appears when:
- `needsUpdate = true` (when within 30 days of due date)
- User hasn't dismissed the notification in the last 24 hours
- Student has an inventory record with predictions

### Notification Severity Levels

| Condition | Severity |
|-----------|----------|
| Overdue | Critical |
| Due in ≤7 days | High |
| Due in ≤14 days | Medium |
| Due in >14 days | Low |

## Affected Components

### Backend
- `capstone-api/helper/inventory-reminder.helper.ts`
- `capstone-api/app/inventory/inventory.controller.ts` (uses the helper)

### Frontend
- `capstone-app/src/utils/inventoryReminder.ts`
- `capstone-app/src/hooks/useInventoryReminder.ts` (uses the utility)
- `capstone-app/src/components/organisms/StudentDashboardContent.tsx` (displays the modal)
- `capstone-app/src/components/molecules/InventoryReminderModal.tsx` (notification UI)

## Data Structure Reference

### Old Structure (Clinical Assessment)
```typescript
{
  mentalHealthRisk: {
    level: "low" | "moderate" | "high" | "critical",
    description: string,
    needsAttention: boolean,
    urgency: string,
    assessmentSummary: string,
    disclaimer: string
  }
}
```

### New Structure (ML Predictions)
```typescript
{
  mlPredictions: {
    anxiety: {
      riskLevel: "low risk" | "moderate risk" | "high risk",
      riskScore: number,
      confidence: number,
      prediction: "Low Risk" | "Moderate Risk" | "High Risk",
      explanation: string,
      modelBasis: string,
      riskFactors: string[],
      recommendations: string[],
      immediateAction: string?
    },
    depression: { /* same structure */ },
    stress: { /* same structure */ },
    modelAccuracy: object,
    trainingDataSize: number,
    lastTrainingDate: Date
  }
}
```

## Testing Recommendations

1. **Test with New ML Predictions**
   - Create/update an inventory with ML predictions
   - Verify risk level is correctly extracted from mlPredictions
   - Check notification appears at appropriate times

2. **Test Backward Compatibility**
   - Use existing inventory records with old structure
   - Verify fallback to mentalHealthRisk.level works
   - Ensure no errors occur

3. **Test Risk Level Priority**
   - Create predictions with different risk levels for anxiety, depression, stress
   - Verify the highest risk level is used for reminder calculation
   - Example: anxiety="low risk", depression="high risk", stress="moderate risk"
     → Should use "high" risk level

4. **Test Notification Dismissal**
   - Dismiss notification and verify it doesn't reappear for 24 hours
   - Wait 24 hours and verify it reappears if still needed

5. **Test Different Time Windows**
   - Test when overdue (should show critical severity)
   - Test when due in 3 days (should show high severity)
   - Test when due in 10 days (should show medium severity)
   - Test when due in 25 days (should show low severity)

## Migration Notes

- **No database migration required** - Changes are code-level only
- **Backward compatible** - Old records will continue to work
- **No breaking changes** - API responses remain the same structure
- **Gradual transition** - New inventories will use ML predictions, old ones continue with clinical assessments

## Related Files

- Schema: `capstone-api/prisma/schema/inventoryRecord.prisma`
- ML Trainer: `capstone-api/helper/ml-trainer.helper.ts`
- ML Helper: `capstone-api/helper/ml.helper.ts`
- Inventory Service: `capstone-app/src/services/inventory.service.ts`

## Additional Fix: Student Report Generation

### Issue Found
During testing, an error was discovered in the student report generation system:

```
Unknown field `individualInventory` for include statement on model `Student`. Available options are marked with ?.
```

### Root Cause
The `word-document.helper.ts` file was using the incorrect field name `individualInventory` (singular) when querying the Student model, but the actual relationship name in the Prisma schema is `individualInventories` (plural).

### Fix Applied
**File**: `capstone-api/helper/word-document.helper.ts`

1. **Prisma Query Fix** (Line 272):
   ```typescript
   // Before
   individualInventory: {
     include: { ... }
   }

   // After
   individualInventories: {
     where: { isDeleted: false },
     orderBy: { createdAt: "desc" },
     take: 1, // Get only the most recent inventory
     include: { ... }
   }
   ```

2. **Data Processing Fix** (Line 301):
   ```typescript
   // Before
   const { person, individualInventory, consent } = studentData;
   const inventory = individualInventory || {};

   // After
   const { person, individualInventories, consent } = studentData;
   const inventory = individualInventories?.[0] || {};
   ```

### Impact
This fix ensures that:
- Student mental health assessment reports can be generated successfully
- The system uses the most recent inventory record for report generation
- Proper error handling when no inventory exists
- Backward compatibility with existing data structure

## Additional Fix: Student Report ML Predictions

### Issue Found
The student mental health assessment report generation was still using the old clinical assessment structure (`mentalHealthRisk`) instead of the new ML predictions (`mlPredictions`) for the "Mental Health Prediction" section.

### Root Cause
In `word-document.helper.ts`, the report formatting function was extracting prediction data from:
- `prediction.mentalHealthRisk?.level` (old structure)
- `prediction.mentalHealthRisk?.urgency` (old structure) 
- `prediction.mentalHealthRisk?.description` (old structure)

Instead of using the new ML predictions structure:
- `prediction.mlPredictions.anxiety.riskLevel`
- `prediction.mlPredictions.depression.riskLevel`
- `prediction.mlPredictions.stress.riskLevel`

### Fix Applied
**File**: `capstone-api/helper/word-document.helper.ts`

1. **Added Helper Functions**:
   - `normalizeRiskLevel()` - Converts "low risk" → "low", "moderate risk" → "moderate"
   - `getHighestRiskFromMLPredictions()` - Gets highest priority risk level from all conditions
   - `getCombinedMLRecommendations()` - Combines recommendations from all conditions
   - `getCombinedMLRiskFactors()` - Combines risk factors from all conditions

2. **Updated Prediction Data Extraction**:
   ```typescript
   // NEW: Prioritize ML predictions
   if (prediction.mlPredictions) {
     const highestRisk = getHighestRiskFromMLPredictions(prediction.mlPredictions);
     // Extract data from ML structure
   }
   // FALLBACK: Use legacy clinical assessment  
   else if (prediction.mentalHealthRisk) {
     // Use old structure for backward compatibility
   }
   ```

3. **Enhanced Report Data**:
   - **Risk Level**: Shows highest risk among anxiety, depression, stress
   - **Description**: "ML prediction based on [condition] assessment showing [level] risk"
   - **Assessment Summary**: "Machine learning model identified [level] risk level primarily from [condition] indicators"
   - **Urgency**: Auto-calculated based on risk level (high/critical = immediate, others = none)
   - **Risk Factors**: Combined from all three conditions (deduplicated)
   - **Recommendations**: Combined from all three conditions (deduplicated)

4. **Debug Logging**:
   ```typescript
   if (prediction.mlPredictions) {
     docLogger.info("Using NEW ML Predictions structure for report generation");
   } else if (prediction.mentalHealthRisk) {
     docLogger.info("Using LEGACY clinical assessment structure for report generation");
   }
   ```

### Before vs After

**Before (Old Clinical Assessment)**:
- Risk Level: "low"
- Description: "Legacy field - see mentalHealthPredictions for actual data"
- Assessment Summary: "Data migrated to mentalHealthPredictions structure"

**After (New ML Predictions)**:
- Risk Level: "stress: high" (shows only the highest risk condition with its level)
- Description: "ML prediction based on depression assessment showing moderate risk"
- Assessment Summary: "Machine learning model identified moderate risk level primarily from depression indicators"
- Risk Factors: Combined unique factors from all conditions
- Recommendations: Combined unique recommendations from all conditions

### Impact
- ✅ Student reports now display current ML prediction data instead of placeholder text
- ✅ Risk Level field shows the primary concern condition with its specific level (e.g., "stress: high")
- ✅ Reports focus on the most relevant condition (highest risk) for clear actionable insight
- ✅ Risk factors and recommendations are comprehensive (all conditions combined)
- ✅ Maintains backward compatibility with old prediction records
- ✅ Proper logging for debugging which prediction structure is used

### Enhanced Risk Level Display Format
The Risk Level field now shows only the highest priority mental health condition:
- **Format**: `"condition: level"`
- **Example**: `"stress: high"` (if stress has the highest risk among all conditions)
- **Logic**: Shows anxiety > depression > stress when risk levels are equal
- **Fallback**: If ML predictions unavailable, shows single risk level from legacy structure

This provides counselors with a focused view of the primary mental health concern that requires immediate attention.

## Future Enhancements

1. Add condition-specific reminders (e.g., "Your anxiety level is high, consider updating")
2. Implement progressive notification frequency (increase reminders as overdue period grows)
3. Add email/SMS notifications for critical/high risk overdue updates
4. Create admin dashboard to monitor overdue inventory updates
5. Add analytics to track notification effectiveness and update compliance rates