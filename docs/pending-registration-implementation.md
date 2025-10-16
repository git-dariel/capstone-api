# Auth Flow Refactor - Pending Registration Implementation

## Overview
This refactor implements a pending registration system where user, person, and student records are only created **after** successful OTP email verification, not during initial registration.

## Changes Made

### 1. Database Schema
- **New Model**: `PendingRegistration` (`prisma/schema/pendingRegistration.prisma`)
  - Stores all registration data temporarily
  - Includes OTP verification fields
  - Auto-expires after OTP expiry

### 2. Auth Controller (`app/auth/auth.controller.ts`)

#### Register Function
- **Before**: Created user, person, and student records immediately, then sent OTP
- **After**: Only creates `PendingRegistration` record and sends OTP
- Validates existing users and pending registrations
- Cleans up expired pending registrations automatically

#### Verify Email Function
- **Before**: Only updated `emailVerified` flag on existing user
- **After**: 
  - First checks for pending registrations
  - Creates actual user, person, and student records upon successful OTP verification
  - Deletes pending registration after successful verification
  - Maintains backward compatibility with existing users

#### Resend OTP Function
- **Before**: Only handled existing users
- **After**: Handles both pending registrations and existing users

#### New Function
- `cleanupExpiredPendingRegistrations()`: Utility to clean up expired pending registrations

### 3. Frontend Compatibility
- **No changes required** to frontend code
- Existing registration flow continues to work
- OTP verification flow remains the same
- Response format maintained for backward compatibility

## Benefits

### Security Improvements
- **No orphaned records**: Failed registrations don't leave partial data in the system
- **Clean rollback**: If email verification fails, no cleanup is needed
- **Atomic operations**: User creation is all-or-nothing after verification

### Data Integrity
- **No unverified users**: Only verified users exist in the main tables
- **Consistent state**: No partial registrations in the system
- **Automatic cleanup**: Expired registrations are removed

### User Experience
- **Same flow**: Users experience no change in the registration process
- **Clear feedback**: Better error messages for pending registrations
- **Reliable**: No edge cases with partial registrations

## Deployment Instructions

### 1. Update Prisma Client
```bash
cd capstone-api
npx prisma generate
```

### 2. Deploy Backend
- The new model will be created automatically in MongoDB
- No manual database migrations needed

### 3. Optional: Setup Cleanup Cron Job
Consider adding a periodic cleanup job to remove expired pending registrations:
```javascript
// In your server startup or cron job
setInterval(async () => {
  await authController.cleanupExpiredPendingRegistrations();
}, 15 * 60 * 1000); // Run every 15 minutes
```

## Testing Scenarios

### Test Case 1: New Registration Flow
1. User registers with valid data
2. Check that no user/person/student records are created
3. Check that pending registration record exists
4. Verify OTP sent to email
5. Submit correct OTP
6. Verify user/person/student records are created
7. Verify pending registration is deleted

### Test Case 2: Expired Registration
1. User registers
2. Wait for OTP to expire (10 minutes)
3. Try to verify with correct OTP - should fail
4. Try to register again - should succeed (old pending registration cleaned up)

### Test Case 3: Duplicate Registration Prevention
1. User registers
2. Try to register again with same email while OTP is valid
3. Should receive error about registration in progress

## Backward Compatibility
- Existing verified users continue to work normally
- Existing login flow unchanged
- OTP verification for existing unverified users still works
- API responses maintain same format

## Monitoring Recommendations
- Monitor pending registration table size
- Set up alerts for unusual pending registration patterns
- Log cleanup activities for audit purposes
- Monitor email delivery success rates