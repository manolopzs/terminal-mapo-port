/**
 * MAPO Dynamic Discovery Agent
 *
 * 3-tier universe sourcing:
 *   1. FMP company-screener  (if plan allows)
 *   2. Yahoo Finance predefined screeners  (free, no key, live market data)
 *   3. Curated stock universe  (static fallback of last resort)
 *
 * Flow: source → deduplicate → filter → exclusion → AGI alignment → top 30
 */
import { screenStocks } from "../../../server/lib/fmp.js";
import { isExcluded } from "../constants/exclusion-list.js";
import { getAgiAlignment } from "../constants/sector-map.js";
import { STOCK_UNIVERSE } from "../constants/stock-universe.js";
import type { CandidateTicker } from "../fmp/types.js";

const MIN_MARKET_CAP = 500_000_000;
const MAX_MARKET_CAP = 50_000_000_000;
const MIN_LIQUIDITY  = 5_000_000;
const TOP_N          = 30;
const MAX_PER_SECTOR = 8;
const MAX_PER_INDUSTRY = 4;

const SECTORS_TO_SCAN = [
  "Technology",
  "Industrials",
  "Utilities",
  "Communication Services",
  "Healthcare",
  "Energy",
];

/* ── Yahoo Finance predefined screeners ──────────────────────────────────────
   These endpoints require no API key and return live market data including
   marketCap, regularMarketPrice, regularMarketVolume, quoteType.
   We combine multiple screeners to get a diverse universe.
   ─────────────────────────────────────────────────────────────────────────── */

const YAHOO_SCREENER_IDS = [
  "growth_technology_stocks",    // tech mid-caps with growth
  "aggressive_small_caps",       // small/mid cap high-growth
  "undervalued_growth_stocks",   // growth at reasonable price
  "most_actives",                // highest volume — quality proxy
  "small_cap_gainers",           // momentum mid-caps
  "day_gainers",                 // top movers — sector diversity
];

async function fetchYahooScreener(scrId: string): Promise<any[]> {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=${scrId}&count=100&offset=0`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.finance?.result?.[0]?.quotes ?? [];
  } catch {
    return [];
  }
}

async function getYahooUniverse(): Promise<any[]> {
  const results = await Promise.allSettled(
    YAHOO_SCREENER_IDS.map(id => fetchYahooScreener(id))
  );

  const allStocks: any[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") allStocks.push(...r.value);
  }

  // Normalize to the same shape the rest of the pipeline expects
  return allStocks
    .filter(q =>
      q.quoteType === "EQUITY" &&
      q.market === "us_market" &&
      typeof q.marketCap === "number" &&
      typeof q.regularMarketPrice === "number"
    )
    .map(q => ({
      symbol: q.symbol,
      companyName: q.shortName ?? q.longName ?? q.symbol,
      sector: q.sector ?? "",
      industry: q.industry ?? "",
      marketCap: q.marketCap,
      price: q.regularMarketPrice,
      volume: q.regularMarketVolume ?? 0,
      isEtf: false,
      isFund: false,
      isAdr: false,
      isActivelyTrading: true,
    }));
}

/* ── Main discovery function ─────────────────────────────────────────────── */

export interface DiscoveryResult {
  candidates: CandidateTicker[];
  stats: { total: number; excluded: number; filtered: number; passed: number };
}

export async function runDiscovery(): Promise<DiscoveryResult> {
  let allStocks: any[] = [];
  let source = "FMP";

  // Tier 1: FMP company-screener
  console.log("[discovery] Trying FMP company-screener...");
  const sectorResults = await Promise.allSettled(
    SECTORS_TO_SCAN.map(sector =>
      screenStocks({ sector, marketCapMoreThan: MIN_MARKET_CAP, marketCapLessThan: MAX_MARKET_CAP, country: "US" })
    )
  );
  for (const r of sectorResults) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) allStocks.push(...r.value);
  }

  // Tier 2: Yahoo Finance predefined screeners
  if (allStocks.length === 0) {
    source = "Yahoo Finance";
    console.log("[discovery] FMP unavailable — fetching Yahoo Finance screeners...");
    allStocks = await getYahooUniverse();
    console.log(`[discovery] Yahoo Finance returned ${allStocks.length} raw stocks`);
  }

  // Tier 3: Curated static universe
  if (allStocks.length === 0) {
    source = "curated fallback";
    console.log("[discovery] Yahoo Finance unavailable — using curated stock universe");
    allStocks = STOCK_UNIVERSE.map(s => ({
      symbol: s.ticker,
      companyName: s.companyName,
      sector: s.sector,
      industry: s.industry,
      marketCap: s.marketCap,
      price: 10,
      volume: 10_000_000,
      isEtf: false,
      isFund: false,
      isAdr: false,
      isActivelyTrading: true,
    }));
  }

  console.log(`[discovery] Source: ${source} — ${allStocks.length} raw stocks`);

  // Deduplicate by ticker
  const seen = new Set<string>();
  const unique: any[] = [];
  for (const stock of allStocks) {
    const ticker = (stock.symbol ?? "").toUpperCase();
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    unique.push(stock);
  }

  // Apply filters + build candidates
  let excluded = 0;
  let filtered = 0;
  const candidates: CandidateTicker[] = [];

  for (const stock of unique) {
    const ticker = (stock.symbol ?? "").toUpperCase();

    if (stock.isEtf || stock.isFund || stock.isAdr) { filtered++; continue; }

    const exclusion = isExcluded(ticker);
    if (exclusion.excluded) { excluded++; continue; }

    const marketCap: number = stock.marketCap ?? 0;
    const price: number = stock.price ?? 0;
    const volume: number = stock.volume ?? 0;

    if (marketCap < MIN_MARKET_CAP || marketCap > MAX_MARKET_CAP) { filtered++; continue; }
    if (price > 0 && volume > 0 && volume * price < MIN_LIQUIDITY) { filtered++; continue; }
    if (stock.isActivelyTrading === false) { filtered++; continue; }

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
      screeningNotes: stock.industry || stock.sector || "BROAD",
      screenType: stock.sector || "BROAD",
    });
  }

  // Sort by AGI alignment, then market cap
  candidates.sort((a, b) => {
    if (b.agiAlignmentScore !== a.agiAlignmentScore) return b.agiAlignmentScore - a.agiAlignmentScore;
    return b.marketCap - a.marketCap;
  });

  // Diversify: cap per sector and per industry
  const sectorCount   = new Map<string, number>();
  const industryCount = new Map<string, number>();
  const diversified: CandidateTicker[] = [];

  for (const c of candidates) {
    const sc = sectorCount.get(c.sector) ?? 0;
    const ic = industryCount.get(c.industry) ?? 0;
    if (sc >= MAX_PER_SECTOR || ic >= MAX_PER_INDUSTRY) continue;
    sectorCount.set(c.sector, sc + 1);
    industryCount.set(c.industry, ic + 1);
    diversified.push(c);
    if (diversified.length >= TOP_N) break;
  }

  console.log(`[discovery] ${unique.length} unique → ${excluded} excluded, ${filtered} filtered → ${diversified.length} candidates`);

  return {
    candidates: diversified,
    stats: { total: unique.length, excluded, filtered, passed: diversified.length },
  };
}
