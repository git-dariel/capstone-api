# Email Deliverability and Anti-Spam Guide

## Overview

To ensure your OTP emails reach users' inboxes and aren't marked as spam, follow these best practices and configurations.

## 1. Email Authentication Setup

### SPF Record (Sender Policy Framework)

Add this TXT record to your domain's DNS:

```
v=spf1 include:_spf.google.com ~all
```

### DKIM (DomainKeys Identified Mail)

For Gmail, DKIM is automatically handled. For custom domains:

1. Go to Google Admin Console → Apps → Gmail → Authenticate email
2. Generate DKIM key
3. Add the DKIM record to your DNS

### DMARC (Domain-based Message Authentication)

Add this TXT record to your domain's DNS:

```
v=DMARC1; p=quarantine; rua=mailto:dmarc@pup.edu.ph; pct=100
```

## 2. Email Content Best Practices

### ✅ DO:

- **Use clear, descriptive subject lines** (avoid ALL CAPS, excessive punctuation)
- **Include both HTML and plain text versions**
- **Use proper HTML structure with tables for email clients**
- **Include sender identification** (organization name, address)
- **Add unsubscribe links** (even for transactional emails)
- **Use consistent branding** and professional design
- **Include physical address** in footer
- **Use legitimate reply-to addresses**

### ❌ DON'T:

- Use spam trigger words: "FREE!", "URGENT!", "ACT NOW!"
- Include too many exclamation marks or caps
- Use misleading subject lines
- Send from generic addresses like noreply@gmail.com
- Include suspicious links or attachments
- Use poor HTML/CSS that looks unprofessional

## 3. Technical Improvements Implemented

### Enhanced Email Template

- **XHTML 1.0 Transitional DOCTYPE** for better email client compatibility
- **Table-based layout** (more reliable than CSS grid/flexbox in emails)
- **Inline CSS with fallbacks** for Outlook and other clients
- **Professional color scheme** using PUP brand colors
- **Clear hierarchy** with proper headers and formatting

### Email Headers Added

```javascript
headers: {
  'X-Mailer': 'PUP Mental Health System',
  'X-Priority': '3',
  'X-MSMail-Priority': 'Normal',
  'Importance': 'Normal',
  'X-Auto-Response-Suppress': 'DR, OOF, AutoReply',
  'List-Unsubscribe': '<mailto:unsubscribe@pup.edu.ph>',
  'Organization': 'Polytechnic University of the Philippines',
  'X-Entity-ID': 'pup-mental-health-system'
}
```

### Improved Subject Line

- Changed from: "Verify Your Email - Mental Health System"
- To: "Email Verification Required - PUP Mental Health System"
- More descriptive and includes institution name

## 4. Gmail-Specific Recommendations

### Google Postmaster Tools

1. Register your domain at https://postmaster.google.com
2. Monitor your sender reputation
3. Check for delivery issues and spam rates

### Gmail Categories

- Ensure emails land in "Primary" tab, not "Promotions"
- Use transactional email patterns
- Avoid marketing-style content

## 5. Rate Limiting and Volume

### Sending Limits

- Gmail: 500 emails/day for regular accounts
- Google Workspace: 2000 emails/day
- Implement rate limiting in your application:

```javascript
// Example rate limiting
const rateLimit = require("express-rate-limit");

const emailRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 5, // limit each IP to 5 requests per windowMs
	message: "Too many email requests, please try again later.",
});

// Apply to email endpoints
app.use("/api/auth/resend-otp", emailRateLimit);
```

## 6. Monitoring and Testing

### Email Testing Tools

- **Mail Tester** (mail-tester.com): Test spam score
- **Litmus** or **Email on Acid**: Test across email clients
- **MXToolbox**: Check DNS records and blacklists

### Monitor Bounce Rates

- Keep bounce rate below 5%
- Remove invalid email addresses
- Handle temporary failures gracefully

### Track Delivery Metrics

- Delivery rate
- Open rate (for transactional emails, typically 20-40%)
- Spam complaint rate (keep below 0.1%)

## 7. Environment Configuration

### Environment Variables

```env
# Email Configuration
EMAIL_USER=mental.health.pup.ph@gmail.com
EMAIL_PASSWORD=your_google_app_password

# Optional: Email deliverability settings
EMAIL_RATE_LIMIT=100  # emails per hour
EMAIL_RETRY_ATTEMPTS=3
EMAIL_TIMEOUT=30000   # 30 seconds
```

### Recommended Gmail Settings

1. **Use App Passwords** (not regular password)
2. **Enable 2FA** on the Gmail account
3. **Use dedicated sending address** (not personal email)
4. **Set up email forwarding** for bounces and replies

## 8. Content Improvements Made

### Professional Template Features

- **University branding** with official name and colors
- **Clear call-to-action** with prominent OTP display
- **Security messaging** to build trust
- **Contact information** for support
- **Professional footer** with institution details

### Mobile Optimization

- Responsive design that works on mobile devices
- Readable font sizes (minimum 14px)
- Touch-friendly button sizes
- Proper viewport meta tag

## 9. Advanced Anti-Spam Techniques

### Email Warm-up

For new sending domains:

1. Start with low volume (10-20 emails/day)
2. Gradually increase over 2-4 weeks
3. Monitor reputation scores
4. Ensure high engagement rates

### List Hygiene

- Validate email addresses before sending
- Remove bounced emails immediately
- Implement double opt-in for subscriptions

### Reputation Management

- Monitor sender score at senderscore.org
- Check blacklists regularly
- Maintain consistent sending patterns

## 10. Testing Your Implementation

### Quick Tests

1. **Send test email to yourself**
2. **Check spam folder**
3. **Test with different email providers** (Gmail, Outlook, Yahoo)
4. **Use mail-tester.com** for spam score

### Email Content Test

```bash
# Test email delivery
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-test@iskolarngbayan.pup.edu.ph",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "type": "student",
    "studentNumber": "2024-TEST",
    "program": "Test Program",
    "year": "1st Year"
  }'
```

### Deliverability Checklist

- [ ] SPF record configured
- [ ] DKIM enabled
- [ ] DMARC policy set
- [ ] Professional email template
- [ ] Clear subject line
- [ ] Both HTML and text versions
- [ ] Proper headers included
- [ ] Rate limiting implemented
- [ ] Monitoring tools configured
- [ ] Test emails delivered to inbox

## 11. Troubleshooting Common Issues

### Emails Going to Spam

1. Check spam score with mail-tester.com
2. Review email content for spam triggers
3. Verify DNS records (SPF, DKIM, DMARC)
4. Check sender reputation

### Low Delivery Rates

1. Verify email addresses before sending
2. Monitor bounce rates
3. Check for blacklisting
4. Review sending patterns

### Gmail-Specific Issues

1. Ensure using App Password, not regular password
2. Check Google Postmaster Tools
3. Verify account not suspended
4. Monitor sending limits

## 12. Legal Compliance

### CAN-SPAM Act (if applicable)

- Include physical address
- Provide clear unsubscribe mechanism
- Honor unsubscribe requests within 10 days
- Don't use misleading subject lines

### GDPR Compliance (if applicable)

- Obtain proper consent for email processing
- Provide data deletion mechanisms
- Include privacy policy links

---

**Implementation Status**: ✅ Enhanced email template and deliverability features have been implemented in your system.

**Next Steps**: Configure DNS records and monitor email delivery using the tools mentioned above.
