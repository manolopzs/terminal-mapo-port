# AI Code Ship Checklist
> Source skill: AI Code Issues SKILL.md
> Version: 1.0 — loaded into every SHIP REVIEW agent session

A production readiness review for apps and features built with AI assistance.
Most AI-generated bugs only surface under real traffic — this checklist catches them before users do.

---

## The 15 Checks

### 1. Real Traffic vs. Development
- [ ] Has the app been load tested or stress tested?
- [ ] Are there any unhandled async edge cases (double submissions, stale state)?
- [ ] Has it been tested with realistic (messy, unexpected) user input?

### 2. Database Performance at Scale
- [ ] Are indexes in place on all columns used in WHERE, JOIN, and ORDER BY clauses?
- [ ] Have queries been tested with production-scale data volumes?
- [ ] Are there any N+1 query patterns (loading related records in a loop)?

### 3. Third-Party API Failure Handling
- [ ] What happens if Finnhub, Anthropic API, or any other dependency goes down?
- [ ] Are all external API calls wrapped in try/catch with meaningful fallback behavior?
- [ ] Are there timeouts set on all HTTP requests to external services?

### 4. UI Loading and Feedback States
- [ ] Is every async action represented visually (spinner, disabled state, progress)?
- [ ] Are empty states handled (no data, no results, no items)?
- [ ] Can a user accidentally submit the same form multiple times?

### 5. Authentication and Authorization Review
- [ ] Has every auth flow been manually reviewed line by line?
- [ ] Are authorization checks applied at the route/middleware level?
- [ ] Are sessions properly invalidated on logout?

### 6. File Upload Limits and Validation
- [ ] Is there a maximum file size enforced server-side?
- [ ] Is file type validated server-side by content, not just extension?
- [ ] Are storage paths safe from path traversal?

### 7. Staging Environment
- [ ] Is there a staging environment that mirrors production config?
- [ ] Are environment variables (API keys, DB URLs) properly separated per environment?
- [ ] Is the CI/CD pipeline deploying to staging before prod?

### 8. setTimeout as a Fix
- [ ] Search codebase for all `setTimeout` and `setInterval` calls
- [ ] For each one: legitimate use (animation, polling) or masking a race condition?
- [ ] Are async operations properly awaited instead of being "fixed" with delays?

### 9. Abuse and Bot Detection
- [ ] Is rate limiting in place on auth endpoints (login, signup, password reset)?
- [ ] Is there protection against form spam or credential stuffing?
- [ ] Are there any endpoints that could be abused for enumeration?

### 10. Error Message Exposure
- [ ] Are all error messages shown to users generic and non-technical?
- [ ] Are detailed errors logged server-side only, not returned in API responses?
- [ ] Is there a global error handler that catches unhandled exceptions?

### 11. Dependency Health
- [ ] Run `npm audit` — are there any high/critical vulnerabilities?
- [ ] Are there any dependencies that haven't been updated in 2+ years?
- [ ] Are all packages pinned to specific versions?

### 12. Caching Layer
- [ ] Are frequently read, rarely changed resources cached?
- [ ] Is there cache invalidation logic when underlying data changes?
- [ ] Are static assets cached at the CDN level?

### 13. Mobile Experience
- [ ] Has the app been tested on real mobile devices or accurate browser emulation?
- [ ] Are all interactive elements at least 44x44px (minimum tap target)?
- [ ] Does the layout degrade gracefully at 375px width?
- [ ] Does the mobile keyboard push content out of view on form inputs?

### 14. User Feedback Mechanism
- [ ] Is there any error monitoring in place (Sentry or similar)?
- [ ] Is there a way for users to report issues from within the app?
- [ ] Are server-side errors being logged somewhere visible?

### 15. Basic Security Audit
- [ ] Run static analysis linter with security rules enabled
- [ ] Check for hardcoded secrets, API keys, or credentials in the codebase
- [ ] Verify HTTPS is enforced everywhere
- [ ] Check CORS configuration — is it set to `*` anywhere it shouldn't be?
- [ ] Are SQL queries parameterized (not string-interpolated)?

---

## Output Format

After reviewing, produce a report at `tasks/outputs/ship-review.md` in this structure:

**Blockers (must fix before push)**
- Items that represent active, likely risks

**Warnings (fix soon after push)**
- Items that are risky but lower probability or lower impact

**Passed**
- Items that are clearly handled

**Not applicable**
- Items that don't apply to this stack or context

---

## Quick Wins (if time is limited)

1. Add `try/catch` around every external API call
2. Add a global error handler that returns generic messages to users
3. Run `npm audit --fix`
4. Disable all buttons during async operations in the UI
5. Verify no secrets are in git history (`git log -S "API_KEY"`)
