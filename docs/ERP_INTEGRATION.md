# ERP Integration Guide

## Current Status

As of September 2024, the KLU ERP integration is **not yet verified** due to:

1. **CAPTCHA Challenge** - Human verification required on login
2. **MFA Requirements** - Multi-factor authentication may be enforced  
3. **Session Management** - ERP session lifecycle unclear
4. **API Endpoints** - Attendance retrieval method not fully documented
5. **Rate Limiting** - Unknown rate limits on ERP endpoints

## Investigation Workflow

Before implementing the KLUERPAdapter, follow this process:

### Step 1: Inspect Login Flow

Using browser DevTools (F12):

1. Open https://newerp.kluniversity.in/
2. Open Network tab
3. Fill login form
4. Record:
   - Request method (GET/POST)
   - Endpoint URL
   - Request headers
   - Request body (NOT passwords)
   - Response headers
   - Response format (JSON/HTML/redirect)
   - CSRF token if present
   - Cookie details

### Step 2: Identify CAPTCHA

1. Screenshot the CAPTCHA type
2. Determine if:
   - Google reCAPTCHA v2/v3
   - hCaptcha
   - Custom image CAPTCHA
   - Other
3. Note: **Do NOT attempt to bypass**

### Step 3: Complete MFA (if applicable)

1. After password, check for MFA prompt
2. Record:
   - MFA methods available
   - Code delivery method
   - Code format
   - Timeout duration

### Step 4: Find Attendance Endpoint

1. After successful auth, capture:
   - URL for attendance page
   - Network requests on load
   - Response format (JSON/HTML table)
   - Required parameters
   - Authentication method (cookie/token/header)

### Step 5: Map Response Structure

Example expected JSON:

```json
{
  "subjects": [
    {
      "code": "JAVA101",
      "name": "Java Programming",
      "attended": 40,
      "conducted": 51,
      "faculty": "Dr. Smith"
    }
  ],
  "semester": 4,
  "academic_year": "2024-25"
}
```

HTML table format:

```html
<tr>
  <td>JAVA101</td>
  <td>Java Programming</td>
  <td>40</td>
  <td>51</td>
</tr>
```

## Architecture Decision

### Option A: Browser Redirect (Recommended)

If CAPTCHA/MFA cannot be automated:

```
User clicks "Connect ERP"
    ↓
Opens ERP login in new window/iframe
    ↓
User completes CAPTCHA/MFA themselves
    ↓
Our app polls session endpoint
    ↓
Session validated
    ↓
User returns to app
```

**Pros**: No CAPTCHA bypass, user in control  
**Cons**: Two-window experience, polling required

### Option B: Backend Relay (Alternative)

If ERP supports form redirect:

```
User submits username to our app
    ↓
Our app generates session token
    ↓
Redirects to ERP with callback URL
    ↓
ERP completes auth
    ↓
Redirects back to us
    ↓
We establish secure session
```

### Option C: Headless Browser (Not Recommended)

Puppeteer/Playwright for automation:

**Cons**:
- Defeats CAPTCHA purpose
- Resource-intensive
- Violates ERP ToS likely
- Fragile to ERP changes

**Only use if ERP explicitly allows automated access**

## Implementation Checklist

- [ ] Document actual ERP login flow
- [ ] Identify CAPTCHA type
- [ ] Determine MFA requirements
- [ ] Locate attendance endpoint
- [ ] Map response format
- [ ] Test session persistence
- [ ] Verify rate limits
- [ ] Document findings in ERP_DISCOVERY.md

## Code Structure

### ERPAdapter Interface

```typescript
interface ERPAdapter {
  authenticate(input: ERPAuthInput): Promise<ERPSession>;
  fetchStudentProfile(session: ERPSession): Promise<StudentProfile>;
  fetchAttendance(session: ERPSession): Promise<ERPAttendanceData>;
  fetchTimetable(session: ERPSession): Promise<ERPTimetableData>;
  logout(session: ERPSession): Promise<void>;
}
```

### KLUERPAdapter Implementation

Only implement based on verified behavior. Leave stubs for unknown endpoints:

```typescript
export class KLUERPAdapter implements ERPAdapter {
  private baseUrl = "https://newerp.kluniversity.in";

  async authenticate(input: ERPAuthInput): Promise<ERPSession> {
    // ACTUAL implementation based on discovered flow
    throw new Error(
      "CAPTCHA/MFA requires user interaction. See docs/ERP_INTEGRATION.md"
    );
  }

  async fetchAttendance(session: ERPSession): Promise<ERPAttendanceData> {
    // Implement only if endpoint is verified
  }
}
```

### MockERPAdapter for Development

Always provide a mock for testing:

```typescript
export class MockERPAdapter implements ERPAdapter {
  async authenticate(): Promise<ERPSession> {
    return {
      session_id: "mock-session-123",
      authenticated: true,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    };
  }

  async fetchAttendance(): Promise<ERPAttendanceData> {
    return {
      courses: [
        {
          course_code: "JAVA101",
          course_name: "Java Programming",
          attended: 40,
          conducted: 51,
          percentage: 78.43,
        },
      ],
      fetched_at: new Date().toISOString(),
      sync_status: "success",
    };
  }
}
```

## Never Do

❌ Hardcode ERP passwords  
❌ Log ERP credentials  
❌ Store CAPTCHA solutions  
❌ Bypass authentication  
❌ Scrape without authorization  
❌ Use brute-force credentials  
❌ Ignore rate limits  
❌ Impersonate students  

## Testing With Your Account

**Important**: Only test with YOUR OWN authorized account.

1. Enable `VITE_ENABLE_ERP_INTEGRATION=true` in .env.local
2. Never commit credentials
3. Use temporary env vars
4. Do NOT record session cookies
5. Delete test data after verification

## Fallback Strategy

If ERP integration is blocked:

1. ✅ Demo mode fully works
2. ✅ CSV import available
3. ✅ Screenshot OCR ready
4. ✅ Manual entry available
5. ✅ Attendance calculations work

Users are never stuck with broken features.

## Error Handling

```typescript
if (captchaRequired) {
  return {
    success: false,
    error: {
      code: "CAPTCHA_REQUIRED",
      message: "Please complete CAPTCHA on ERP login",
    },
  };
}

if (mfaRequired) {
  return {
    success: false,
    error: {
      code: "MFA_REQUIRED",
      message: "Enter your MFA code",
    },
  };
}

if (endpointUnavailable) {
  return {
    success: false,
    error: {
      code: "ERP_UNAVAILABLE",
      message: "Attendance endpoint not accessible. Use manual import.",
    },
  };
}
```

## Timeline

- **Week 1**: ERP discovery and documentation
- **Week 2**: Architecture decision and mockup
- **Week 3**: Implementation based on findings
- **Week 4**: Testing and error handling
- **Week 5**: Documentation and deployment

If CAPTCHA/MFA blocks automated access, pivot to browser-redirect approach (no delay to project).

## Contact

Questions about ERP integration? Check:
- KLU official documentation
- Student forum
- ERP support email
- This file's latest version

Do not attempt to contact us with ERP credentials.
