# Mental Health Assessment API - Controller Template Documentation

This document serves as a template for implementing consistent REST API endpoints following the Mental Health Assessment API patterns with comprehensive validation, role-based access control, and mental health-specific features.

## Query Parameter Usage Examples

1. Basic Pagination

```
GET /api/student?page=1&limit=10
```

2. Search with Mental Health Context

```
GET /api/anxiety?query=john.doe@university.edu
```

3. Sort by Assessment Fields

```
GET /api/anxiety?sort=assessmentDate&order=desc
```

4. Complex Sort with Multiple Fields

```
GET /api/student?sort={"program":"asc","year":"desc"}
```

5. Nested Field Selection with Dot Notation

```
GET /api/student?fields=id,studentNumber,program,person.firstName,person.lastName,person.email
```

6. Combined Usage with Role-Based Filtering

```
GET /api/anxiety?page=1&limit=10&query=severe&sort=assessmentDate&order=desc&fields=id,totalScore,severityLevel,user.person.firstName&userId=specific-user-id
```

# Mental Health Assessment API Usage Template

This document provides examples of how to use and test REST API endpoints that follow our mental health assessment patterns with role-based access control, field validation, and specialized mental health features.

## Base URL

```
http://localhost:5000/api/[resource]
```

Replace `[resource]` with your specific resource (e.g., student, anxiety, depression, consent, appointment)

## Authentication

All requests require JWT authentication via Bearer token:

```http
Authorization: Bearer <your-jwt-token>
```

## Role-Based Access Control

The API supports three user roles:

- **user**: Regular students (can only access their own data)
- **admin**: Counselors and staff (can access all data)
- **super_admin**: System administrators (full access)

## Endpoints Usage Guide

### 1. Get All Records with Role-Based Access

#### Basic Request

```http
GET /api/[resource]
Authorization: Bearer <token>
```

#### Available Query Parameters

| Parameter | Example Value                       | Description             | Mental Health Context                   |
| --------- | ----------------------------------- | ----------------------- | --------------------------------------- |
| page      | 1                                   | Current page number     | Standard pagination                     |
| limit     | 10                                  | Items per page          | Usually 10-50 for assessments           |
| query     | john                                | Search term             | Searches names, emails, student numbers |
| sort      | assessmentDate                      | Field to sort by        | Common: assessmentDate, severityLevel   |
| order     | desc                                | Sort direction          | desc for recent assessments             |
| fields    | id,totalScore,user.person.firstName | Nested field selection  | Use dot notation for relations          |
| userId    | user-id-123                         | Filter by specific user | Admin-only parameter                    |

#### Example Requests

1. **Student Management - Get All Students**

```http
GET /api/student?page=1&limit=10&sort=program&order=asc
Authorization: Bearer <token>
```

Response:

```json
{
	"students": [
		{
			"id": "student-123",
			"studentNumber": "2024-0001",
			"program": "Computer Science",
			"year": "1st Year",
			"person": {
				"firstName": "John",
				"lastName": "Doe",
				"email": "john.doe@university.edu"
			}
		}
	],
	"total": 150,
	"page": 1,
	"totalPages": 15
}
```

2. **Mental Health Assessment - Get Anxiety Assessments**

```http
GET /api/anxiety?page=1&limit=10&sort=assessmentDate&order=desc&fields=id,totalScore,severityLevel,assessmentDate,user.person.firstName,user.person.lastName
Authorization: Bearer <token>
```

Response:

```json
{
	"assessments": [
		{
			"id": "anxiety-123",
			"totalScore": 15,
			"severityLevel": "severe",
			"assessmentDate": "2025-09-06T14:30:00.000Z",
			"user": {
				"person": {
					"firstName": "John",
					"lastName": "Doe"
				}
			},
			"analysis": {
				"interpretation": "Severe anxiety symptoms detected",
				"recommendations": ["Immediate professional consultation recommended"],
				"riskLevel": "High"
			}
		}
	],
	"total": 25,
	"page": 1,
	"totalPages": 3
}
```

3. **Search with Mental Health Context**

```http
GET /api/student?query=Computer Science&fields=id,studentNumber,program,person.firstName,person.lastName
Authorization: Bearer <token>
```

4. **Admin-Only: Get Assessments for Specific User**

```http
GET /api/anxiety?userId=user-456&sort=assessmentDate&order=desc
Authorization: Bearer <admin-token>
```

### 2. Get Single Record with Nested Field Selection

#### Basic Request

```http
GET /api/[resource]/:id
Authorization: Bearer <token>
```

#### Examples

1. **Get Student with Person Details**

```http
GET /api/student/student-123?fields=id,studentNumber,program,year,person.firstName,person.lastName,person.email,person.contactNumber
Authorization: Bearer <token>
```

Response:

```json
{
	"id": "student-123",
	"studentNumber": "2024-0001",
	"program": "Computer Science",
	"year": "1st Year",
	"person": {
		"firstName": "John",
		"lastName": "Doe",
		"email": "john.doe@university.edu",
		"contactNumber": "+1234567890"
	}
}
```

2. **Get Anxiety Assessment with Analysis**

```http
GET /api/anxiety/anxiety-123
Authorization: Bearer <token>
```

Response:

```json
{
	"id": "anxiety-123",
	"totalScore": 15,
	"severityLevel": "severe",
	"feeling_nervous_anxious_edge": 3,
	"not_able_stop_control_worrying": 3,
	"assessmentDate": "2025-09-06T14:30:00.000Z",
	"analysis": {
		"interpretation": "Severe anxiety symptoms detected",
		"recommendations": [
			"Immediate professional consultation recommended",
			"Consider stress reduction techniques",
			"Schedule follow-up assessment"
		],
		"riskLevel": "High",
		"needsAttention": true
	},
	"cooldownInfo": {
		"isActive": true,
		"daysRemaining": 5,
		"nextAvailableDate": "2025-09-11T14:30:00.000Z"
	}
}
```

### 3. Create Record with Validation

#### Basic Request

```http
POST /api/[resource]
Authorization: Bearer <token>
Content-Type: application/json
```

#### Examples

1. **Create Student (with new Person)**

```http
POST /api/student
Authorization: Bearer <token>
Content-Type: application/json

{
    "studentNumber": "2024-0001",
    "program": "Computer Science",
    "year": "1st Year",
    "status": "freshman",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@university.edu",
    "contactNumber": "+1234567890",
    "gender": "Male",
    "birthDate": "2000-01-01",
    "address": {
        "street": "123 Main St",
        "city": "Manila",
        "province": "Metro Manila",
        "zipCode": "1000",
        "country": "Philippines"
    }
}
```

Response:

```json
{
	"message": "Student created successfully",
	"id": "student-123",
	"studentNumber": "2024-0001",
	"program": "Computer Science",
	"year": "1st Year",
	"person": {
		"id": "person-456",
		"firstName": "John",
		"lastName": "Doe",
		"email": "john.doe@university.edu"
	}
}
```

2. **Create Mental Health Assessment (Anxiety)**

```http
POST /api/anxiety
Authorization: Bearer <student-token>
Content-Type: application/json

{
    "feeling_nervous_anxious_edge": 2,
    "not_able_stop_control_worrying": 3,
    "worrying_too_much_different_things": 2,
    "trouble_relaxing": 3,
    "restless_hard_sit_still": 1,
    "easily_annoyed_irritable": 2,
    "feeling_afraid_awful_happen": 3,
    "difficulty_level": 2,
    "assessmentDate": "2025-09-06T14:30:00.000Z"
}
```

Response:

```json
{
	"id": "anxiety-123",
	"userId": "user-456",
	"totalScore": 16,
	"severityLevel": "severe",
	"feeling_nervous_anxious_edge": 2,
	"not_able_stop_control_worrying": 3,
	"assessmentDate": "2025-09-06T14:30:00.000Z",
	"cooldownActive": true,
	"analysis": {
		"interpretation": "Severe anxiety symptoms detected",
		"recommendations": [
			"Immediate professional consultation recommended",
			"Consider stress reduction techniques"
		],
		"riskLevel": "High",
		"needsAttention": true
	},
	"cooldownInfo": {
		"isActive": true,
		"daysRemaining": 7,
		"nextAvailableDate": "2025-09-13T14:30:00.000Z",
		"cooldownPeriodDays": 7
	}
}
```

3. **Create Consent with Mental Health Prediction**

```http
POST /api/consent
Authorization: Bearer <token>
Content-Type: application/json

{
    "studentId": "student-123",
    "sleep_duration": "6.5",
    "stress_level": "high",
    "academic_performance": "good",
    "physical_problems": "none",
    "services": "counseling",
    "live": "with_family",
    "referred": "self"
}
```

Response:

```json
{
	"message": "Consent created successfully with mental health prediction",
	"consent": {
		"id": "consent-123",
		"studentId": "student-123",
		"sleep_duration": "6.5",
		"stress_level": "high"
	},
	"mentalHealthPrediction": {
		"academicPerformanceOutlook": "Stable",
		"confidence": "85.2%",
		"riskFactors": ["High stress levels", "Insufficient sleep (< 7 hours)"],
		"mentalHealthRisk": {
			"level": "Moderate",
			"description": "Student shows some risk factors that warrant attention",
			"needsAttention": true,
			"urgency": "Monitor"
		},
		"recommendations": [
			"Consider stress management techniques",
			"Improve sleep hygiene and aim for 7-9 hours per night"
		]
	}
}
```

### 4. Update Record with Role-Based Validation

#### Basic Request

```http
PATCH /api/[resource]/:id
Authorization: Bearer <token>
Content-Type: application/json
```

#### Examples

1. **Update Student Information**

```http
PATCH /api/student/student-123
Authorization: Bearer <token>
Content-Type: application/json

{
    "year": "2nd Year",
    "person": {
        "contactNumber": "+1234567891",
        "address": {
            "street": "456 Oak Avenue",
            "city": "Quezon City"
        }
    }
}
```

Response:

```json
{
	"id": "student-123",
	"studentNumber": "2024-0001",
	"program": "Computer Science",
	"year": "2nd Year",
	"person": {
		"firstName": "John",
		"lastName": "Doe",
		"contactNumber": "+1234567891",
		"address": {
			"street": "456 Oak Avenue",
			"city": "Quezon City",
			"province": "Metro Manila",
			"zipCode": "1000"
		}
	}
}
```

2. **Update Assessment (User can only update own assessments)**

```http
PATCH /api/anxiety/anxiety-123
Authorization: Bearer <student-token>
Content-Type: application/json

{
    "feeling_nervous_anxious_edge": 1,
    "trouble_relaxing": 2
}
```

3. **Admin-Only: Update Cooldown Status**

```http
PATCH /api/anxiety/anxiety-123
Authorization: Bearer <admin-token>
Content-Type: application/json

{
    "cooldownActive": false
}
```

Response:

```json
{
	"id": "anxiety-123",
	"totalScore": 14,
	"severityLevel": "moderate",
	"cooldownActive": false,
	"analysis": {
		"interpretation": "Moderate anxiety symptoms",
		"riskLevel": "Medium"
	},
	"cooldownInfo": {
		"isActive": false,
		"manuallyDeactivated": true,
		"daysRemaining": 0
	}
}
```

### 5. Delete Record (Soft Delete)

#### Basic Request

```http
DELETE /api/[resource]/:id
Authorization: Bearer <token>
```

#### Examples

1. **Delete Student (Soft Delete)**

```http
DELETE /api/student/student-123
Authorization: Bearer <admin-token>
```

Response:

```json
{
	"message": "Student deleted successfully"
}
```

2. **Delete Assessment (User can only delete own assessments)**

```http
DELETE /api/anxiety/anxiety-123
Authorization: Bearer <student-token>
```

Response:

```json
{
	"message": "Anxiety assessment deleted successfully"
}
```

## Mental Health Specific Features

### 1. Cooldown System for Assessments

Mental health assessments have cooldown periods to prevent over-assessment:

- **Minimal (0-4)**: 1 day cooldown
- **Mild (5-9)**: 3 days cooldown
- **Moderate (10-14)**: 5 days cooldown
- **Severe (15-21)**: 7 days cooldown

#### Check Cooldown Status

```http
GET /api/anxiety/anxiety-123
Authorization: Bearer <token>
```

Response includes cooldown information:

```json
{
	"cooldownInfo": {
		"isActive": true,
		"daysRemaining": 3,
		"nextAvailableDate": "2025-09-09T14:30:00.000Z",
		"cooldownPeriodDays": 5,
		"manuallyDeactivated": false
	}
}
```

#### Assessment During Cooldown (429 Error)

```http
POST /api/anxiety
Authorization: Bearer <student-token>
```

Response:

```json
{
	"error": "Assessment cooldown period is active",
	"message": "You recently completed a moderate severity assessment. To ensure proper time for reflection and avoid assessment fatigue, please wait before taking another assessment.",
	"cooldownInfo": {
		"isActive": true,
		"daysRemaining": 3,
		"nextAvailableDate": "2025-09-09T14:30:00.000Z"
	}
}
```

### 2. Mental Health Risk Assessment

#### Consent Creation with ML Prediction

```http
POST /api/consent
Authorization: Bearer <token>
Content-Type: application/json

{
    "studentId": "student-123",
    "sleep_duration": "4.5",
    "stress_level": "high",
    "academic_performance": "declined"
}
```

Response with AI-powered mental health assessment:

```json
{
	"mentalHealthPrediction": {
		"academicPerformanceOutlook": "Declined",
		"confidence": "87.3%",
		"riskFactors": [
			"Insufficient sleep (< 6 hours)",
			"High stress levels",
			"Academic performance decline"
		],
		"mentalHealthRisk": {
			"level": "Critical",
			"description": "Student shows multiple indicators of significant mental health concerns. Immediate professional intervention recommended.",
			"needsAttention": true,
			"urgency": "Immediate",
			"assessmentSummary": "⚠️ ATTENTION NEEDED: Student shows multiple indicators of significant mental health concerns."
		},
		"recommendations": [
			"Consider scheduling a consultation with a mental health professional",
			"Implement stress reduction techniques",
			"Focus on improving sleep hygiene and maintaining 7-9 hours of sleep per night"
		]
	}
}
```

## Error Responses

All endpoints return consistent error responses with mental health context:

### 1. Validation Errors

```json
{
	"error": "GAD-7 responses must be between 0 and 3"
}
```

### 2. Authentication Errors

```json
{
	"error": "User not authenticated"
}
```

### 3. Authorization Errors (Role-Based)

```json
{
	"error": "Insufficient permissions to modify cooldown status",
	"message": "Only admin and guidance personnel can modify assessment cooldown periods"
}
```

### 4. Not Found Errors

```json
{
	"error": "Student not found"
}
```

### 5. Cooldown Errors

```json
{
	"error": "Assessment cooldown period is active",
	"message": "You recently completed a severe anxiety assessment. To ensure proper time for reflection and avoid assessment fatigue, please wait 7 days before taking another assessment.",
	"cooldownInfo": {
		"daysRemaining": 5,
		"nextAvailableDate": "2025-09-11T14:30:00.000Z"
	}
}
```

### 6. Duplicate Data Errors

```json
{
	"error": "Student number already exists"
}
```

## Testing Tips for Mental Health API

1. **Always test with proper JWT tokens** for different user roles
2. **Test role-based access control** - users should only access their own data
3. **Verify assessment cooldown periods** work correctly
4. **Test mental health prediction algorithms** with various input combinations
5. **Validate field selection with nested objects** using dot notation
6. **Test error responses for invalid mental health assessment values** (0-3 range)
7. **Ensure proper soft delete functionality** preserves data integrity
8. **Test search functionality** across student numbers, names, and emails
9. **Verify pagination** works with large datasets of assessments
10. **Test concurrent assessment creation** during cooldown periods
