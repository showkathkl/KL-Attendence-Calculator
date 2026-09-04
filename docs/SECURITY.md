# Security Architecture

## 🔐 What We Protect

### Credentials

- ❌ ERP passwords: Never stored, only in-memory during auth
- ❌ MFA codes: Never logged or cached
- ❌ CAPTCHA solutions: User-solved, never stored
- ✅ Session tokens: Encrypted, HTTP-only cookies
- ✅ API keys: Service-role key never sent to frontend

### Data

- ✅ User attendance: Row-Level Security enforced
- ✅ Timetable: RLS prevents cross-user access
- ✅ Personal info: Encrypted at rest
- ✅ Sync history: No sensitive fields logged

### Auth Flow

- ✅ Supabase Auth with email/password + OAuth
- ✅ App credentials separate from ERP credentials
- ✅ Session expiration enforced
- ✅ Logout clears sensitive data

## 🛡️ Security Measures

### Frontend

```typescript
// ✅ Good: Clear sensitive data on unmount
useEffect(() => {
  return () => {
    setCredentials({});
    sessionStorage.clear();
  };
}, []);

// ❌ Bad: Storing password in state
const [password, setPassword] = useState("");
```

### Backend

```typescript
// ✅ Good: Sensitive data in request body only
app.post("/api/erp/connect", (req, res) => {
  const { username, password } = req.body;
  // Process in memory only
  const session = authenticate(username, password);
  // Password cleared
  delete req.body.password;
  // Return only session ID
  res.json({ session_id: session.id });
});

// ❌ Bad: Logging credentials
logger.info(`User ${username} logged in with ${password}`);
```

### Database

```sql
-- ✅ Good: RLS prevents unauthorized access
CREATE POLICY "Users can view their own attendance"
  ON attendance_records
  FOR SELECT
  USING (auth.uid() = user_id);

-- ✅ Good: Sensitive fields omitted
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT,
  error_message TEXT,  -- No credentials
  synced_at TIMESTAMP
);

-- ❌ Bad: Storing passwords
CREATE TABLE users (
  id UUID,
  email TEXT,
  erp_password TEXT  -- NEVER
);
```

### Network

```typescript
// ✅ Good: HTTPS enforced, secure headers
if (process.env.NODE_ENV === "production") {
  app.use(helmet());
  app.use(
    express.static("public", {
      setHeaders: (res) => {
        res.setHeader("Strict-Transport-Security", "max-age=31536000");
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    })
  );
}

// ✅ Good: CORS configured
app.use(
  cors({
    origin: process.env.VITE_FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

// ❌ Bad: Credentials in URL
// GET /api/sync?username=user&password=pass
```

## 🚫 Forbidden Patterns

### No CAPTCHA Bypass

```typescript
// ❌ FORBIDDEN
async function bypassCaptcha(token: string) {
  // Send to solving service
  const solution = await captchaService.solve(token);
  return solution;
}

// ✅ ALLOWED
async function handleCaptcha() {
  return {
    requires_captcha: true,
    message: "Complete CAPTCHA on ERP login",
  };
}
```

### No MFA Circumvention

```typescript
// ❌ FORBIDDEN
function bypassMFA(userId: string) {
  return createSession(userId); // Without MFA
}

// ✅ ALLOWED
async function completeMFA(code: string) {
  if (!validateCode(code)) throw new Error("Invalid code");
  return createSession(userId);
}
```

### No Credential Brute-Force

```typescript
// ❌ FORBIDDEN
for (let attempt = 0; attempt < 10000; attempt++) {
  tryLogin(username, generatePassword(attempt));
}

// ✅ ALLOWED
app.post("/login", rateLimiter(10, "15m"), (req, res) => {
  // Max 10 attempts per 15 minutes
  authenticate(req.body);
});
```

### No Student Impersonation

```typescript
// ❌ FORBIDDEN
app.get("/api/attendance/:userId", (req, res) => {
  // Fetch any user's data
  return getAttendance(req.params.userId);
});

// ✅ ALLOWED
app.get("/api/attendance", (req, res) => {
  // Only current user's data
  return getAttendance(req.user.id);
});
```

## 🔍 RLS Policies

Every table must have RLS enabled:

```sql
-- Users can only view their own profiles
CREATE POLICY "own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can only update their own profiles
CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- No user can delete profiles (app-enforced only)
CREATE POLICY "no_delete" ON profiles
  FOR DELETE USING (false);
```

Test RLS:

```typescript
it("User A cannot read User B's attendance", async () => {
  const userAData = await supabase
    .auth.signInWithPassword({ email: "a@test.com", password: "pwd" });

  const userBAttendance = await supabase
    .from("attendance_records")
    .select("*")
    .eq("user_id", userB.id);

  expect(userBAttendance.error).toBeDefined();
  expect(userBAttendance.data).toEqual([]);
});
```

## 🚨 Error Handling

Never expose internal details:

```typescript
// ❌ Bad: Leaks information
catch (error) {
  return res.status(500).json({
    error: error.message, // "Connection to 192.168.1.1:3306 refused"
    stack: error.stack,
  });
}

// ✅ Good: Generic message
catch (error) {
  logger.error("Database error", error);
  return res.status(500).json({
    error: {
      code: "DATABASE_ERROR",
      message: "An error occurred. Please try again.",
    },
  });
}
```

## 📋 Security Checklist

### Before Production

- [ ] Supabase RLS policies tested
- [ ] Environment variables configured (not committed)
- [ ] HTTPS enforced
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Error messages sanitized
- [ ] No credentials in logs
- [ ] No sensitive fields in API responses
- [ ] Password hashing verified (Supabase handles)
- [ ] Session timeouts configured
- [ ] CSRF protection enabled
- [ ] Helmet.js or equivalent
- [ ] Security headers set
- [ ] Dependencies audited (`npm audit`)
- [ ] No test data in production
- [ ] Backup strategy in place

### Regular Audits

- Weekly: `npm audit`
- Monthly: Security scanning
- Quarterly: Penetration testing
- Annually: Full security audit

## 🔔 Reporting Security Issues

**Do not open public issues for security vulnerabilities.**

Email security concerns to: [your-email@domain.com]

Include:
- Vulnerability description
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

You will receive acknowledgment within 48 hours.

## 📚 References

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Supabase Security: https://supabase.com/docs/guides/auth
- Node.js Security: https://nodejs.org/en/docs/guides/security/
- TypeScript Strict Mode: https://www.typescriptlang.org/tsconfig#strict

## Version History

- **v1.0** (Sept 2024): Initial security architecture
- Planned: Regular security updates

Last Updated: September 2024
