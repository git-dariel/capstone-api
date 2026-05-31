# Audit Logs API Implementation

## Overview
This document summarizes the implementation of the Audit Logs API module for the Capstone application. The audit logs system tracks all user actions and system events for compliance, security auditing, and troubleshooting purposes.

## Architecture

### Module Structure
The audit logs module follows the standard capstone-api architecture pattern:

```
capstone-api/app/audit-logs/
├── index.ts                      # Module entry point - factory function
├── audit-logs.router.ts          # Route definitions with middleware
├── audit-logs.controller.ts      # Business logic and handlers
├── audit-logs.types.ts           # TypeScript interfaces and types
└── audit-logs.helper.ts          # Utility functions
```

### Design Pattern
The module uses a **factory function pattern** with dependency injection:

1. **index.ts** - Exports a factory function that receives `PrismaClient`
   - Creates the router and controller instances
   - Applies module-specific audit middleware
   - Returns configured Express Router

2. **audit-logs.router.ts** - Exports named `router` function
   - Signature: `router(route: Router, controller: IController): Router`
   - Follows standard Express routing pattern
   - Includes route authentication and authorization via `verifyToken` and `verifyRole` middleware
   - Contains OpenAPI/Swagger documentation

3. **audit-logs.controller.ts** - Exports named `controller` function
   - Signature: `controller(prisma: PrismaClient): IController`
   - Implements business logic for all audit log operations
   - Handles data validation, filtering, and error responses

## API Endpoints

### 1. Get All Audit Logs
- **Route**: `GET /api/audit-logs`
- **Auth**: Required (admin, super_admin)
- **Query Params**:
  - `page`: Page number (default: 1)
  - `limit`: Records per page (default: 10)
  - `userId`: Filter by user ID
  - `action`: Filter by action type
  - `module`: Filter by module name
  - `severity`: Filter by log severity
- **Response**: Paginated audit logs list

### 2. Get Audit Log by ID
- **Route**: `GET /api/audit-logs/:id`
- **Auth**: Required (admin, super_admin)
- **Query Params**:
  - `fields`: Comma-separated list of fields to include
- **Response**: Single audit log object

### 3. Get Audit Log Statistics
- **Route**: `GET /api/audit-logs/statistics`
- **Auth**: Required (admin, super_admin)
- **Response**: Statistics including counts by action and severity

### 4. Export Audit Logs
- **Route**: `GET /api/audit-logs/export`
- **Auth**: Required (admin, super_admin)
- **Query Params**:
  - `startDate`: Start date for filtering (ISO format)
  - `endDate`: End date for filtering (ISO format)
  - `action`: Filter by action type
- **Response**: CSV file download

### 5. Delete Old Audit Logs (Cleanup)
- **Route**: `DELETE /api/audit-logs/cleanup`
- **Auth**: Required (super_admin only)
- **Description**: Soft delete audit logs based on retention policy
- **Response**: Success message with count of deleted records

## Middleware Stack

### Authentication & Authorization
- **verifyToken**: Validates JWT token in request headers
- **verifyRole**: Checks user role (admin/super_admin required for most endpoints)
- **auditMiddlewares.generic**: Tracks access to audit logs module itself

### Audit Middleware Configuration
```typescript
auditMiddlewares.generic(prisma, {
  entityType: "AuditLog",
  module: "audit-logs",
  captureRequestBody: false,
  captureResponseBody: false,
})
```
- Prevents capturing request/response bodies to avoid redundant nested audit logs
- Tracks module access for compliance

## Key Features

### 1. Field Selection
Supports dot notation for nested field selection:
- Example: `fields=id,userId,action,user.email`
- Used in `/api/audit-logs/:id` endpoint

### 2. Filtering & Pagination
- Flexible MongoDB query building
- Support for complex filters (date ranges, status, etc.)
- Limit-offset pagination

### 3. Soft Deletes
- Audit logs are soft deleted (marked as deleted, not removed)
- Maintains data integrity for compliance
- Supports retention policies

### 4. CSV Export
- Converts audit logs to CSV format
- Includes filtering by date range and action type
- Can download for external analysis

### 5. Statistics
- Aggregates audit log counts
- Groups by action type and severity
- Useful for dashboard metrics

## Coding Patterns & Standards

### Naming Conventions
- Router file: `{entity}.router.ts`
- Controller file: `{entity}.controller.ts`
- Index file: `index.ts`
- Types file: `{entity}.types.ts` (optional)
- Helper file: `{entity}.helper.ts` (optional)

### Export Conventions
- Router exports: `export const router`
- Controller exports: `export const controller`
- Factory functions receive dependencies as parameters

### Middleware Application
- Authentication middleware applied per-route
- Authorization checks via `verifyRole`
- Module-specific tracking via audit middleware

### Error Handling
- Consistent error response format from `config.ERROR.AUDIT_LOGS`
- Role-based access denied responses (403)
- Validation error responses (400)
- Not found responses (404)

## Integration Points

### Main Server (index.ts)
The audit logs router must be registered in `capstone-api/index.ts`:
```typescript
const auditLogs = require("./app/audit-logs")(prisma);
app.use(config.baseApiPath, auditLogs);
```

### Database Schema
Uses Prisma AuditLog model with fields:
- `id`: Unique identifier
- `userId`: User who performed the action
- `action`: Type of action (CREATE, READ, UPDATE, DELETE, etc.)
- `module`: Module where action occurred
- `entityType`: Type of entity affected
- `entityId`: ID of affected entity
- `oldValues`: Previous values (for audit trail)
- `newValues`: New values (for audit trail)
- `severity`: Log level (INFO, WARNING, ERROR)
- `requestId`: Correlated request ID
- `userAgent`: Client information
- `ipAddress`: Client IP
- `isDeleted`: Soft delete flag
- `createdAt`: Timestamp

## Security Considerations

### Access Control
- Only admin and super_admin roles can view audit logs
- Cleanup operation restricted to super_admin only
- All endpoints require valid JWT token

### Data Protection
- Audit log body capture is disabled to prevent recursive logging
- Sensitive data should not be logged in request/response bodies
- Consider encryption for sensitive audit data

### Compliance
- Soft deletes preserve data for compliance
- Request/response tracking for forensic analysis
- Role-based access logging for accountability

## Testing Endpoints

### Manual Testing via cURL

**Get all audit logs:**
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/audit-logs?page=1&limit=10
```

**Get audit log by ID:**
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/audit-logs/{id}?fields=id,userId,action
```

**Get statistics:**
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/audit-logs/statistics
```

**Export CSV:**
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/audit-logs/export?startDate=2024-01-01&endDate=2024-12-31
```

**Cleanup old logs (super_admin only):**
```bash
curl -X DELETE -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/audit-logs/cleanup
```

## Files Modified/Created

### Created:
- `capstone-api/app/audit-logs/index.ts`
- `capstone-api/app/audit-logs/audit-logs.router.ts`
- `capstone-api/app/audit-logs/audit-logs.controller.ts`
- `capstone-api/app/audit-logs/audit-logs.types.ts`
- `capstone-api/app/audit-logs/audit-logs.helper.ts`

### Modified:
- `capstone-api/index.ts` - Added audit logs router registration

## Linting & Code Quality

All files follow ESLint configuration and TypeScript best practices:
- ✅ No unused imports
- ✅ Proper type annotations
- ✅ Named exports for factories
- ✅ Consistent naming conventions
- ✅ OpenAPI documentation on routes

## Future Enhancements

1. **Background Processing**: Implement async audit log writes to prevent UI delays
2. **Advanced Filtering**: Add complex query builders for audit log searches
3. **Real-time Alerts**: Trigger notifications for high-risk events
4. **Data Immutability**: Consider append-only or event-sourcing patterns
5. **Retention Policies**: Implement automatic archival based on policies
6. **Performance**: Add database indexes for frequently queried fields
7. **Export Formats**: Support additional formats (Excel, PDF, JSON)
8. **Webhooks**: Enable external systems to subscribe to audit events

## References

- Express Router Documentation
- Prisma Client Documentation
- JWT Authentication Middleware
- OpenAPI 3.0 Specification