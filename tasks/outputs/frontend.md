# Frontend Tasks — Implementation Summary

## Task 1: Decision Journal Tab

### `/Users/manuelpozas/mapo-terminal/client/src/pages/JournalTab.tsx` — CREATED

- `JournalEntry` interface with all required fields; `crypto.randomUUID()` with `Date.now()` fallback for IDs.
- localStorage key `"mapo_journal"` — entries loaded on mount via lazy state init, persisted via `useEffect`.
- Stats bar: total entries, win rate (wins / wins+losses), avg conviction for wins vs losses.
- Filter bar: outcome filter (ALL / PENDING / WIN / LOSS / NEUTRAL) and action filter (ALL / BUY / SELL / WATCH / AVOID).
- "New Entry" inline form toggle — fields: ticker (auto-uppercased), date (default today), action select, conviction 1-5 buttons, thesis textarea, MAPO score (optional number), outcome select.
- Entry list sorted by date descending; each row shows date, ticker, action badge, conviction dots (filled/empty), thesis truncated to 100 chars, outcome badge, actualReturn if set.
- Click row expands inline: full thesis + edit form for outcome and actualReturn + Save/Delete buttons.
- Delete uses `window.confirm`.
- `data-journal="*"` attributes on all key elements.

---

## Task 2: MAPO Score History

### `/Users/manuelpozas/mapo-terminal/client/src/pages/MAPOScoreTab.tsx` — UPDATED

- Added `ScoreHistoryEntry` interface: `{ ticker, score, signal, date, factors }`.
- localStorage key `"mapo_score_history"` — loaded on mount, persisted via `useEffect` on every change.
- On successful analysis: saves entry, deduplicates by ticker (keep latest), caps at 20 entries.
- Added HISTORY side panel (200px, right side) visible when `scoreHistory.length > 0`.
  - Each row: ticker | score (color-coded) | signal | date — clicking re-runs analysis.
  - "Clear History" button at panel bottom.
- All existing logic (in-session history pills, quick picks, factor breakdown, thesis/risks/catalysts) preserved unchanged.
- Outer layout changed from single flex column to a row container wrapping main content + history panel.

---

## Task 3: Persist Rebalance Targets

### `/Users/manuelpozas/mapo-terminal/client/src/pages/RebalanceTab.tsx` — UPDATED

- localStorage key scoped as `"mapo_rebalance_targets_" + portfolioId`.
- On mount/portfolioId change: `useEffect` loads saved targets from localStorage (resets to `{}` if none found or parse error).
- On every `targets` state change: `useEffect` writes to localStorage when targets is non-empty.
- `handleResetTargets` ("Equal Weight" button): also directly writes to localStorage after computing new targets.
- Seed logic (equal-weight defaults on first server data load) unchanged — runs only when `Object.keys(targets).length === 0`.

---

## Task 4: Fix Geographic Diversification

### `/Users/manuelpozas/mapo-terminal/client/src/components/RiskSuggestions.tsx` — UPDATED

- Added `INTERNATIONAL_ETFS` list (12 tickers) and `INTERNATIONAL_STOCKS` list (9 tickers) as module-level constants.
- Combined into `INTERNATIONAL_TICKERS` Set for O(1) lookup.
- Geographic suggestion now checks: `holdings.some(h => INTERNATIONAL_TICKERS.has(h.ticker.toUpperCase()))`.
  - If any international ticker found: suggestion is skipped entirely (no push to results).
  - If no international exposure: suggestion is shown with the specific tickers listed in the description.

---

## Task 5: JOURNAL Tab in Dashboard

### `/Users/manuelpozas/mapo-terminal/client/src/pages/Dashboard.tsx` — UPDATED

- Added import: `import { JournalTab } from "@/pages/JournalTab"`.
- Extended `TabId` union to `"PORTFOLIO" | "MARKET" | "SCREENER" | "MAPO" | "REBALANCE" | "JOURNAL"`.
- Added `{ id: "JOURNAL", label: "JOURNAL" }` to `TABS` array.
- Added conditional render: `{activeTab === "JOURNAL" && <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}><JournalTab /></div>}`.
- JournalTab receives no props (portfolio-agnostic, uses own localStorage).

---

## Files Modified
- `/Users/manuelpozas/mapo-terminal/client/src/pages/Dashboard.tsx`
- `/Users/manuelpozas/mapo-terminal/client/src/pages/MAPOScoreTab.tsx`
- `/Users/manuelpozas/mapo-terminal/client/src/pages/RebalanceTab.tsx`
- `/Users/manuelpozas/mapo-terminal/client/src/components/RiskSuggestions.tsx`

## Files Created
- `/Users/manuelpozas/mapo-terminal/client/src/pages/JournalTab.tsx`

## Notes
- No server files modified.
- No styling decisions — all inline styles are structural (flex, overflow, layout dimensions) only.
- No modal libraries used; all interactions are inline toggles or `window.confirm`.
