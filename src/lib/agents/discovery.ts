/**
 * MAPO Dynamic Discovery Agent
 * Uses FMP stock screener API to build a fresh universe every run.
 * No hardcoded ticker lists — the market defines the universe.
 *
 * Flow: FMP screener (by sector) → exclusion → AGI alignment scoring → top 30
 */
import { screenStocks } from "../../../server/lib/fmp.js";
import { isExcluded } from "../constants/exclusion-list.js";
import { getAgiAlignment } from "../constants/sector-map.js";
import type { CandidateTicker } from "../fmp/types.js";

/* ── Sectors to scan — aligned with MAPO AGI thesis ─────────────────────── */

const SECTORS_TO_SCAN = [
  "Technology",
  "Industrials",
  "Utilities",
  "Communication Services",
  "Financial Services",
  "Healthcare",
  "Energy",
  "Basic Materials",
  "Consumer Cyclical",
  "Consumer Defensive",
];

/* ── Config ──────────────────────────────────────────────────────────────── */

const MIN_MARKET_CAP = 500_000_000;
const MAX_MARKET_CAP = 50_000_000_000;
const MIN_LIQUIDITY = 5_000_000;
const TOP_N = 30;

/* ── Main discovery function ─────────────────────────────────────────────── */

export interface DiscoveryResult {
  candidates: CandidateTicker[];
  stats: { total: number; excluded: number; filtered: number; passed: number };
}

export async function runDiscovery(): Promise<DiscoveryResult> {
  console.log("[discovery] Scanning FMP stock screener across sectors...");

  // Query all sectors in parallel — each returns up to 1000 stocks
  const sectorResults = await Promise.allSettled(
    SECTORS_TO_SCAN.map(sector =>
      screenStocks({
        sector,
        marketCapMoreThan: MIN_MARKET_CAP,
        marketCapLessThan: MAX_MARKET_CAP,
        country: "US",
      })
    )
  );

  // Collect all raw results
  const allStocks: any[] = [];
  for (const result of sectorResults) {
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      allStocks.push(...result.value);
    }
  }

  console.log(`[discovery] FMP returned ${allStocks.length} stocks across ${SECTORS_TO_SCAN.length} sectors`);

  // Deduplicate by ticker
  const seen = new Set<string>();
  const unique: any[] = [];
  for (const stock of allStocks) {
    const ticker = (stock.symbol ?? "").toUpperCase();
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    unique.push(stock);
  }

  // Apply filters
  let excluded = 0;
  let filtered = 0;
  const candidates: CandidateTicker[] = [];

  for (const stock of unique) {
    const ticker = (stock.symbol ?? "").toUpperCase();

    // Exclusion check
    const exclusion = isExcluded(ticker);
    if (exclusion.excluded) { excluded++; continue; }

    const marketCap: number = stock.marketCap ?? 0;
    const price: number = stock.price ?? stock.lastAnnualDividend ?? 0;
    const volume: number = stock.volume ?? stock.avgVolume ?? 0;

    // Market cap bounds (redundant with screener params but defensive)
    if (marketCap < MIN_MARKET_CAP || marketCap > MAX_MARKET_CAP) { filtered++; continue; }

    // Liquidity filter
    if (price > 0 && volume > 0 && volume * price < MIN_LIQUIDITY) { filtered++; continue; }

    // AGI alignment score from sector/industry
    const agiScore = getAgiAlignment(
      stock.sector ?? "",
      stock.industry ?? "",
      stock.companyName ?? ""
    );

    candidates.push({
      ticker,
      companyName: stock.companyName ?? ticker,
      marketCap,
      sector: stock.sector ?? "Unknown",
      industry: stock.industry ?? "Unknown",
      agiAlignmentScore: agiScore,
      screeningNotes: stock.sector ?? "BROAD",
      screenType: stock.sector ?? "BROAD",
    });
  }

  // Sort: highest AGI alignment first, then largest market cap
  candidates.sort((a, b) => {
    if (b.agiAlignmentScore !== a.agiAlignmentScore) {
      return b.agiAlignmentScore - a.agiAlignmentScore;
    }
    return b.marketCap - a.marketCap;
  });

  const topCandidates = candidates.slice(0, TOP_N);

  console.log(`[discovery] ${unique.length} unique → ${excluded} excluded, ${filtered} filtered → ${topCandidates.length} candidates`);

  return {
    candidates: topCandidates,
    stats: {
      total: unique.length,
      excluded,
      filtered,
      passed: topCandidates.length,
    },
  };
}
