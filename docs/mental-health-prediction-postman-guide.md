# Mental Health Prediction API - Sample JSON for Postman

## Enhanced Create Consent with Automatic Prediction

### NEW: Consent Creation with Automatic Mental Health Prediction

When you create a new consent using `POST /api/consent`, the system now automatically performs a mental health prediction and includes the results in the response.

#### Sample JSON Body for Creating Consent (which will include prediction):

```json
{
	"studentId": "60f7b3b3b3b3b3b3b3b3b3b3",
	"referred": "self",
	"with_whom_do_you_live": "guardians",
	"financial_status": "sometimes_stressful",
	"what_brings_you_to_guidance": "Academic stress and sleep issues",
	"physical_problem": "yes",
	"physical_symptoms": "headaches",
	"concerns": {
		"academic": "high",
		"social": "medium",
		"financial": "low"
	},
	"services": "stress_management",
	"sleep_duration": "5.5",
	"stress_level": "high",
	"academic_performance_change": "declined"
}
```

#### Expected Response from Create Consent:

```json
{
	"message": "Consent created successfully with mental health prediction",
	"consent": {
		"id": "60f7b3b3b3b3b3b3b3b3b3b4",
		"studentId": "60f7b3b3b3b3b3b3b3b3b3b3",
		"referred": "self",
		"financial_status": "sometimes_stressful",
		"sleep_duration": "5.5",
		"stress_level": "high",
		"academic_performance_change": "declined",
		"student": {
			"person": {
				"firstName": "Jane",
				"lastName": "Doe",
				"age": 20,
				"gender": "female"
			}
		},
		"createdAt": "2025-07-06T12:00:00.000Z"
	},
	"mentalHealthPrediction": {
		"academicPerformanceOutlook": "Declined",
		"confidence": "85.7%",
		"modelAccuracy": {
			"decisionTree": "68.4%",
			"randomForest": "71.7%"
		},
		"riskFactors": ["Insufficient sleep (< 6 hours)", "High stress levels"],
		"inputData": {
			"gender": "Female",
			"age": 20,
			"educationLevel": "BA",
			"sleepDuration": 5.5,
			"stressLevel": "High"
		},
		"recommendations": [
			"Consider scheduling a consultation with a mental health professional",
			"Implement stress reduction techniques such as meditation or deep breathing exercises",
			"Establish a consistent sleep schedule",
			"Engage in regular physical activity",
			"Focus on improving sleep hygiene and maintaining 7-9 hours of sleep per night",
			"Implement stress management techniques and consider counseling services"
		]
	}
}
```

### Benefits of Integrated Prediction:

1. **Immediate Assessment**: Mental health prediction is automatically generated upon consent creation
2. **Comprehensive Data**: Uses both consent data and student profile information
3. **Actionable Insights**: Provides immediate recommendations for intervention
4. **Streamlined Workflow**: No need for separate prediction API calls

---

## Standalone Prediction Endpoint

## Endpoint: POST /api/consent/predict/{studentId}

### Sample JSON Body for Mental Health Prediction

```json
{
	"gender": "Female",
	"age": 20,
	"educationLevel": "BTech",
	"sleepDuration": 6.5,
	"stressLevel": "Medium"
}
```

### Alternative Test Cases

#### High Risk Student (Likely "Declined" prediction):

```json
{
	"gender": "Male",
	"age": 22,
	"educationLevel": "MTech",
	"sleepDuration": 4.5,
	"stressLevel": "High"
}
```

#### Low Risk Student (Likely "Improved" prediction):

```json
{
	"gender": "Female",
	"age": 19,
	"educationLevel": "BSc",
	"sleepDuration": 8.2,
	"stressLevel": "Low"
}
```

#### Medium Risk Student (Likely "Same" prediction):

```json
{
	"gender": "Other",
	"age": 21,
	"educationLevel": "BA",
	"sleepDuration": 7.0,
	"stressLevel": "Medium"
}
```

### Field Descriptions:

- **gender** (optional): Student's gender

    - Allowed values: "Male", "Female", "Other"
    - Default: Uses student's person record or "Other"

- **age** (optional): Student's age

    - Range: 10-100
    - Default: Uses student's person record or 20

- **educationLevel** (optional): Student's education level

    - Allowed values: "Class 8", "Class 9", "Class 10", "Class 11", "Class 12", "BA", "BSc", "BTech", "MA", "MSc", "MTech"
    - Default: "BA"

- **sleepDuration** (optional): Average sleep duration in hours

    - Range: 0-24
    - Default: 7

- **stressLevel** (optional): Student's current stress level
    - Allowed values: "Low", "Medium", "High"
    - Default: "Medium"

### Expected Response:

```json
{
	"message": "Mental health prediction completed successfully",
	"disclaimer": "⚠️ IMPORTANT NOTICE: This mental health prediction is for screening purposes only and should not be considered a professional diagnosis. For accurate mental health assessment, please utilize our comprehensive resources and consult with qualified mental health professionals.",
	"studentId": "60f7b3b3b3b3b3b3b3b3b3b3",
	"prediction": {
		"academicPerformanceOutlook": "Same",
		"confidence": "75.2%",
		"modelAccuracy": {
			"decisionTree": "68.4%",
			"randomForest": "71.7%"
		},
		"riskFactors": ["Monitor sleep patterns and stress levels regularly"],
		"mentalHealthRisk": {
			"level": "Moderate",
			"description": "Student shows some risk factors that warrant attention.",
			"needsAttention": true,
			"urgency": "Monitor",
			"assessmentSummary": "⚠️ ATTENTION NEEDED: Student shows some risk factors that warrant attention.",
			"disclaimer": "⚠️ IMPORTANT: This is only a prediction based on preliminary data. If you want to determine if you really have mental health issues, please continue to answer our comprehensive resources available for professional mental health assessments."
		},
		"inputData": {
			"gender": "Female",
			"age": 20,
			"educationLevel": "BTech",
			"sleepDuration": 6.5,
			"stressLevel": "Medium"
		},
		"recommendations": [
			"Maintain current healthy habits",
			"Monitor stress levels regularly",
			"Continue with regular sleep pattern"
		]
	}
}
```

### ⚠️ Important Disclaimer:

**This mental health prediction is for screening purposes only and should NOT be considered a professional diagnosis.**

- The prediction is based on limited data points and machine learning algorithms
- It provides an initial screening to identify students who may need attention
- For accurate mental health assessment, students should utilize comprehensive resources and consult with qualified mental health professionals
- The prediction should be used as a supplementary tool alongside proper clinical assessment

### Machine Learning Model Information:

This endpoint uses two algorithms for prediction:

1. **Decision Tree Algorithm**:

    - Uses rule-based logic to analyze sleep patterns, stress levels, age, and education
    - Focuses on individual decision points and thresholds

2. **Random Forest Algorithm**:
    - Ensemble method using multiple decision trees
    - Combines predictions from multiple rule sets for better accuracy
    - Generally more robust and accurate than single decision tree

### Prediction Categories:

- **"Improved"**: Student's academic performance is likely to improve
- **"Same"**: Student's academic performance is likely to remain stable
- **"Declined"**: Student may experience decline in academic performance and should consider support

### Model Accuracy:

The models are trained on the provided CSV dataset and show accuracy metrics in the response. The accuracy is calculated using cross-validation on the training data.

### Prerequisites:

1. Student must exist in the database
2. Student must have a consent record
3. All input parameters are optional - defaults will be used from student records or system defaults

### Testing Steps in Postman:

1. Set the request method to POST
2. Set the URL to: `http://your-api-base-url/api/consent/predict/{replace-with-actual-studentId}`
3. Set Content-Type header to `application/json`
4. Add any authentication headers required by your API
5. Use one of the sample JSON bodies above in the request body
6. Send the request and observe the prediction results
