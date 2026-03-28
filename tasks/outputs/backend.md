# Backend Tasks — Completion Summary

**Date:** 2026-03-27

---

## Task 1: 52-Week High/Low via Finnhub — DONE

**File:** `server/liveData.ts`

Added `ExtendedQuote` interface and `fetchExtendedQuotes` function:
- Uses `cachedAsync` with TTL of 3,600,000ms (1 hour)
- Calls `/stock/metric?symbol=X&metric=all` for `metric["52WeekHigh"]` and `metric["52WeekLow"]`
- Calls `/quote?symbol=X` for `currentPrice`
- Both sub-calls are wrapped in `Promise.allSettled` so failures are isolated
- Graceful fallback: returns `0` for any missing field
- Full ticker list processed in parallel via `Promise.allSettled`

**File:** `server/routes.ts`

Added endpoint: `GET /api/live/extended-quotes?portfolioId=X`
- Fetches holdings for portfolio, extracts tickers, calls `fetchExtendedQuotes`
- Returns array of `ExtendedQuote` objects; caching is handled internally (1 hour TTL)

---

## Task 2: Macro Calendar Endpoint — DONE

**File:** `server/routes.ts`

Added endpoint: `GET /api/macro/calendar`

- Hardcoded 2026 FOMC dates (8 meetings), CPI release dates (12 reports), GDP advance dates (6 releases)
- Computes `daysUntil = Math.ceil((eventDate - now) / 86400000)`
- Filters to events within the next 90 days from today
- Sorts ascending by date
- Returns typed `MacroEvent` array with `date`, `type`, `label`, `impact`, `daysUntil`

---

## Task 3: Fix Rebalance Cash — DONE

**File:** `server/routes.ts` — `GET /api/rebalance`

Prior behavior: always read cash from `mapo-ai-portfolio.json` (or hardcoded 277.00), then added it to `summary.totalValue` (causing double-counting since `getPortfolioSummary` already includes cash).

Fixed priority order:
1. `storage.getPortfolioSummary(portfolioId)` already returns a `cash` field populated from `portfolioMeta` (seeded from JSON, updated in-memory). Used if it is a number.
2. Fall back to reading `mapo-ai-portfolio.json` directly.
3. Fall back to hardcoded `277.00`.

Also fixed the double-counting: `summary.totalValue` already includes cash, so `totalValue` is now set to `summary.totalValue` directly instead of `summary.totalValue + cash`.

---

## Task 4: fetchLiveQuotes — No Change Required

Confirmed: `/quote` endpoint does not return 52-week data. The separate `fetchExtendedQuotes` function (Task 1) is the correct approach. No changes to `fetchLiveQuotes`.

---

## Verification

`npx tsc --noEmit` — exit code 0, no TypeScript errors.

---

## Files Modified

- `/Users/manuelpozas/mapo-terminal/server/liveData.ts` — added `ExtendedQuote` interface and `fetchExtendedQuotes`
- `/Users/manuelpozas/mapo-terminal/server/routes.ts` — updated import, added two new endpoints, fixed rebalance cash logic
