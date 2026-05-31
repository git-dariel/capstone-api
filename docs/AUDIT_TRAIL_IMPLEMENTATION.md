# Audit Trail and Logging System Implementation

## Overview

This document describes the comprehensive audit trail and logging system implemented to track important system actions and changes across the mental health assessment application. The system ensures accountability, traceability, and easier debugging while meeting compliance and security requirements.

## Features

### Core Audit Trail Capabilities

1. **Comprehensive Action Tracking**
   - Create, update, and delete operations
   - Appointment creation, updates, and cancellations
   - Inventory changes and mental health predictions
   - User actions (login, logout, role-based actions)
   - File operations (upload/download)
   - System administrative actions

2. **Rich Audit Information**
   - User who performed the action
   - Action type and description
   - Affected module/entity
   - Timestamp with timezone
   - Before and after values for changes
   - Changed field tracking
   - IP address and user agent
   - Session information
   - Risk level assessment

3. **Security and Compliance**
   - Read-only audit logs (no editing/deletion by regular users)
   - Role-based access control (Admin/Super Admin only)
   - Automatic data sanitization for sensitive information
   - Configurable retention policies
   - Audit log integrity protection

## Database Schema

### AuditLog Model

The system uses a dedicated `AuditLog` model with the following structure:

```prisma
model AuditLog {
  id             String       @id @default(auto()) @map("_id") @db.ObjectId
  action         AuditAction
  entityType     String       // e.g., "User", "Appointment", "Inventory"
  entityId       String?
  tableName      String?      // Database table name for reference
  recordId       String?      // Primary key of the affected record
  user           User?        @relation(fields: [userId], references: [id])
  userId         String?      @db.ObjectId
  userName       String?      // Store username for deleted users
  userRole       String?      // Store user role at time of action
  userType       String?      // Store user type at time of action
  ipAddress      String?
  userAgent      String?
  sessionId      String?
  description    String       // Human readable description of the action
  module         String       // System module (e.g., "appointment", "inventory")
  beforeValues   Json?        // State before the change
  afterValues    Json?        // State after the change
  changedFields  String[]     // Array of field names that changed
  metadata       Json?        // Additional context data
  riskLevel      LogSeverity  @default(info)
  isSystemAction Boolean      @default(false) // True for automated actions
  isSecurityLog  Boolean      @default(false) // True for security-related actions
  timestamp      DateTime     @default(now())
  isDeleted      Boolean      @default(false) // For log retention policies
  retentionDate  DateTime?    // When this log can be safely deleted

  @@index([entityType, entityId])
  @@index([userId, timestamp])
  @@index([action, timestamp])
  @@index([module, timestamp])
  @@index([isSecurityLog, timestamp])
  @@index([riskLevel, timestamp])
}
```

### Supported Actions

```prisma
enum AuditAction {
  CREATE
  UPDATE
  DELETE
  LOGIN
  LOGOUT
  VIEW
  EXPORT
  APPROVE
  REJECT
  CANCEL
  RESTORE
  ASSIGN
  UNASSIGN
  ACTIVATE
  DEACTIVATE
  RESET_PASSWORD
  CHANGE_ROLE
  BULK_UPDATE
  BULK_DELETE
  FILE_UPLOAD
  FILE_DOWNLOAD
}
```

## Implementation Components

### 1. Audit Helper Functions (`helper/audit.helper.ts`)

The audit helper provides utilities for creating and managing audit logs:

```typescript
import { auditHelpers, extractAuditContext } from "../helper/audit.helper";

// Extract context from request
const context = extractAuditContext(req);

// Log user login
await auditHelpers.logLogin(prisma, userId, context, metadata);

// Log record creation
await auditHelpers.logCreate(prisma, entityType, entityId, module, afterValues, context);

// Log record updates
await auditHelpers.logUpdate(prisma, entityType, entityId, module, beforeValues, afterValues, context);

// Log record deletion
await auditHelpers.logDelete(prisma, entityType, entityId, module, beforeValues, context);
```

### 2. Audit Middleware (`middleware/auditMiddleware.ts`)

Automatic audit logging for HTTP requests:

```typescript
import { auditMiddlewares } from "../middleware/auditMiddleware";

// Apply to specific routes
router.use(auditMiddlewares.appointment(prisma));
router.use(auditMiddlewares.inventory(prisma));
router.use(auditMiddlewares.userManagement(prisma));
```

### 3. Audit Log Controller (`app/audit-logs/audit-logs.controller.ts`)

Provides API endpoints for accessing audit logs with proper role-based restrictions.

## API Endpoints

### Get All Audit Logs

```http
GET /api/audit-logs
Authorization: Bearer <admin-token>
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Records per page (default: 20, max: 100)
- `action` - Filter by action type
- `entityType` - Filter by entity type
- `module` - Filter by system module
- `userId` - Filter by user ID
- `riskLevel` - Filter by risk level
- `isSecurityLog` - Filter security logs (true/false)
- `isSystemAction` - Filter system actions (true/false)
- `dateFrom` - Start date filter (ISO 8601)
- `dateTo` - End date filter (ISO 8601)
- `ipAddress` - Filter by IP address
- `query` - Search in description, entity type, module, or username

**Response:**
```json
{
  "auditLogs": [
    {
      "id": "audit-123",
      "action": "CREATE",
      "entityType": "Appointment",
      "entityId": "apt-456",
      "description": "User john.doe successfully created Appointment",
      "module": "appointment",
      "timestamp": "2025-01-14T10:30:00.000Z",
      "riskLevel": "info",
      "isSecurityLog": false,
      "user": {
        "userName": "john.doe",
        "role": "user",
        "person": {
          "firstName": "John",
          "lastName": "Doe"
        }
      },
      "beforeValues": null,
      "afterValues": {
        "appointmentType": "individual_counseling",
        "requestedDate": "2025-01-15T14:00:00.000Z",
        "status": "pending"
      },
      "changedFields": [],
      "metadata": {
        "isGroupSession": false,
        "calculatedPriority": true
      }
    }
  ],
  "total": 150,
  "page": 1,
  "totalPages": 8
}
```

### Get Audit Log by ID

```http
GET /api/audit-logs/:id
Authorization: Bearer <admin-token>
```

### Get Audit Statistics

```http
GET /api/audit-logs/statistics
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "summary": {
    "totalLogs": 1500,
    "securityLogs": 245,
    "systemLogs": 120,
    "recentActivity": 85
  },
  "breakdown": {
    "actions": [
      { "action": "LOGIN", "count": 340 },
      { "action": "CREATE", "count": 280 },
      { "action": "UPDATE", "count": 195 }
    ],
    "entities": [
      { "entityType": "Appointment", "count": 450 },
      { "entityType": "User", "count": 380 }
    ],
    "modules": [
      { "module": "appointment", "count": 450 },
      { "module": "authentication", "count": 340 }
    ],
    "riskLevels": [
      { "riskLevel": "info", "count": 1200 },
      { "riskLevel": "medium", "count": 200 },
      { "riskLevel": "high", "count": 80 },
      { "riskLevel": "critical", "count": 20 }
    ]
  }
}
```

### Export Audit Logs

```http
GET /api/audit-logs/export
Authorization: Bearer <super-admin-token>
```

**Query Parameters:**
- `format` - Export format (`json` or `csv`)
- `limit` - Maximum records to export (max: 10,000)
- Filter parameters (same as Get All)

### Cleanup Old Logs

```http
DELETE /api/audit-logs/cleanup?olderThanDays=365&dryRun=true
Authorization: Bearer <super-admin-token>
```

## Security Features

### 1. Role-Based Access Control

- **Regular Users**: No access to audit logs
- **Admin**: Read-only access to audit logs and statistics
- **Super Admin**: Full access including export and cleanup operations

### 2. Data Sanitization

Sensitive information is automatically redacted:
- Passwords and password hashes
- API keys and tokens
- Social security numbers
- Credit card information
- Other PII fields

### 3. Audit Log Integrity

- Audit logs cannot be modified after creation
- Only soft deletion is allowed (for retention policies)
- System actions are clearly marked
- Immutable timestamps and user information

### 4. Retention Policies

Configurable retention periods based on risk level:
- **Critical**: 7 years
- **High**: 5 years  
- **Medium**: 3 years
- **Low/Info**: 1 year

## Usage Examples

### 1. Authentication Audit Logging

```typescript
// In auth controller - successful login
const auditContext = extractAuditContext(req);
await auditHelpers.logLogin(
  prisma,
  user.id,
  {
    ...auditContext,
    userId: user.id,
    userName: user.userName,
    userRole: user.role,
    userType: user.type,
  },
  {
    loginMethod: "email",
    success: true,
  }
);

// Failed login attempt
await auditHelpers.logLogin(
  prisma,
  user.id,
  auditContext,
  {
    success: false,
    failureReason: "invalid_password",
  }
);
```

### 2. Appointment Audit Logging

```typescript
// Appointment creation
await auditHelpers.logAppointmentAction(
  prisma,
  "CREATE",
  appointment.id,
  extractAuditContext(req),
  undefined, // No beforeValues for creation
  {
    studentId: appointment.studentId,
    counselorId: appointment.counselorId,
    appointmentType: appointment.appointmentType,
    status: appointment.status,
  },
  {
    isGroupSession: appointment.studentIds.length > 1,
    calculatedPriority: true,
  }
);

// Appointment update/cancellation
await auditHelpers.logAppointmentAction(
  prisma,
  status === "cancelled" ? "CANCEL" : "UPDATE",
  appointment.id,
  extractAuditContext(req),
  { status: oldStatus },
  { status: newStatus },
  { cancellationReason: req.body.cancellationReason }
);
```

### 3. Inventory Audit Logging

```typescript
// Inventory creation
await auditHelpers.logInventoryChange(
  prisma,
  "CREATE",
  inventory.id,
  extractAuditContext(req),
  undefined,
  {
    studentId: inventory.studentId,
    height: inventory.height,
    weight: inventory.weight,
  },
  {
    inventoryType: "individual",
    automaticPrediction: true,
  }
);
```

### 4. Using Audit Middleware

```typescript
// In router files
import { auditMiddlewares } from "../../middleware/auditMiddleware";

// Apply to all appointment routes
router.use(auditMiddlewares.appointment(prisma));

// Apply custom middleware
router.use(auditMiddlewares.generic(prisma, {
  entityType: "Student",
  module: "student-management",
  captureRequestBody: true,
  captureResponseBody: false,
}));
```

## Monitoring and Alerting

### 1. High-Risk Action Monitoring

The system automatically flags high-risk actions:
- User role changes
- System configuration changes
- Bulk operations
- Failed security actions

### 2. Anomaly Detection

Monitor for suspicious patterns:
- Multiple failed login attempts
- Unusual access patterns
- Off-hours administrative actions
- Bulk data exports

### 3. Performance Considerations

- Audit logging is asynchronous to prevent performance impact
- Database indexes optimize query performance
- Configurable log levels and retention policies
- Batch processing for large operations

## Compliance and Legal Considerations

### 1. Data Protection

- GDPR compliance for EU users
- FERPA compliance for educational records
- HIPAA considerations for health data
- Local privacy law compliance

### 2. Audit Requirements

- Immutable audit trail
- Non-repudiation capabilities
- Complete action history
- Forensic investigation support

### 3. Retention and Archival

- Automated retention policy enforcement
- Secure archival procedures
- Legal hold capabilities
- Data destruction procedures

## Best Practices

### 1. Development Guidelines

- Always use audit helpers for consistency
- Include meaningful descriptions
- Capture relevant context information
- Handle audit failures gracefully

### 2. Security Guidelines

- Sanitize sensitive data before logging
- Use appropriate risk levels
- Implement proper access controls
- Monitor audit system integrity

### 3. Performance Guidelines

- Use async logging where possible
- Implement appropriate indexes
- Monitor audit log growth
- Regular cleanup procedures

## Troubleshooting

### Common Issues

1. **Audit Log Creation Failures**
   - Check database connectivity
   - Verify user permissions
   - Review data validation errors

2. **Performance Issues**
   - Monitor audit log table size
   - Check index usage
   - Review retention policies

3. **Access Permission Errors**
   - Verify user roles
   - Check authentication tokens
   - Review middleware configuration

### Log Analysis

Use the audit statistics endpoint to identify:
- High-activity periods
- Suspicious user behavior
- System performance patterns
- Security incidents

## Future Enhancements

### Planned Features

1. **Real-time Alerting**
   - Webhook notifications
   - Email alerts for critical actions
   - Dashboard notifications

2. **Advanced Analytics**
   - Machine learning anomaly detection
   - Predictive security analytics
   - User behavior analysis

3. **Integration Capabilities**
   - SIEM system integration
   - External audit system connectors
   - Third-party monitoring tools

4. **Enhanced Reporting**
   - Compliance report generation
   - Custom audit reports
   - Scheduled report delivery

## Conclusion

The audit trail and logging system provides comprehensive tracking of all important system actions while maintaining security, performance, and compliance requirements. The system is designed to be extensible, allowing for future enhancements while maintaining backward compatibility.

For technical support or questions about the audit system, please refer to the development team or system administrators.