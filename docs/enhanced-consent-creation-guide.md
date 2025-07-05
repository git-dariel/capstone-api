# Enhanced Consent Creation with Automatic Mental Health Prediction

## Sample JSON for Testing Create Consent with Automatic Prediction

### Endpoint: POST /api/consent

### High-Risk Student Example (Likely "Declined" prediction):

```json
{
	"studentId": "replace-with-actual-student-id",
	"referred": "faculty",
	"with_whom_do_you_live": "alone",
	"financial_status": "always_stressful",
	"what_brings_you_to_guidance": "Struggling with academics and feeling overwhelmed with stress",
	"physical_problem": "yes",
	"physical_symptoms": "insomnia",
	"concerns": {
		"academic": "very_high",
		"emotional": "high",
		"social": "medium",
		"financial": "very_high",
		"family": "low"
	},
	"services": "individual_counseling",
	"sleep_duration": "4.5",
	"stress_level": "high",
	"academic_performance_change": "declined"
}
```

### Medium-Risk Student Example (Likely "Same" prediction):

```json
{
	"studentId": "replace-with-actual-student-id",
	"referred": "self",
	"with_whom_do_you_live": "roommates",
	"financial_status": "sometimes_stressful",
	"what_brings_you_to_guidance": "Need guidance on stress management techniques",
	"physical_problem": "no",
	"physical_symptoms": "muscle_tension",
	"concerns": {
		"academic": "medium",
		"emotional": "medium",
		"social": "low",
		"financial": "medium"
	},
	"services": "stress_management",
	"sleep_duration": "6.5",
	"stress_level": "medium",
	"academic_performance_change": "same"
}
```

### Low-Risk Student Example (Likely "Improved" prediction):

```json
{
	"studentId": "replace-with-actual-student-id",
	"referred": "self",
	"with_whom_do_you_live": "guardians",
	"financial_status": "rarely_stressful",
	"what_brings_you_to_guidance": "Seeking general information and resources for personal growth",
	"physical_problem": "no",
	"physical_symptoms": "stomach_discomfort",
	"concerns": {
		"academic": "low",
		"emotional": "low",
		"social": "low",
		"career": "medium"
	},
	"services": "general_information",
	"sleep_duration": "8.0",
	"stress_level": "low",
	"academic_performance_change": "improved"
}
```

## What Happens Automatically:

1. **Consent Creation**: The system creates a new consent record with all provided data
2. **Data Validation**: All enum values are validated according to the schema
3. **Automatic Prediction**: The system immediately runs a mental health prediction using:
    - Sleep duration from the consent
    - Stress level from the consent
    - Student's age and gender from their profile
    - Default education level
4. **Comprehensive Response**: Returns both the consent data and prediction results

## Expected Response Structure:

```json
{
	"message": "Consent created successfully with mental health prediction",
	"disclaimer": "⚠️ IMPORTANT NOTICE: This mental health prediction is for screening purposes only and should not be considered a professional diagnosis. For accurate mental health assessment, please utilize our comprehensive resources and consult with qualified mental health professionals.",
	"consent": {
		// Full consent object with student and person details
	},
	"mentalHealthPrediction": {
		"academicPerformanceOutlook": "Declined", // or "Same" or "Improved"
		"confidence": "85.7%",
		"modelAccuracy": {
			"decisionTree": "68.4%",
			"randomForest": "71.7%"
		},
		"riskFactors": ["Insufficient sleep (< 6 hours)", "High stress levels"],
		"mentalHealthRisk": {
			"level": "High", // "Low", "Moderate", "High", or "Critical"
			"description": "Student displays concerning patterns that suggest potential mental health issues. Professional consultation strongly recommended.",
			"needsAttention": true,
			"urgency": "Schedule", // "None", "Monitor", "Schedule", or "Immediate"
			"assessmentSummary": "⚠️ ATTENTION NEEDED: Student displays concerning patterns that suggest potential mental health issues. Professional consultation strongly recommended.",
			"disclaimer": "⚠️ IMPORTANT: This is only a prediction based on preliminary data. If you want to determine if you really have mental health issues, please continue to answer our comprehensive resources available for professional mental health assessments."
		},
		"inputData": {
			"gender": "Female",
			"age": 20,
			"educationLevel": "BA",
			"sleepDuration": 4.5,
			"stressLevel": "High"
		},
		"recommendations": [
			"Consider scheduling a consultation with a mental health professional",
			"Implement stress reduction techniques such as meditation or deep breathing exercises",
			"Establish a consistent sleep schedule",
			"Focus on improving sleep hygiene and maintaining 7-9 hours of sleep per night"
		]
	}
}
```

## Mental Health Risk Assessment Levels:

### 🟢 **Low Risk**

- **Level**: "Low"
- **Urgency**: "None"
- **Message**: "✅ LOW RISK: Student appears to be managing well with minimal risk indicators."
- **Action**: Continue monitoring and maintain healthy habits

### 🟡 **Moderate Risk**

- **Level**: "Moderate"
- **Urgency**: "Monitor"
- **Message**: "⚠️ ATTENTION NEEDED: Student shows some risk factors that warrant attention."
- **Action**: Consider counseling services and stress management resources

### 🟠 **High Risk**

- **Level**: "High"
- **Urgency**: "Schedule"
- **Message**: "⚠️ ATTENTION NEEDED: Student displays concerning patterns that suggest potential mental health issues."
- **Action**: Professional consultation strongly recommended

### 🔴 **Critical Risk**

- **Level**: "Critical"
- **Urgency**: "Immediate"
- **Message**: "⚠️ ATTENTION NEEDED: Student shows multiple indicators of significant mental health concerns."
- **Action**: Immediate professional intervention recommended

## ⚠️ Important Disclaimer:

**This mental health prediction is for screening purposes only and should NOT be considered a professional diagnosis.**

- The prediction is based on limited data points from the consent form and machine learning algorithms
- It provides an initial screening to identify students who may need attention
- For accurate mental health assessment, students should utilize comprehensive resources and consult with qualified mental health professionals
- The prediction should be used as a supplementary tool alongside proper clinical assessment
- This is only a prediction - if you want to determine if you really have mental health issues, please continue to answer our comprehensive resources available for professional mental health assessments

## How the Mental Health Assessment Works:

### Risk Scoring Algorithm:

The system uses a comprehensive scoring algorithm that evaluates:

1. **Academic Performance Prediction** (0-3 points):

    - "Declined" = 3 points
    - "Same" = 1 point
    - "Improved" = 0 points

2. **Critical Risk Factors** (2 points each):

    - Insufficient sleep (< 6 hours)
    - High stress levels
    - Combined high stress + sleep deprivation
    - Extremely poor sleep (< 4 hours)

3. **Moderate Risk Factors** (1 point each):

    - Excessive sleep (> 9 hours)
    - Age-related adjustment challenges

4. **Combined Risk Multipliers**:
    - High stress + Declined performance = +2 points
    - Sleep deprivation + High stress = +2 points

### Mental Health Risk Interpretation:

- **Score 0-2**: ✅ **Low Risk** - Student is managing well
- **Score 3-4**: 🟡 **Moderate Risk** - Some attention needed
- **Score 5-6**: 🟠 **High Risk** - Professional consultation recommended
- **Score 7+**: 🔴 **Critical Risk** - Immediate intervention needed

### Example Assessment:

**Student with High Risk:**

```json
{
	"sleepDuration": 4.5, // +2 (< 4 hours)
	"stressLevel": "High", // +2 (high stress)
	"prediction": "Declined", // +3 (academic decline)
	"combined": true // +2 (high stress + declined)
}

// Total Score: 9 = Critical Risk
```

**Result**: "⚠️ ATTENTION NEEDED: Student shows multiple indicators of significant mental health concerns. Immediate professional intervention recommended."

## Error Handling:

If the mental health prediction fails for any reason, the consent will still be created successfully, but the response will include:

```json
{
	"message": "Consent created successfully (mental health prediction unavailable)",
	"consent": {
		// Full consent object
	},
	"mentalHealthPrediction": {
		"error": "Prediction service temporarily unavailable",
		"note": "Consent was created successfully, but mental health prediction could not be generated at this time."
	}
}
```

## Testing Steps:

1. Ensure you have a valid `studentId` from your database
2. Set request method to POST
3. Set URL to: `http://your-api-base-url/api/consent`
4. Set Content-Type header to `application/json`
5. Add authentication headers if required
6. Use one of the sample JSON bodies above
7. Send request and observe both consent creation and automatic prediction results

## Key Benefits:

- **Immediate Intervention**: Automatically identifies students who may need immediate support
- **Data-Driven Insights**: Uses actual consent data for more accurate predictions
- **Streamlined Workflow**: No separate API calls needed for prediction
- **Comprehensive Assessment**: Combines intake data with predictive analytics
- **Actionable Recommendations**: Provides immediate guidance for counselors
