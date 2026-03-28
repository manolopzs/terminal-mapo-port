# Rebalance Tab — Frontend Implementation

## Files Created

### `/Users/manuelpozas/mapo-terminal/client/src/hooks/use-rebalance.ts`
- Exports `RebalanceData` and `RebalancePosition` interfaces matching the spec exactly.
- `useRebalance(portfolioId: string)` wraps `useQuery` with key `["/api/rebalance", portfolioId]`, fetches `./api/rebalance?portfolioId=X`, `staleTime: 30_000`, and `enabled: !!portfolioId`.

### `/Users/manuelpozas/mapo-terminal/client/src/pages/RebalanceTab.tsx`
- Named export `RebalanceTab` accepting `{ portfolioId: string }`.
- Loading state: spinner + text while `isLoading`.
- Error state: `AlertTriangle` icon + "Failed to load rebalance data" + Retry button that calls `queryClient.invalidateQueries`.
- Positions table with columns: TICKER | NAME | CURRENT % | TARGET % | DIFF | ACTION | AMOUNT.
  - TARGET % column renders a numeric `<input>` per row; user edits are stored in `useState<Record<string, number>>`.
  - DIFF and ACTION are recalculated locally whenever targets change (via `computeLocalDiff`).
  - AMOUNT shows dollar value; if `currentPrice > 0`, also shows estimated shares.
- Cash section showing current %, target %, and cash action (DEPLOY / RAISE / OK) with icon.
- Alerts section: `maxDrawdownAlert` and each `concentrationAlerts` entry rendered with `AlertTriangle`.
- "Recalculate" button calls `queryClient.invalidateQueries({ queryKey: ["/api/rebalance", portfolioId] })`.
- "Equal Weight" button resets targets to 95% divided equally across positions (preserving min 5% cash).
- All key elements carry `data-rebalance="*"` attributes for UI agent targeting.
- Icons used: `RefreshCw`, `AlertTriangle`, `TrendingUp`, `TrendingDown`, `Minus`, `Loader2` (lucide-react).

## Files Modified

### `/Users/manuelpozas/mapo-terminal/client/src/pages/Dashboard.tsx`
- Added import: `import { RebalanceTab } from "@/pages/RebalanceTab";`
- Extended `TabId` union to include `"REBALANCE"`.
- Added `{ id: "REBALANCE", label: "REBALANCE" }` to the `TABS` array.
- Added conditional render block for `activeTab === "REBALANCE"` that renders `<RebalanceTab portfolioId={activePortfolioId} />`.

## Implementation Notes
- Target allocations are seeded on first data load: server `targetPct` is used when non-zero, otherwise equal weight (95% / n positions).
- Diff threshold for action: BUY if diff < -0.5%, SELL if diff > 0.5%, otherwise HOLD — avoids hair-trigger trades on tiny rounding differences.
- No styling decisions were made; all inline styles are structural layout only (flex/grid/padding/overflow).
- No server files were modified.
