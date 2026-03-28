# Parallel Agent Dispatch — MAPO Terminal

## Domain Boundaries

| Agent | Domain | Owns | Never touches |
|-------|--------|------|---------------|
| FRONTEND | Data logic, state, hooks, calculations | `client/src/components/`, `client/src/hooks/`, `client/src/pages/`, `client/src/lib/`, `client/src/utils/` — logic only | Styling, server files |
| BACKEND | API endpoints, Finnhub, Claude calls, auth | `api/`, `server/` | Client files |
| UI EXPERIENCE | Visual design only, no logic | `className` attributes, `client/src/index.css`, inline `style={}` objects | Any `.ts` logic, server files |

---

## Standard Dispatch Prompt (copy-paste)

```
I need three agents working in parallel. Each owns a distinct domain with zero file overlap.

Agent 1 — FRONTEND (logic only, no styling):
[describe your feature here]
Files in scope: client/src/components/, client/src/hooks/, client/src/pages/
Save summary to: tasks/outputs/frontend.md

Agent 2 — BACKEND (API and server only):
[describe your feature here]
Files in scope: api/, server/
Save summary to: tasks/outputs/backend.md

Agent 3 — UI EXPERIENCE (styling only, no logic):
[describe your feature here]
Files in scope: client/src/index.css, className and style= attributes only
Save summary to: tasks/outputs/ui.md

Rules: No agent touches another agent's files. Each saves output before closing.
```

---

## Usage Examples

### Add a new feature (e.g. "Add a watchlist tab")

**Agent 1 — FRONTEND:**
Add a `WatchlistTab.tsx` component that reads from a `useWatchlist()` hook.
Hook stores tickers in localStorage. No styling decisions — use placeholder classNames.

**Agent 2 — BACKEND:**
Add `GET /api/watchlist/quotes` endpoint that accepts a `tickers` query param
and calls `fetchLiveQuotes()`. Return standardized JSON.

**Agent 3 — UI EXPERIENCE:**
Style the watchlist table to match the terminal aesthetic —
monospace font, #080C14 background, #1A2332 borders, green/red for price changes.

---

## Output Files
After each run, check:
- `tasks/outputs/frontend.md`
- `tasks/outputs/backend.md`
- `tasks/outputs/ui.md`
