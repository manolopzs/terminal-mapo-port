/**
 * MAPO Dynamic Discovery Agent
 * Uses FMP company-screener API to build a fresh universe every run.
 * No hardcoded ticker lists — the market defines the universe.
 *
 * Flow: FMP screener (by sector) → filter ETFs → exclusion → AGI alignment → diversify → top 30
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
  "Healthcare",
  "Energy",
];

/* ── Config ──────────────────────────────────────────────────────────────── */

const MIN_MARKET_CAP = 500_000_000;
const MAX_MARKET_CAP = 50_000_000_000;
const MIN_LIQUIDITY = 5_000_000;
const TOP_N = 30;
// Max candidates per sector/industry to ensure diversity
const MAX_PER_SECTOR = 8;
const MAX_PER_INDUSTRY = 4;

/* ── Main discovery function ─────────────────────────────────────────────── */

export interface DiscoveryResult {
  candidates: CandidateTicker[];
  stats: { total: number; excluded: number; filtered: number; passed: number };
}

export async function runDiscovery(): Promise<DiscoveryResult> {
  console.log("[discovery] Scanning FMP company-screener across sectors...");

  // Query all sectors in parallel
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

    // Skip ETFs, funds, and ADRs
    if (stock.isEtf || stock.isFund || stock.isAdr) { filtered++; continue; }

    // Exclusion check
    const exclusion = isExcluded(ticker);
    if (exclusion.excluded) { excluded++; continue; }

    const marketCap: number = stock.marketCap ?? 0;
    const price: number = stock.price ?? 0;
    const volume: number = stock.volume ?? 0;

    // Market cap bounds
    if (marketCap < MIN_MARKET_CAP || marketCap > MAX_MARKET_CAP) { filtered++; continue; }

    // Liquidity filter
    if (price > 0 && volume > 0 && volume * price < MIN_LIQUIDITY) { filtered++; continue; }

    // Must be actively trading
    if (stock.isActivelyTrading === false) { filtered++; continue; }

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
      screeningNotes: stock.industry ?? stock.sector ?? "BROAD",
      screenType: stock.sector ?? "BROAD",
    });
  }

  // Sort by AGI alignment descending, then market cap descending
  candidates.sort((a, b) => {
    if (b.agiAlignmentScore !== a.agiAlignmentScore) {
      return b.agiAlignmentScore - a.agiAlignmentScore;
    }
    return b.marketCap - a.marketCap;
  });

  // Diversify: cap per sector AND per industry so the top 30 isn't all semis or defense
  const sectorCount = new Map<string, number>();
  const industryCount = new Map<string, number>();
  const diversified: CandidateTicker[] = [];

  for (const c of candidates) {
    const sector = c.sector;
    const industry = c.industry;
    const sc = sectorCount.get(sector) ?? 0;
    const ic = industryCount.get(industry) ?? 0;
    if (sc >= MAX_PER_SECTOR) continue;
    if (ic >= MAX_PER_INDUSTRY) continue;
    sectorCount.set(sector, sc + 1);
    industryCount.set(industry, ic + 1);
    diversified.push(c);
    if (diversified.length >= TOP_N) break;
  }

  console.log(`[discovery] ${unique.length} unique → ${excluded} excluded, ${filtered} filtered → ${diversified.length} candidates`);

  return {
    candidates: diversified,
    stats: {
      total: unique.length,
      excluded,
      filtered,
      passed: diversified.length,
    },
  };
}
