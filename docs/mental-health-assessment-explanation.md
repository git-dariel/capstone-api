# Mental Health Assessment Results - What You'll Get

## Direct Answer to Your Question: "Will it tell me the student possibly has mental health issues?"

**YES!** The enhanced system now provides clear mental health risk assessment that directly indicates if a student potentially has mental health concerns.

## What the System Will Tell You:

### 🔴 **Critical Risk Response Example:**

```json
{
	"mentalHealthRisk": {
		"level": "Critical",
		"description": "Student shows multiple indicators of significant mental health concerns. Immediate professional intervention recommended.",
		"needsAttention": true,
		"urgency": "Immediate",
		"assessmentSummary": "⚠️ ATTENTION NEEDED: Student shows multiple indicators of significant mental health concerns. Immediate professional intervention recommended."
	}
}
```

### 🟠 **High Risk Response Example:**

```json
{
	"mentalHealthRisk": {
		"level": "High",
		"description": "Student displays concerning patterns that suggest potential mental health issues. Professional consultation strongly recommended.",
		"needsAttention": true,
		"urgency": "Schedule",
		"assessmentSummary": "⚠️ ATTENTION NEEDED: Student displays concerning patterns that suggest potential mental health issues. Professional consultation strongly recommended."
	}
}
```

### 🟡 **Moderate Risk Response Example:**

```json
{
	"mentalHealthRisk": {
		"level": "Moderate",
		"description": "Student shows some risk factors that warrant attention. Consider counseling services and stress management resources.",
		"needsAttention": true,
		"urgency": "Monitor",
		"assessmentSummary": "⚠️ ATTENTION NEEDED: Student shows some risk factors that warrant attention. Consider counseling services and stress management resources."
	}
}
```

### 🟢 **Low Risk Response Example:**

```json
{
	"mentalHealthRisk": {
		"level": "Low",
		"description": "Student appears to be managing well with minimal risk indicators. Continue monitoring and maintain healthy habits.",
		"needsAttention": false,
		"urgency": "None",
		"assessmentSummary": "✅ LOW RISK: Student appears to be managing well with minimal risk indicators. Continue monitoring and maintain healthy habits."
	}
}
```

## Real-World Scenarios:

### Scenario 1: Student with Sleep Issues + High Stress

**Input:** Sleep 4 hours, High stress, Academic decline
**Output:**

- **Level:** "Critical"
- **Message:** "⚠️ ATTENTION NEEDED: Student shows multiple indicators of significant mental health concerns."
- **Action:** Immediate professional intervention recommended

### Scenario 2: Student with Moderate Concerns

**Input:** Sleep 6 hours, Medium stress, Same performance
**Output:**

- **Level:** "Moderate"
- **Message:** "⚠️ ATTENTION NEEDED: Student shows some risk factors that warrant attention."
- **Action:** Consider counseling services

### Scenario 3: Healthy Student

**Input:** Sleep 8 hours, Low stress, Improved performance
**Output:**

- **Level:** "Low"
- **Message:** "✅ LOW RISK: Student appears to be managing well."
- **Action:** Continue monitoring

## Key Indicators That Trigger Mental Health Concerns:

### 🚨 **Immediate Red Flags** (Critical/High Risk):

- Sleep less than 4-6 hours per night
- High stress levels combined with academic decline
- Multiple risk factors present simultaneously
- Combination of poor sleep + high stress + declining grades

### ⚠️ **Warning Signs** (Moderate Risk):

- Irregular sleep patterns (too much or too little)
- Elevated stress with stable academics
- Age-related adjustment challenges
- Single concerning factor present

### ✅ **Positive Indicators** (Low Risk):

- 7-9 hours of sleep nightly
- Low to moderate stress levels
- Stable or improving academic performance
- No significant risk factors

## How to Interpret the Results:

1. **Check `needsAttention` field**:

    - `true` = Student needs some level of intervention
    - `false` = Student appears to be managing well

2. **Review `urgency` level**:

    - `"Immediate"` = Contact student/counselor today
    - `"Schedule"` = Arrange consultation within days
    - `"Monitor"` = Keep an eye on student, check regularly
    - `"None"` = Normal monitoring sufficient

3. **Read `assessmentSummary`**:

    - Starts with ⚠️ = Attention needed
    - Starts with ✅ = Low risk

4. **Follow `recommendations`**:
    - Specific actionable steps for each student
    - Tailored based on their risk factors

## Sample Full Response for High-Risk Student:

```json
{
	"message": "Consent created successfully with mental health prediction",
	"consent": { "id": "...", "studentId": "...", "sleep_duration": "4.5", "stress_level": "high" },
	"mentalHealthPrediction": {
		"academicPerformanceOutlook": "Declined",
		"confidence": "87.3%",
		"riskFactors": [
			"Insufficient sleep (< 6 hours)",
			"High stress levels",
			"Combined high stress and sleep deprivation"
		],
		"mentalHealthRisk": {
			"level": "Critical",
			"description": "Student shows multiple indicators of significant mental health concerns. Immediate professional intervention recommended.",
			"needsAttention": true,
			"urgency": "Immediate",
			"assessmentSummary": "⚠️ ATTENTION NEEDED: Student shows multiple indicators of significant mental health concerns. Immediate professional intervention recommended."
		},
		"recommendations": [
			"Consider scheduling a consultation with a mental health professional",
			"Implement stress reduction techniques such as meditation or deep breathing exercises",
			"Establish a consistent sleep schedule",
			"Focus on improving sleep hygiene and maintaining 7-9 hours of sleep per night",
			"Implement stress management techniques and consider counseling services"
		]
	}
}
```

## Bottom Line:

**YES, the system will explicitly tell you:**

- If a student possibly has mental health issues
- How serious the concern level is (Low/Moderate/High/Critical)
- Whether immediate attention is needed
- What specific actions to take
- Clear warning messages with ⚠️ or ✅ indicators

The assessment is data-driven, combining academic performance predictions with specific risk factors to provide clear, actionable mental health insights.
