# Privacy Policy

**Effective Date**: September 2024

KLU Attend+ ("we" or "us") is committed to protecting your privacy.

## What We Collect

### Directly Provided by You

- Email address (for authentication)
- Password (hashed by Supabase, not stored by us)
- KLU student ID (optional)
- Attendance data (manual entry or imported)
- Timetable information (manual entry or synced)
- User preferences (theme, notifications, etc.)

### Automatically Collected

- Session identifiers (for maintaining login)
- Sync timestamps (to track last update)
- Error logs (sanitized, no personal data)
- Browser/device info (for performance monitoring)

### NOT Collected

- ❌ ERP password
- ❌ MFA codes
- ❌ CAPTCHA solutions
- ❌ Attendance records from ERP directly (you sync them)
- ❌ IP addresses (unless logging errors)
- ❌ Browsing history outside our app
- ❌ Location data
- ❌ Biometric data

## How We Use Data

### Core Functionality

- User authentication and session management
- Storing your attendance records
- Calculating attendance percentages
- Displaying timetable and alerts
- Syncing data across devices

### Improvement

- Analyzing error patterns (anonymized)
- Monitoring app performance
- Fixing bugs and security issues
- Testing new features (with consent)

### Not for

- ❌ Selling to third parties
- ❌ Targeted advertising
- ❌ Marketing without consent
- ❌ Sharing with educational institutions
- ❌ Analytics profiling
- ❌ Building databases on you

## Who Has Access

### Supabase

Your data is hosted on Supabase PostgreSQL. Supabase employees have database access for:

- Infrastructure maintenance
- Security patching
- Backup management
- Legal compliance

Supabase is SOC 2 Type II compliant.

### Our Team

Core team members can access:

- Aggregate (anonymized) usage statistics
- Error logs (without personal data)
- Your account (only for support if you request it)

They **cannot** see:

- Your passwords
- Your attendance records
- Your personal information

### Third Parties

We share data with:

- **Supabase**: Database hosting, auth
- **Vercel** (if deployed there): Frontend hosting
- **Render/Railway** (if used): Backend hosting

We do NOT share data with:

- ❌ KLU or KL University
- ❌ Ad networks
- ❌ Analytics services (unless opt-in)
- ❌ Data brokers
- ❌ Government agencies (unless legally required)

## Data Retention

- **Account data**: Kept until you delete your account
- **Attendance records**: Kept until you delete them
- **Sync logs**: Retained for 90 days
- **Error logs**: Retained for 7 days
- **Cookies**: Session only (cleared on logout)

## Your Rights

### Access

You can request:

- All personal data we have about you
- How we use it
- Who we share it with

### Correction

You can update:

- Email address
- Password
- Attendance records
- User preferences

### Deletion

You can delete:

- Individual attendance records
- Entire account (cascade delete)
- Sync history

### Portability

You can export:

- Attendance data (CSV)
- Timetable (CSV/iCalendar)
- Profile information

### Opt-Out

You can disable:

- Email notifications
- Optional analytics
- Ad banner (if enabled)

To exercise rights, email: privacy@example.com

## Security

Your data is protected by:

- **TLS/SSL encryption** in transit
- **AES-256 encryption** at rest (Supabase)
- **HTTP-only cookies** (cannot access via JavaScript)
- **CORS protection** (cross-origin restrictions)
- **Row-Level Security** (database-level access control)
- **Secure headers** (XSS, clickjacking prevention)
- **Password hashing** (bcrypt via Supabase)

See `docs/SECURITY.md` for technical details.

## Cookies & Tracking

We use:

- **Session cookies** (required for login)
- **Local storage** (for offline support)
- **Service workers** (for PWA functionality)

We do NOT use:

- ❌ Tracking pixels
- ❌ Third-party cookies
- ❌ Advertising cookies
- ❌ Cross-site tracking

## GDPR & Data Protection

If you're in EU/EEA:

- We comply with GDPR
- Legal basis: Your consent + contract performance
- Data Protection Officer: contact privacy@example.com
- Right to lodge complaint with supervisory authority

If you're in UK:

- We comply with UK GDPR
- Data Protection Officer contact available

## Children's Privacy

KLU Attend+ is for students 18+. We:

- Do NOT knowingly collect data from minors
- Do NOT display ads targeted at children
- Do NOT sell data from any user
- Require age verification if needed

If we learn we have data from a minor, we delete it immediately.

## Changes to Privacy Policy

We may update this policy. We will:

- Post changes here
- Update "Effective Date"
- Notify users of major changes via email

Your continued use means acceptance of changes.

## Contact

Questions or concerns?

- **Email**: privacy@example.com
- **GitHub**: Issues page
- **Supabase**: See their privacy policy

Response within 7 days guaranteed.

## Jurisdiction

This policy is governed by laws of [Your Jurisdiction].

Any disputes are resolved in [Your Jurisdiction] courts.

---

Last Updated: September 2024

For the most current version, visit: https://github.com/yourusername/klu-attend-plus/docs/PRIVACY.md
