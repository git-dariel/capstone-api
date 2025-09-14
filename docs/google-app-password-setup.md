# Google App Password Setup Guide for Email OTP

This guide will help you set up a Google App Password for your Gmail account to enable the email OTP functionality in the Mental Health System.

## Prerequisites

- A Gmail account (mental.health.pup.ph@gmail.com)
- Two-factor authentication (2FA) enabled on the Gmail account

## Step-by-Step Instructions

### 1. Enable Two-Factor Authentication (if not already enabled)

1. Go to your Google Account settings: https://myaccount.google.com/
2. Click on "Security" in the left sidebar
3. Under "Signing in to Google", click on "2-Step Verification"
4. Follow the prompts to set up 2FA using your phone number or authenticator app

### 2. Generate App Password

1. **Go to Google Account Security Settings**

    - Visit: https://myaccount.google.com/security
    - Or go to your Google Account → Security

2. **Navigate to App Passwords**

    - Under "Signing in to Google", click on "App passwords"
    - You might need to sign in again for security

3. **Generate New App Password**

    - Click on "Select app" dropdown
    - Choose "Mail" or "Other (Custom name)"
    - If you chose "Other", enter a custom name like "Mental Health System API"
    - Click "Generate"

4. **Copy the Generated Password**
    - Google will show you a 16-character password
    - **IMPORTANT**: Copy this password immediately as you won't be able to see it again
    - The password format will look like: `abcd efgh ijkl mnop`

### 3. Environment Variables Setup

Add the following environment variables to your `.env` file:

```env
# Email Configuration for OTP
EMAIL_USER=mental.health.pup.ph@gmail.com
EMAIL_PASSWORD=your_16_character_app_password_here
```

**Example:**

```env
EMAIL_USER=mental.health.pup.ph@gmail.com
EMAIL_PASSWORD=abcd efgh ijkl mnop
```

> **Note**: Use the App Password (16 characters) NOT your regular Gmail password.

### 4. Security Best Practices

1. **Keep App Password Secure**

    - Never commit the `.env` file to version control
    - Store the password securely (password manager recommended)
    - Don't share the app password with unauthorized personnel

2. **Regular Password Rotation**

    - Consider rotating app passwords every 6-12 months
    - If compromised, immediately revoke and generate a new one

3. **Monitor Account Activity**
    - Regularly check your Google Account activity
    - Review which apps have access to your account

### 5. Troubleshooting

#### Common Issues:

1. **"Invalid credentials" error**

    - Verify you're using the App Password, not your regular password
    - Ensure 2FA is enabled on your Google account
    - Check that the email address is correct

2. **"Authentication failed" error**

    - Confirm the App Password is correctly copied (no extra spaces)
    - Try generating a new App Password
    - Ensure the Gmail account has sufficient permissions

3. **App Password option not visible**
    - Confirm 2FA is enabled and working
    - Wait a few minutes after enabling 2FA before trying to create App Password
    - Try signing out and back into your Google account

#### Testing Email Configuration:

You can test the email configuration by:

1. Starting your application with the configured environment variables
2. Making a registration request through the API
3. Checking the application logs for email sending success/failure messages
4. Verifying the OTP email is received in the target email address

### 6. Revoking App Passwords

If you need to revoke an App Password:

1. Go to Google Account Security Settings
2. Click on "App passwords"
3. Find the app password you want to revoke
4. Click "Remove" next to it

## Quick Reference

- **Google Account Security**: https://myaccount.google.com/security
- **App Passwords Direct Link**: https://myaccount.google.com/apppasswords
- **Email for the system**: mental.health.pup.ph@gmail.com
- **Environment Variables**:
    - `EMAIL_USER`: Your Gmail address
    - `EMAIL_PASSWORD`: 16-character App Password (not regular password)

## Support

If you encounter issues with the Google App Password setup:

1. Check Google's official documentation on App Passwords
2. Ensure your organization's Google Workspace settings allow App Passwords
3. Contact your system administrator if you're using a managed Google account
4. Review the application logs for specific error messages

---

**Last Updated**: September 2025
**Version**: 1.0
