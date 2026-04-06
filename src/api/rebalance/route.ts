/**
 * POST /api/rebalance
 * Full monthly rebalance: macro + AGI thesis + screened candidates + Claude Opus portfolio construction
 */
import type { Request, Response } from "express";
import { getHoldings, getCash } from "../../lib/portfolio/state.js";
import { getFMPQuote } from "../../../server/lib/fmp.js";
import { callClaudeDeep } from "../../lib/claude/client.js";
import { REBALANCE_PROMPT } from "../../lib/claude/prompts/rebalance.js";
import { runValidation } from "../../lib/portfolio/validation.js";
import { enrichHoldings } from "../../lib/portfolio/calculations.js";
import { runMacroSentinel } from "../../lib/agents/intelligence/macro-sentinel.js";
import { runSituationalAwareness } from "../../lib/agents/agi-engine/situational-awareness.js";
import { RULES } from "../../lib/constants/rules.js";

// Run unified discovery for rebalance context
async function getTopCandidatesForRebalance(): Promise<any[]> {
  try {
    const { runDiscovery } = await import("../../lib/agents/discovery.js");
    const { candidates } = await runDiscovery();
    return candidates.slice(0, 20);
  } catch {
    return [];
  }
}

export async function rebalanceRoute(req: Request, res: Response): Promise<void> {
  try {
    console.log("[/api/rebalance] Starting full rebalance pipeline...");

    // Steps 1-3 in parallel: macro + AGI thesis + candidates
    const [macroResult, agiResult, candidatesResult, holdingsData, cashData] = await Promise.allSettled([
      runMacroSentinel(),
      runSituationalAwareness(),
      getTopCandidatesForRebalance(),
      getHoldings(),
      getCash(),
    ]);

    const macro = macroResult.status === "fulfilled" ? macroResult.value : null;
    const agi = agiResult.status === "fulfilled" ? agiResult.value : null;
    const candidates = candidatesResult.status === "fulfilled" ? candidatesResult.value : [];
    const holdings = holdingsData.status === "fulfilled" ? holdingsData.value : [];
    const cash = cashData.status === "fulfilled" ? cashData.value : 0;

    // Step 4: Get current portfolio with live prices
    let quotes: any[] = [];
    if (holdings.length > 0) {
      const raw = await getFMPQuote(holdings.map(h => h.ticker).join(",")).catch(() => []);
      quotes = Array.isArray(raw) ? raw : [];
    }

    const totalValue = holdings.reduce((s, h) => {
      const q = quotes.find((q: any) => q.symbol === h.ticker);
      return s + h.shares * (q?.price ?? h.entryPrice);
    }, 0) + cash;

    const enriched = enrichHoldings(
      holdings,
      quotes.map((q: any) => ({
        symbol: q.symbol, price: q.price ?? 0,
        changesPercentage: q.changesPercentage ?? 0,
        avgVolume: q.avgVolume ?? 0, marketCap: q.marketCap ?? 0,
      })),
      totalValue
    );

    const validation = runValidation(enriched, cash, totalValue);

    // Step 5: Build Claude context
    const context = {
      currentDate: new Date().toISOString().split("T")[0],
      macroRegime: macro?.regime ?? "UNKNOWN",
      macroKeyEvents: macro?.keyEvents ?? [],
      agiThesisStatus: agi?.status ?? "UNKNOWN",
      agiConfidence: agi?.confidenceLevel ?? 50,
      agiImplications: agi?.implicationsForPortfolio ?? "",
      portfolioValue: totalValue,
      cash,
      cashPct: totalValue > 0 ? (cash / totalValue) * 100 : 0,
      currentHoldings: enriched.map(h => ({
        ticker: h.ticker,
        company: h.companyName,
        sector: h.sector,
        shares: h.shares,
        entryPrice: h.entryPrice,
        currentPrice: h.currentPrice,
        value: h.value,
        weightPct: h.weightPct,
        returnPct: h.returnPct,
        entryScore: h.entryScore,
      })),
      topCandidates: candidates.map(c => ({
        ticker: c.ticker,
        company: c.companyName,
        sector: c.sector,
        marketCap: c.marketCap,
        agiAlignmentScore: c.agiAlignmentScore,
        screenType: c.screenType,
        notes: c.screeningNotes,
      })),
      validationStatus: validation,
      constraints: {
        minPositions: RULES.MIN_POSITIONS,
        maxPositions: RULES.MAX_POSITIONS,
        maxSinglePositionPct: RULES.MAX_SINGLE_POSITION_PCT,
        maxSectorPct: RULES.MAX_SECTOR_PCT,
        minEntryCScore: RULES.MIN_ENTRY_SCORE,
        minCashPct: RULES.MIN_CASH_PCT,
        maxCashPct: RULES.MAX_CASH_PCT,
      },
    };

    // Step 6: Claude Opus portfolio construction
    const memo = await callClaudeDeep(
      REBALANCE_PROMPT,
      JSON.stringify(context, null, 2)
    );

    res.json({
      memo,
      macro,
      agi,
      context,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[/api/rebalance]", err);
    res.status(500).json({ error: err.message });
  }
}
