# CSV Export with Filtering - Mental Health Assessment API

This document provides comprehensive guidance on using the CSV export functionality with advanced filtering capabilities for student mental health data.

## Overview

The CSV export endpoint allows guidance counselors and administrators to export student mental health assessment data with powerful filtering options. This feature enables targeted data analysis, reporting, and intervention planning.

## Endpoint

```
GET /api/users/export-csv
```

## Authentication & Authorization

- **Required Role**: `admin` or `super_admin`
- **Authentication**: JWT Bearer token required
- **Headers**:
    ```http
    Authorization: Bearer <your-jwt-token>
    Content-Type: application/json
    ```

## Available Filters

### Student Information Filters

| Parameter   | Type   | Description                                                 | Example                                     |
| ----------- | ------ | ----------------------------------------------------------- | ------------------------------------------- |
| `program`   | string | Filter by student program (partial match, case insensitive) | `Computer Science`, `Engineering`           |
| `status`    | string | Filter by academic status                                   | `freshman`, `sophomore`, `junior`, `senior` |
| `firstName` | string | Filter by first name (partial match, case insensitive)      | `Maria`, `Juan`                             |
| `lastName`  | string | Filter by last name (partial match, case insensitive)       | `Garcia`, `Santos`                          |
| `studentId` | string | Filter by specific student ID (exact match)                 | `student-123-abc`                           |

### Personal Information Filters

| Parameter | Type   | Description                    | Example                                        |
| --------- | ------ | ------------------------------ | ---------------------------------------------- |
| `gender`  | string | Filter by gender (exact match) | `male`, `female`, `other`, `prefer_not_to_say` |

### Assessment Filters

| Parameter        | Type   | Description                                              | Example                                                                     |
| ---------------- | ------ | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| `assessmentType` | string | Filter by assessment type and show only relevant columns | `anxiety`, `depression`, `stress`, `suicide`                                |
| `severityLevel`  | string | Filter by severity level across all assessments          | `minimal`, `mild`, `moderate`, `moderately_severe`, `severe`, `low`, `high` |

## CSV Output Structure

### Default Output (No Assessment Filter)

When no `assessmentType` filter is applied, the CSV includes all assessment columns:

```csv
Program,Year,Status,First Name,Last Name,Middle Name,Email,Contact Number,Gender,Age,Anxiety Score,Anxiety Severity,Anxiety Assessment Date,Depression Score,Depression Severity,Depression Assessment Date,Stress Score,Stress Severity,Stress Assessment Date,Suicide Risk Level,Suicide Assessment Date,Created At,Updated At
```

### Assessment-Specific Output

When filtering by `assessmentType`, only relevant assessment columns are included:

#### Anxiety Filter (`assessmentType=anxiety`)

```csv
Program,Year,Status,First Name,Last Name,Middle Name,Email,Contact Number,Gender,Age,Anxiety Score,Anxiety Severity,Anxiety Assessment Date,Created At,Updated At
```

#### Depression Filter (`assessmentType=depression`)

```csv
Program,Year,Status,First Name,Last Name,Middle Name,Email,Contact Number,Gender,Age,Depression Score,Depression Severity,Depression Assessment Date,Created At,Updated At
```

#### Stress Filter (`assessmentType=stress`)

```csv
Program,Year,Status,First Name,Last Name,Middle Name,Email,Contact Number,Gender,Age,Stress Score,Stress Severity,Stress Assessment Date,Created At,Updated At
```

#### Suicide Filter (`assessmentType=suicide`)

```csv
Program,Year,Status,First Name,Last Name,Middle Name,Email,Contact Number,Gender,Age,Suicide Risk Level,Suicide Assessment Date,Created At,Updated At
```

## Usage Examples

### 1. Basic Export (All Students, All Assessments)

```http
GET /api/users/export-csv
Authorization: Bearer <admin-token>
```

**Response**: Downloads `student_mental_health_data.csv` with all student data and assessment information.

### 2. Filter by Assessment Type

#### Export Only Anxiety Assessment Data

```http
GET /api/users/export-csv?assessmentType=anxiety
Authorization: Bearer <admin-token>
```

**Response**: Downloads `student_mental_health_data_anxiety_filtered.csv` containing only students with anxiety assessments and anxiety-specific columns.

#### Export Only Depression Assessment Data

```http
GET /api/users/export-csv?assessmentType=depression
Authorization: Bearer <admin-token>
```

**Response**: Downloads `student_mental_health_data_depression_filtered.csv`

### 3. Filter by Student Demographics

#### Export Female Students Only

```http
GET /api/users/export-csv?gender=female
Authorization: Bearer <admin-token>
```

#### Export Computer Science Students

```http
GET /api/users/export-csv?program=Computer%20Science
Authorization: Bearer <admin-token>
```

#### Export Freshman Students

```http
GET /api/users/export-csv?status=freshman
Authorization: Bearer <admin-token>
```

### 4. Filter by Name

#### Export Students with First Name "Maria"

```http
GET /api/users/export-csv?firstName=Maria
Authorization: Bearer <admin-token>
```

#### Export Students with Last Name "Garcia"

```http
GET /api/users/export-csv?lastName=Garcia
Authorization: Bearer <admin-token>
```

#### Export Specific Student by Name

```http
GET /api/users/export-csv?firstName=Juan&lastName=Cruz
Authorization: Bearer <admin-token>
```

### 5. Filter by Severity Level

#### Export Students with Severe Mental Health Concerns

```http
GET /api/users/export-csv?severityLevel=severe
Authorization: Bearer <admin-token>
```

#### Export Students with High Stress Levels

```http
GET /api/users/export-csv?severityLevel=high&assessmentType=stress
Authorization: Bearer <admin-token>
```

### 6. Combined Filtering Examples

#### Export Female Computer Science Students with Anxiety Assessments

```http
GET /api/users/export-csv?gender=female&program=Computer%20Science&assessmentType=anxiety
Authorization: Bearer <admin-token>
```

**Response**: Downloads `student_mental_health_data_anxiety_filtered.csv` with only female Computer Science students who have completed anxiety assessments.

#### Export Severe Cases for Intervention Planning

```http
GET /api/users/export-csv?severityLevel=severe&assessmentType=depression
Authorization: Bearer <admin-token>
```

**Response**: Downloads `student_mental_health_data_depression_filtered.csv` with students showing severe depression symptoms.

#### Export Freshman Students with Mental Health Concerns

```http
GET /api/users/export-csv?status=freshman&severityLevel=moderate
Authorization: Bearer <admin-token>
```

#### Export Students by Name Pattern for Follow-up

```http
GET /api/users/export-csv?firstName=Mar&assessmentType=suicide
Authorization: Bearer <admin-token>
```

**Note**: This will match students with names like "Maria", "Marco", "Mariel", etc., who have completed suicide risk assessments.

## Dynamic Filename Generation

The system automatically generates descriptive filenames based on applied filters:

| Filter Combination                        | Generated Filename                                   |
| ----------------------------------------- | ---------------------------------------------------- |
| No filters                                | `student_mental_health_data.csv`                     |
| `assessmentType=anxiety`                  | `student_mental_health_data_anxiety_filtered.csv`    |
| `assessmentType=depression&gender=female` | `student_mental_health_data_depression_filtered.csv` |
| `program=Engineering&status=senior`       | `student_mental_health_data_filtered.csv`            |

## Response Examples

### Successful Export Response

```http
HTTP/1.1 200 OK
Content-Type: text/csv
Content-Disposition: attachment; filename="student_mental_health_data_anxiety_filtered.csv"

Program,Year,Status,First Name,Last Name,Middle Name,Email,Contact Number,Gender,Age,Anxiety Score,Anxiety Severity,Anxiety Assessment Date,Created At,Updated At
Computer Science,1st Year,freshman,Maria,Santos,,maria.santos@university.edu,+639123456789,female,18,15,severe,2025-10-03T08:30:00.000Z,2025-09-01T10:00:00.000Z,2025-10-03T08:30:00.000Z
Information Technology,2nd Year,sophomore,Juan,Garcia,,juan.garcia@university.edu,+639987654321,male,19,12,moderate,2025-10-02T14:15:00.000Z,2025-09-01T11:30:00.000Z,2025-10-02T14:15:00.000Z
```

### Error Responses

#### Invalid Gender Filter

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Invalid gender filter. Must be one of: male, female, other, prefer_not_to_say"
}
```

#### Invalid Severity Level Filter

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Invalid severity level filter. Must be one of: minimal, mild, moderate, moderately_severe, severe, low, high"
}
```

#### Invalid Assessment Type Filter

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Invalid assessment type filter. Must be one of: anxiety, depression, stress, suicide"
}
```

#### Insufficient Permissions

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Insufficient permissions. Admin role required."
}
```

## Use Cases for Guidance Counselors

### 1. Intervention Planning

```http
GET /api/users/export-csv?severityLevel=severe
```

Export all students with severe mental health symptoms for immediate intervention planning.

### 2. Program-Specific Analysis

```http
GET /api/users/export-csv?program=Engineering&assessmentType=stress
```

Analyze stress levels specifically among Engineering students to identify program-related stressors.

### 3. Gender-Based Mental Health Research

```http
GET /api/users/export-csv?gender=female&assessmentType=anxiety
```

Study anxiety patterns among female students for targeted support programs.

### 4. Academic Level Monitoring

```http
GET /api/users/export-csv?status=senior&severityLevel=moderate
```

Monitor senior students with moderate mental health concerns during their final year.

### 5. Individual Student Follow-up

```http
GET /api/users/export-csv?firstName=Maria&lastName=Santos
```

Export specific student data for case management and follow-up sessions.

### 6. Crisis Intervention

```http
GET /api/users/export-csv?assessmentType=suicide&severityLevel=high
```

Identify students requiring immediate crisis intervention support.

## Data Privacy and Security

- All exports are logged with user information and filter parameters
- Only admin and super_admin roles can access export functionality
- Exported data should be handled according to institutional data privacy policies
- Consider implementing additional audit trails for sensitive data exports

## Technical Implementation Notes

### Filter Processing

1. **Database-Level Filtering**: Student, program, status, gender, and name filters are applied at the database query level for optimal performance
2. **Post-Processing Filtering**: Severity level and assessment type filters are applied after data retrieval to ensure accurate cross-assessment filtering
3. **Case Insensitive Matching**: Name and program filters use case-insensitive partial matching for flexible searching

### Performance Considerations

- Large datasets may take longer to process, especially with multiple filters
- Assessment type filtering reduces data transfer and processing time
- Database indexes on commonly filtered fields improve query performance

### CSV Format

- UTF-8 encoding for international character support
- Comma-separated values with proper escaping for special characters
- ISO 8601 date format for timestamps
- Empty values represented as empty strings

## Troubleshooting

### Common Issues

1. **No Data Returned**: Check if filters are too restrictive or if students have completed the specified assessments
2. **Large File Size**: Use more specific filters to reduce dataset size
3. **Special Characters**: Ensure proper UTF-8 handling in CSV readers
4. **Date Formatting**: Use appropriate date parsing for timestamp columns

### Debugging Tips

1. Check server logs for filter parameters and result counts
2. Test filters individually before combining multiple parameters
3. Verify assessment data exists for filtered students
4. Ensure proper role-based access permissions

## API Integration Examples

### JavaScript/Node.js

```javascript
const axios = require("axios");

async function exportStudentData(filters = {}) {
	try {
		const params = new URLSearchParams(filters);
		const response = await axios.get(`/api/users/export-csv?${params}`, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
			responseType: "blob",
		});

		// Handle CSV download
		const blob = new Blob([response.data], { type: "text/csv" });
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "student_data.csv";
		link.click();
	} catch (error) {
		console.error("Export failed:", error.response.data);
	}
}

// Usage examples
exportStudentData({ assessmentType: "anxiety", severityLevel: "severe" });
exportStudentData({ gender: "female", program: "Computer Science" });
```

### Python

```python
import requests
import pandas as pd
from io import StringIO

def export_student_data(token, filters=None):
    url = "http://localhost:5000/api/users/export-csv"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        response = requests.get(url, headers=headers, params=filters or {})
        response.raise_for_status()

        # Convert to pandas DataFrame
        csv_data = StringIO(response.text)
        df = pd.read_csv(csv_data)
        return df
    except requests.exceptions.RequestException as e:
        print(f"Export failed: {e}")
        return None

# Usage examples
anxiety_data = export_student_data(token, {
    'assessmentType': 'anxiety',
    'severityLevel': 'severe'
})

female_cs_students = export_student_data(token, {
    'gender': 'female',
    'program': 'Computer Science'
})
```

This CSV export functionality provides guidance counselors with powerful tools for data analysis, intervention planning, and student support while maintaining data security and privacy standards.
