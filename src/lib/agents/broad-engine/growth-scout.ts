import { getFinancialGrowth, getEarnings, getProfile } from "../../../../server/lib/fmp.js";
import { isExcluded } from "../../constants/exclusion-list.js";
import { getAgiAlignment } from "../../constants/sector-map.js";
import type { CandidateTicker } from "../../fmp/types.js";

const BASE_UNIVERSE = [
  "VRT", "CIEN", "COHR", "NTAP", "EME", "VST", "ETR", "AES", "MRVL", "ON",
  "LPLA", "MKTX", "STRL", "HIMS", "ELF", "CRDO", "PSTG", "NRG", "GNRC", "DRS",
  "KTOS", "BAH", "LDOS", "GXO", "RXO", "SITE", "MLM", "OTTR", "ATO", "NI",
];

const HIGH_GROWTH_TICKERS = [
  "DDOG", "ZS", "NET", "SNOW", "MDB", "HUBS", "BILL", "CFLT", "GTLB", "TOST",
  "AXON", "CRWD", "S", "PANW", "SQ", "SOFI", "HOOD", "NU", "AFRM", "RXRX",
];

const FULL_UNIVERSE = Array.from(new Set([...BASE_UNIVERSE, ...HIGH_GROWTH_TICKERS]));

const MIN_MARKET_CAP = 500_000_000;
const MAX_MARKET_CAP = 50_000_000_000;
const MIN_REVENUE_GROWTH = 0.10;
const BATCH_SIZE = 5;
const TOP_N = 15;

interface GrowthCandidate extends CandidateTicker {
  revenueGrowth: number;
}

async function fetchGrowthSafe(ticker: string): Promise<any | null> {
  try {
    const data = await getFinancialGrowth(ticker);
    if (!data) return null;
    return Array.isArray(data) ? data[0] ?? null : data;
  } catch {
    return null;
  }
}

async function fetchEarningsSafe(ticker: string): Promise<any[]> {
  try {
    const data = await getEarnings(ticker);
    if (!data || !Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

async function fetchProfileSafe(ticker: string): Promise<any | null> {
  try {
    const data = await getProfile(ticker);
    if (!data) return null;
    return Array.isArray(data) ? data[0] ?? null : data;
  } catch {
    return null;
  }
}

function calcSue(earningsData: any[]): number {
  if (!earningsData.length) return 0;
  const recent = earningsData.find(e => e.epsActual != null && e.epsEstimated != null);
  if (!recent) return 0;
  const { epsActual, epsEstimated } = recent;
  if (Math.abs(epsEstimated) < 0.001) return 0;
  return (epsActual - epsEstimated) / Math.abs(epsEstimated);
}

export async function runGrowthScout(): Promise<CandidateTicker[]> {
  const growthCandidates: GrowthCandidate[] = [];

  for (let i = 0; i < FULL_UNIVERSE.length; i += BATCH_SIZE) {
    const batch = FULL_UNIVERSE.slice(i, i + BATCH_SIZE);

    const [growthResults, earningsResults, profileResults] = await Promise.all([
      Promise.allSettled(batch.map(t => fetchGrowthSafe(t))),
      Promise.allSettled(batch.map(t => fetchEarningsSafe(t))),
      Promise.allSettled(batch.map(t => fetchProfileSafe(t))),
    ]);

    for (let j = 0; j < batch.length; j++) {
      const ticker = batch[j];

      const growthResult = growthResults[j];
      const earningsResult = earningsResults[j];
      const profileResult = profileResults[j];

      if (growthResult.status === "rejected" || !growthResult.value) continue;
      if (profileResult.status === "rejected" || !profileResult.value) continue;

      const growth = growthResult.value;
      const profile = profileResult.value;
      const earningsData = earningsResult.status === "fulfilled" ? earningsResult.value : [];

      // Growth filter
      const revenueGrowth: number = growth.revenueGrowth ?? 0;
      const epsGrowth: number | null = growth.epsGrowth ?? null;

      if (revenueGrowth <= MIN_REVENUE_GROWTH) continue;
      if (epsGrowth === null) continue;

      // Exclusion and market cap checks
      const exclusion = isExcluded(ticker);
      if (exclusion.excluded) continue;

      const marketCap: number = profile.marketCap ?? profile.mktCap ?? 0;
      if (marketCap < MIN_MARKET_CAP || marketCap > MAX_MARKET_CAP) continue;

      // SUE check
      const sueScore = calcSue(earningsData);
      const sueConfirmed = sueScore > 1;

      const baseScore = getAgiAlignment(
        profile.sector ?? "",
        profile.industry ?? "",
        profile.description ?? ""
      );
      const agiAlignmentScore = Math.min(100, baseScore);

      const notes = sueConfirmed
        ? "Revenue growth >10% + positive EPS growth; SUE confirmed +5 Growth"
        : "Revenue growth >10% + positive EPS growth";

      growthCandidates.push({
        ticker,
        companyName: profile.companyName ?? ticker,
        marketCap,
        sector: profile.sector ?? "Unknown",
        industry: profile.industry ?? "Unknown",
        agiAlignmentScore,
        screeningNotes: notes,
        screenType: "GROWTH_SCOUT",
        revenueGrowth,
      });
    }
  }

  // Sort by revenue growth descending
  growthCandidates.sort((a, b) => b.revenueGrowth - a.revenueGrowth);

  return growthCandidates.slice(0, TOP_N).map(({ revenueGrowth: _rg, ...rest }) => rest);
}
