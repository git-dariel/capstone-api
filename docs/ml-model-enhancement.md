# Mental Health Prediction ML Model Enhancement

## Overview

Enhanced the ML prediction model to include test results, psychological health details, and significant incidents/notes as critical factors in mental health risk assessment. This provides a more comprehensive analysis of student mental health status.

## New Features Added

### 1. Test Results Integration

- **Test Name**: Type of standardized test (e.g., PUPCET, AP, diagnostic tests)
- **Test Result Score**: Raw score on standardized tests (0-100 scale)
- **Test Percentile Rank**: Percentile ranking compared to test population (0-100)

**Risk Factors Triggered:**

- Score < 50: "Low test performance score" (Critical, +3 risk points)
- Percentile Rank < 25: "Below 25th percentile in standardized tests" (Critical, +2 risk points)

**CSV Data Mapping:**

- Column: "Name of Test: ex: PUPCET"
- Column: "Result Score:"
- Column: "Percentile Rank: ex: 85%"

### 2. Psychological Health Consultation Details

Three-level tracking of mental health professional consultations:

#### Psychologist Consultation

- **Field**: `psychologicalConsultation` (yes/no)
- **Reason**: `psychologicalConsultationReason` (text description)
- **Risk Factor**: "Previous psychological consultation" (Moderate, +1 point)
- **Enhanced with reason**: "Psychology consultation reason: {reason}"

#### Psychiatrist Consultation

- **Field**: `psychiatristConsultation` (yes/no)
- **Reason**: `psychiatristConsultationReason` (text description)
- **Risk Factor**: "Psychiatrist consultation history - significant mental health concern" (Critical, +4 risk points)
- **Enhanced with reason**: "Psychiatric concern: {reason}"
- **Clinical Significance**: Direct reference to psychiatrist is weighted much higher than psychologist due to severity

#### Counselor Consultation

- **Field**: `counselorConsultation` (yes/no)
- **Reason**: `counselorConsultationReason` (text description)
- **Risk Factor**: "Counselor consultation history" (Moderate, +1 point)
- **Enhanced with reason**: "Counselor consultation reason: {reason}"

**CSV Data Mapping:**

- Columns: "Psychiatrist:", "When?:", "For what?:"
- Columns: "Psychologist:", "When?:", "For what?:"
- Columns: "Counselor:", "When?:", "For what?:"

### 3. Significant Incidents and Behavioral Notes

- **Field**: `significantIncidents` (yes/no or text)
- **Remarks**: `significantIncidentsRemarks` (detailed notes)
- **Risk Factor**: "Documented significant incidents or behavioral concerns" (Critical, +3 risk points)
- **Enhanced with notes**: "Incident notes: {remarks}"

**Clinical Use:** Counselor can document significant behavioral changes, disciplinary incidents, crisis events, or notable personal situations

**CSV Data Mapping:**

- Column: "SignificantNotesGuidanceOnly" type field in schema
- Available fields: `date`, `incident`, `remarks`

## Enhanced Risk Scoring Algorithm

### Critical Risk Factors (Higher Weight)

These factors now carry increased weight in risk assessment:

- Below average academic performance: +3 points
- Previous psychological consultation: +3 points
- Psychiatrist consultation history: +3 points
- Documented significant incidents: +3 points
- Low test performance: +3 points
- Below 25th percentile: +2 points
- Financial constraints: +3 points
- Physical health challenges: +3 points

### Moderate Risk Factors

- Interrupted schooling history: +1 point
- Non-traditional family structure: +1 point
- Counselor consultation history: +1 point
- Lack of proper study environment: +1 point
- Housing instability: +1 point
- Limited academic social engagement: +1 point
- Large family size: +1 point
- Age-related adjustment challenges: +1 point

### Updated Risk Levels

```
Risk Score | Level    | Urgency    | Recommendation
-----------|----------|------------|----------------------------------
≥ 12       | Critical | Immediate  | Professional intervention & evaluation
8-11       | High     | Schedule   | Psychological consultation advised
4-7        | Moderate | Monitor    | Academic support & counseling
< 4        | Low      | None       | Continue monitoring well-being
```

## Data Model Updates

### StudentData Interface

New fields added:

```typescript
// Psychological Health Details
psychologicalConsultationReason?: string;
psychiatristConsultation?: string;
psychiatristConsultationReason?: string;
counselorConsultation?: string;
counselorConsultationReason?: string;

// Test Results
testName?: string;
testResultScore?: number;
testPercentileRank?: number;

// Significant Notes/Incidents
significantIncidents?: string;
significantIncidentsRemarks?: string;
```

### Feature Engineering

- **Total Features**: 20 (previously 15)
- New features encoded as:
    - `psychiatristEncoded`: Binary (0/1) - consultation history
    - `counselorEncoded`: Binary (0/1) - consultation history
    - `testScoreNormalized`: Float (0-1) - normalized from 0-100 scale
    - `testPercentileNormalized`: Float (0-1) - normalized from 0-100 scale
    - `hasSignificantIncidents`: Binary (0/1) - presence of incidents

### Feature Names Array (Updated)

```typescript
[
	"Gender",
	"Age",
	"High School Average",
	"Nature of Schooling",
	"Parents Marital Relationship",
	"Number of Children",
	"Who finances your schooling?",
	"Parents Total Monthly Income",
	"Quiet Place to Study",
	"Nature of Residence",
	"Vision Problems",
	"General Health Problems",
	"Psychological Consultation",
	"Psychiatrist Consultation", // NEW
	"Counselor Consultation", // NEW
	"Test Result Score", // NEW
	"Test Percentile Rank", // NEW
	"Has Significant Incidents", // NEW
	"Academic Organizations",
	"Organization Position",
];
```

## API Integration

### Updated predictMentalHealth Endpoint

New request body parameters:

```json
{
	"psychologicalConsultationReason": "Anxiety and depression assessment",
	"psychiatristConsultation": "yes",
	"psychiatristConsultationReason": "Treatment for generalized anxiety disorder",
	"counselorConsultation": "yes",
	"counselorConsultationReason": "Family conflict and academic stress",
	"testName": "PUPCET",
	"testResultScore": 42,
	"testPercentileRank": 18,
	"significantIncidents": "yes",
	"significantIncidentsRemarks": "Reported stress due to family problems, improved after counseling"
}
```

### Data Population Strategy

1. **From Request Body**: Direct parameters take priority
2. **From Existing Inventory**: Falls back to stored health/test/incident data
3. **From Defaults**: Uses sensible defaults if neither available

```typescript
psychologicalConsultationReason:
  psychologicalConsultationReason ||
  existingInventory.health?.psychological?.for_what ||
  "",

testResultScore:
  testResultScore ||
  (existingInventory.test_results?.rs ? parseInt(existingInventory.test_results.rs) : 0)
```

## Assessment Improvements

### Risk Description Updates

More detailed clinical descriptions based on new factors:

**Critical Level:**

> "Student shows multiple indicators of significant academic, psychological, and personal challenges. Immediate professional intervention, psychological evaluation, and comprehensive support are strongly recommended. Consider referral to mental health services."

**High Level:**

> "Student displays concerning patterns in academic performance, test results, and/or psychological history. Professional psychological consultation and academic support strongly recommended. Follow-up counseling sessions advised."

## Testing Recommendations

### Test Scenarios

1. **Low Risk**: No consultations, good test scores, no incidents
2. **Moderate Risk**: Counselor consultation, average test scores
3. **High Risk**: Psychologist consultation + low test scores
4. **Critical Risk**: Psychiatrist consultation + behavioral incidents + poor academic performance

### CSV Data Source

The IIF.csv file contains all necessary data fields:

- High School General Average
- Psychiatrist/Psychologist/Counselor consultation details
- Test results (PUPCET format)
- Academic organization participation
- Family and socioeconomic details

## Future Enhancements

1. **Temporal Analysis**: Track consultation frequency over time
2. **Severity Scaling**: Weight recent incidents more heavily
3. **Intervention Tracking**: Monitor student progress after interventions
4. **ML Retraining**: Periodically retrain models with new prediction outcomes
5. **Predictive Intervention**: Suggest preventive measures based on risk factors

## Migration Notes

No database migration required - all new fields are optional and stored in existing complex types:

- `health.psychological` - stores consultation details
- `test_results` - stores test performance
- `significant_notes_councilor_only` - stores incident notes

Existing records will use defaults when these fields are not populated.
