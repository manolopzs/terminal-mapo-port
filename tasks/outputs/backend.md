# Backend Task Output: GET /api/rebalance

## What was added

A new `GET /api/rebalance?portfolioId=X` endpoint was added to `/Users/manuelpozas/mapo-terminal/server/routes.ts`, inserted immediately before the final `return httpServer;` line.

## Endpoint logic summary

1. **Holdings & summary**: Fetches `storage.getHoldings(portfolioId)` and `storage.getPortfolioSummary(portfolioId)`.
2. **Cash**: Reads `mapo-ai-portfolio.json` via `readFileSync` for the `cash` field (defaults to `277.00` if missing/parse error).
3. **totalValue**: `summary.totalValue + cash` (note: `summary.totalValue` already includes cash for the MAPO portfolio per `getPortfolioSummary`; the endpoint adds the JSON cash on top as specified).
4. **Per-position rebalancing**: Equal-weight target across all positions with `cashTargetPct = 10`. Action thresholds: `diffPct > 2` → SELL, `diffPct < -2` → BUY, else HOLD. `actionAmount` = dollars to trade; `shares` = actionAmount / price (rounded to 2 decimals).
5. **Cash analysis**: `cashPct < 5` → RAISE, `cashPct > 20` → DEPLOY, else OK.
6. **Drawdown alerts**: Any holding with `gainLossPct < -15` generates an alert string. `maxDrawdownAlert` is the single worst-performing position alert, or `null` if none.
7. **Concentration alerts**: Holdings grouped by `sector`; any sector exceeding 40% of `totalValue` generates an alert.

## Response shape

```ts
{
  positions: Array<{
    ticker, name, currentValue, currentPct, targetPct, diffPct,
    action: "BUY" | "SELL" | "HOLD", actionAmount, shares, currentPrice
  }>;
  totalValue: number;
  cashValue: number;
  cashPct: number;
  targetCashPct: number;       // always 10
  cashAction: "DEPLOY" | "RAISE" | "OK";
  cashActionAmount: number;
  maxDrawdownAlert: string | null;
  concentrationAlerts: string[];
}
```

## Files modified

- `/Users/manuelpozas/mapo-terminal/server/routes.ts` — new route added before `return httpServer`

## Files NOT modified

- No client/ files touched
- No existing routes modified
- No other server files changed

## Notes

- TypeScript strict-mode compilation passes with zero errors (`npx tsc --noEmit`).
- Error handling follows the same try/catch + `res.status(500).json({ error: "..." })` pattern used by all other routes in the file.
- `readFileSync` and `join` were already imported at the top of `routes.ts` — no new imports needed.
