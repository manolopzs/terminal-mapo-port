# Ship Review — mapo-terminal
**Date:** 2026-03-28
**Reviewer:** SHIP REVIEW Agent
**Session changes reviewed:** Header.tsx, HoldingsTable.tsx, PerformanceChart.tsx, Dashboard.tsx, MarketTab.tsx, ScreenerTab.tsx, MAPOScoreTab.tsx, .vscode/tasks.json

---

## Blockers (must fix before push)

### BLOCKER-1 — Hardcoded credentials in source code [CHECK 15]
**File:** `client/src/lib/auth.ts` (original, pre-fix)
**Issue:** `VALID_EMAIL` and `VALID_PASS` were hardcoded as plaintext string literals directly in the source file. If pushed to GitHub, the personal email and password would be permanently exposed in the repo's git history and visible to anyone with access.
**Status: FIXED** — Credentials have been moved to `import.meta.env.VITE_AUTH_EMAIL` and `import.meta.env.VITE_AUTH_PASS`. The corresponding values were added to `.env` (which is already in `.gitignore`). The login function now fails fast with a descriptive console error if the env vars are absent, preventing silent bypass.
**Action required from Chief Engineer:** Before pushing, verify that the original hardcoded values do NOT appear in any prior git commit via `git log -S "mapo@redacted.io"`. If they appear in history, use `git filter-repo` or `BFG Repo Cleaner` to scrub them before the push.

---

## Warnings (fix soon after push)

### WARNING-1 — Credentials baked into Vite build bundle [CHECK 15]
Because `VITE_AUTH_*` variables are injected at build time, the credentials will be embedded in the compiled JS bundle (the client-side bundle) as plaintext. Any user who loads the app and inspects the minified JS can extract them.
**Context:** This is a personal single-user app running on localhost, so the attack surface is very low. However, it is architecturally weak. Proper fix: move auth to a server-side endpoint (`POST /api/login`) that checks credentials server-side, and issue a session token/cookie. Acceptable to ship now given scope; revisit before any public hosting.

### WARNING-2 — No API auth middleware on server routes [CHECK 5]
All `/api/*` routes (holdings, trades, portfolios, chat, MAPO score) are fully unauthenticated at the server level. Auth is only enforced in the React router client-side. Any request to `localhost:3001/api/holdings` without a browser session will succeed.
**Context:** This is low risk for localhost-only deployment. For any cloud/VPS deployment, add an Express middleware that validates session before serving data routes.

### WARNING-3 — `tasks.json` dev server task exposes `.env` in terminal [CHECK 15 / CHECK 7]
The "Dev Server" task runs `export $(cat .env | xargs) && npm run dev`, which echoes the contents of `.env` (including API keys) into the VSCode integrated terminal. The task has `"reveal": "always"`. Terminal history and screen recordings can capture these values.
**Recommendation:** Replace with `dotenv-cli`: `npx dotenv -e .env -- npm run dev`, or rely on the standard `dotenv` loading in the server entry point (already present) and remove the explicit `cat .env | xargs` approach.

### WARNING-4 — `/api/performance` reads `price-data.json` with synchronous `readFileSync` on every request [CHECK 1]
`server/routes.ts` line ~268 uses `readFileSync` inside an async route handler. On every request to the performance endpoint the entire price data file is read synchronously, blocking the Node event loop. Under any real concurrency this degrades response time for all concurrent requests.
**Recommendation:** Load and cache the file at server startup, or use `fs.promises.readFile`.

### WARNING-5 — No error monitoring / Sentry [CHECK 14]
There is no external error monitoring. Server errors are logged to console only. Production errors (especially Finnhub timeouts, Anthropic API failures) are invisible unless actively watching the terminal.
**Recommendation:** Add Sentry SDK or at minimum a structured log file for the `/api/chat` and live data endpoints, which are the most likely to fail in production.

### WARNING-6 — `setTimeout` in Dashboard.tsx is a race condition mask [CHECK 8]
`Dashboard.tsx` line 74 uses `setTimeout(() => setLoadingTimeout(true), 8000)` as a fallback for when portfolios fail to load. This is documented as a safety valve, and the code is well-commented — it's not hiding a bug. However, on slow connections legitimate users will see the broken skeleton state for 8 seconds before the fallback fires. Consider a tighter 3–4s threshold.

---

## Passed

### CHECK 1 — Async error handling in changed UI components
All new `useQuery` calls in `Header.tsx`, `PerformanceChart.tsx`, and `MarketTab.tsx` degrade gracefully: they show "—" fallback values when data is null/undefined. No crashes on missing data.

### CHECK 3 — Third-party API failure handling
`liveData.ts`: all Finnhub calls use `AbortSignal.timeout(8000)`, are wrapped in `try/catch`, use `Promise.allSettled` to prevent one failure from killing the batch, and return `null` gracefully. The `finnhub()` helper returns `null` when `FINNHUB_API_KEY` is absent. The in-memory cache prevents hammering the API.

### CHECK 3 (Anthropic) — AI Analyst API failure
`routes.ts`: the `/api/chat` endpoint has a `try/catch` that returns `{ error: "Failed to get AI response" }` with a 500 status. The client-side timeout in `useSendChatMessage` (90s) will abort and surface a user-readable error message.

### CHECK 4 — Loading states on new features
- `PerformanceChart.tsx`: renders a "LOADING..." state during data fetch.
- `ScreenerTab.tsx`: shows "Fetching live quotes..." during load.
- `MAPOScoreTab.tsx`: shows a spinner with animated `Loader2` icon during analysis.
- `Dashboard.tsx` Add Position button: correctly disabled with text "Adding..." when `createHolding.isPending`.
- `HoldingsTable.tsx` Delete button: disabled when `deleteHolding.isPending`.

### CHECK 4 — Empty states handled
- `HoldingsTable.tsx`: footer P&L section only renders when `holdings.length > 0`.
- `Header.tsx`: all values fall back to `0` or `"—"` when summary/perfData is null.
- `MarketTab.tsx` portfolio section: conditionally rendered only when `portfolioHoldings.length > 0`.
- `PerformanceChart.tsx`: handles `rawData.length === 0` gracefully.

### CHECK 4 — Double submission prevention
- "Add Position" dialog submit button is disabled during pending mutation.
- MAPO Score analyze button is disabled during `analyze.isPending`.
- Delete holding button is disabled during pending mutation.

### CHECK 8 — setTimeout legitimacy
- `use-toast.ts` `setTimeout`: manages toast dismissal timing — legitimate.
- `Dashboard.tsx` `setTimeout(8000)`: documented safety timeout — legitimate though aggressive.
- `use-portfolio.ts` `setTimeout(90000)`: AI request abort timeout — legitimate.
- `Login.tsx` `setTimeout`: used for error message delay — minor but not a race condition mask.
- `AIAnalyst.tsx` `setTimeout(300)`: focus management after panel opens — legitimate UI concern.

### CHECK 10 — Error message exposure
Server-side errors return generic messages to the client (`"Failed to get AI response"`, `"Failed to fetch"`, etc.). Detailed errors are logged to `console.error` only (server side). The global error handler in `server/index.ts` catches unhandled exceptions and returns `{ message: err.message }` — the message field could potentially leak internal details, but in practice all routes have their own `try/catch` before reaching it.

### CHECK 12 — Caching
Finnhub data is cached in-memory with appropriate TTLs (60s for quotes, 1hr for earnings/extended quotes, 5min for sentiment, 10min for news). TanStack Query staleTime/refetchInterval on the client complements the server cache.

### CHECK 15 — CORS
No CORS headers are set. The server binds to `127.0.0.1` (localhost only), so cross-origin requests are not possible in a production context. Not a risk for current deployment.

### CHECK 15 — SQL injection
The app uses SQLite via an ORM (`storage.*` abstraction) with Zod schema validation at the route level (`insertHoldingSchema.safeParse`, `insertTradeSchema.safeParse`). No raw SQL string interpolation found in changed or reviewed files.

### CHECK 15 — Symbol injection in market API
The `/api/market/quotes` route splits and caps the symbols list. `liveData.ts` sanitizes each symbol with `.replace(/[^A-Z0-9.\-]/gi, "")` and enforces a max length of 10 chars before passing to Finnhub URLs.

---

## Not Applicable

### CHECK 2 — Database performance at scale
This is a personal single-user SQLite app with O(10s) of holdings. Index optimization and N+1 query analysis are not meaningful at this scale.

### CHECK 6 — File upload limits and validation
No file upload functionality exists in this application.

### CHECK 7 — Staging environment
This is a personal portfolio terminal without a CI/CD pipeline. No staging environment is relevant.

### CHECK 9 — Abuse and bot detection
This is a single-user personal finance app running on localhost. Rate limiting on auth endpoints is not relevant.

### CHECK 11 — Dependency health (`npm audit`)
Not run during this review (would require executing commands). Chief Engineer should run `npm audit` before pushing. The `vscode/tasks.json` changes add no new npm dependencies.

### CHECK 13 — Mobile experience
The app is explicitly designed as a Bloomberg-style desktop terminal. Fixed-height header (52px), multi-column grid layouts, and small font sizes (9–11px) make this intentionally desktop-only. Mobile adaptation is out of scope.

---

## VERDICT

**NOT READY — 1 blocker was found and has been fixed in this review session.**

The blocker (hardcoded plaintext credentials in `auth.ts`) has been resolved: credentials are now loaded from `VITE_AUTH_EMAIL` / `VITE_AUTH_PASS` env vars and the values are stored in `.env` (gitignored).

**Chief Engineer action required before `git push`:**

1. **Run `git log -S "mapo@redacted.io"` and `git log -S "REDACTED"`** — if either string appears in any prior commit, scrub the history with `git filter-repo --replace-text` or BFG before pushing. This is the most important step.
2. **Verify `.env` is NOT staged**: `git status` must not show `.env` in staged or untracked files to be committed.
3. **Run `npm audit`** — no audit was executed during this review.
4. **Confirm `VITE_AUTH_EMAIL` and `VITE_AUTH_PASS` are set in `.env`** on any machine where the app will be built — the login form will be non-functional without them.

Once the git history check passes and the above steps are confirmed, the code is safe to push. All 7 UI/feature changes (Header indices, HoldingsTable VALUE column, PerformanceChart period selector, Dashboard stats bar + keyboard shortcuts, MarketTab holdings section, ScreenerTab day range bar, MAPOScoreTab position sizing panel) are production-quality with proper loading states, error handling, and empty-state management.
