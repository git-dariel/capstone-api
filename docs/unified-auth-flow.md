# Unified Authentication Flow

## Overview

The authentication system has been restructured with a clear separation between user authentication and student records:

- **Auth Controller**: Handles user registration and login for accounts that need login credentials
- **Student Controller**: Handles student records that reference Person directly (no login credentials required)

This provides flexibility to create student records for administrative purposes without requiring login accounts.

## Student Management

### Create Student (No Login Required): `POST /students`

This endpoint creates student records that reference Person directly, without requiring user credentials.

```json
{
	"studentNumber": "2024-0001",
	"program": "Computer Science",
	"year": "1st Year",
	"firstName": "John",
	"lastName": "Doe",
	"middleName": "Michael",
	"email": "john.doe@university.edu",
	"contactNumber": "+1234567890",
	"gender": "male",
	"birthDate": "2000-01-15",
	"address": {
		"houseNo": 123,
		"street": "Main St",
		"province": "Sample Province",
		"city": "University City",
		"barangay": "Sample Barangay",
		"zipCode": 12345,
		"country": "Philippines",
		"type": "current"
	}
}
```

### Response Format

```json
{
	"message": "Student created successfully",
	"id": "student_id",
	"studentNumber": "2024-0001",
	"program": "Computer Science",
	"year": "1st Year",
	"person": {
		"id": "person_id",
		"firstName": "John",
		"lastName": "Doe",
		"email": "john.doe@university.edu",
		"contactNumber": "+1234567890"
	},
	"isDeleted": false,
	"createdAt": "2024-01-15T10:00:00.000Z",
	"updatedAt": "2024-01-15T10:00:00.000Z"
}
```

## User Authentication (For Login Accounts)

### User Registration: `POST /auth/register`

For users who need login credentials (guidance counselors, admin, etc.):

#### Guidance User Registration

```json
{
	"type": "guidance",
	"role": "admin",
	"email": "counselor@university.edu",
	"userName": "counselor123",
	"password": "securePassword123",
	"firstName": "Jane",
	"lastName": "Smith",
	"contactNumber": "+1234567891"
}
```

#### Student User Registration (If Login Required)

If a student needs login credentials, you can still use the auth controller:

```json
{
	"type": "student",
	"role": "user",
	"email": "student@university.edu",
	"userName": "student123",
	"password": "securePassword123",
	"firstName": "John",
	"lastName": "Doe",
	"studentNumber": "2024-0001",
	"program": "Computer Science",
	"year": "1st Year"
}
```

## Field Validation

### Required Fields for Student Creation

- `studentNumber` - Unique student identifier
- `program` - Academic program/course
- `year` - Academic year level
- `firstName` - Student's first name
- `lastName` - Student's last name

### Optional Fields for Student

- `middleName`, `suffix`, `email`, `contactNumber`, `gender`, `birthDate`, `birthPlace`, `age`, `religion`, `civilStatus`, `address`

### Required Fields for User Registration (Auth)

- `email` - Valid email format
- `password` - Minimum 6 characters
- `firstName` - User's first name
- `lastName` - User's last name

## Data Models

### Student → Person (Direct Reference)

```
Student {
	id: string
	studentNumber: string (unique)
	program: string
	year: string
	personId: string
	person: Person
	isDeleted: boolean
	createdAt: DateTime
	updatedAt: DateTime
}
```

### User → Person (For Login Accounts)

```
User {
	id: string
	userName: string (unique)
	password: string (hashed)
	role: Role
	type: Type
	personId: string
	person: Person
	isDeleted: boolean
	createdAt: DateTime
	updatedAt: DateTime
}
```

## Use Cases

### 1. Administrative Student Records

Create student records for enrollment, academic tracking, etc., without requiring login:

- Use `POST /students` endpoint
- No password required
- Direct Person reference

### 2. Student Login Accounts

Create student accounts that can log into the system:

- Use `POST /auth/register` with `type: "student"`
- Requires password
- Creates both User and Student records
- Student references User, User references Person

### 3. Staff/Guidance Accounts

Create accounts for staff, counselors, admin:

- Use `POST /auth/register` with `type: "guidance"`
- Requires password
- Creates User and Person records only

## Validation Rules

1. **Student Number Uniqueness**: Each student number must be unique
2. **Email Uniqueness**: Each email can only be used once (if provided)
3. **Username Uniqueness**: Usernames must be unique across all users (for auth accounts)
4. **Password Security**: Minimum 6 characters required (for auth accounts)

## Benefits of New Structure

- **Separation of Concerns**: Student records separate from user authentication
- **Flexibility**: Create students without requiring login credentials
- **Administrative Efficiency**: Bulk import students without passwords
- **Optional Authentication**: Add login capabilities later if needed
- **Clean Data Model**: Direct relationships without unnecessary complexity

## Login Endpoint: `POST /auth/login`

The login endpoint remains the same for both user types:

```json
{
	"email": "user@university.edu",
	"password": "securePassword123"
}
```

### Login Response (Student)

```json
{
	"message": "Logged in successfully",
	"user": {
		"id": "user_id",
		"role": "user",
		"type": "student",
		"person": {
			"id": "person_id",
			"firstName": "John",
			"lastName": "Doe",
			"email": "student@university.edu"
		}
	},
	"student": {
		"id": "student_id",
		"studentNumber": "2024-0001",
		"program": "Computer Science",
		"year": "1st Year"
	}
}
```

## Field Validation

### Required Fields for All Users

- `email` - Valid email format
- `password` - Minimum 6 characters
- `firstName` - User's first name
- `lastName` - User's last name

### Additional Required Fields for Students

- `studentNumber` - Unique student identifier
- `program` - Academic program/course
- `year` - Academic year level

### Optional Fields

- `userName` - Defaults to email if not provided
- `role` - Defaults to "user"
- `type` - Defaults to "student"
- `middleName`, `suffix`, `contactNumber`, `gender`, `birthDate`, `birthPlace`, `age`, `religion`, `civilStatus`, `address`

## Migration from Old Flow

The old student controller's `create` method has been simplified to use the unified auth registration. This provides:

- **Consistency**: Same validation and error handling for all user types
- **Maintainability**: Single source of truth for user creation logic
- **Flexibility**: Easy to extend for new user types in the future
- **Security**: Unified password hashing and security measures

## Error Handling

Common error responses:

- `400 Bad Request`: Missing required fields, invalid data format, duplicate email/username/student number
- `500 Internal Server Error`: Database or server errors

Example error response:

```json
{
	"message": "Student number already exists. Please choose a different student number."
}
```
