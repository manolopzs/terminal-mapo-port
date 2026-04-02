import { getProfile } from "../../../../server/lib/fmp.js";
import { isExcluded } from "../../constants/exclusion-list.js";
import { getAgiAlignment } from "../../constants/sector-map.js";
import type { CandidateTicker } from "../../fmp/types.js";

export interface SectorRotationResult {
  sectorRankings: Array<{ sector: string; score: number; trend: "UP" | "DOWN" | "FLAT" }>;
  overweight: string[];
  underweight: string[];
  neutral: string[];
  topSectorCandidates: CandidateTicker[];
  timestamp: string;
}

const MIN_MARKET_CAP = 500_000_000;
const MAX_MARKET_CAP = 50_000_000_000;
const MIN_LIQUIDITY = 5_000_000;
const BATCH_SIZE = 5;
const TOP_CANDIDATES = 10;

const SECTOR_CANDIDATE_MAP: Record<string, string[]> = {
  Technology: ["CRDO", "ANET", "SMCI", "COHR", "MRVL", "ON", "PSTG", "DDOG", "ZS", "NET"],
  Industrials: ["STRL", "EME", "PWR", "VELO", "GXO", "AWK", "DY", "ACM", "MYRG", "SITE"],
  Healthcare: ["HIMS", "RXRX", "NVCR", "INSM", "FOLD", "PTGX", "ROIV", "BEAM", "RARE", "PRAX"],
  Financials: ["LPLA", "MKTX", "IBKR", "HOOD", "SOFI", "NU", "AFRM", "SQ", "DAVE", "TOST"],
  Energy: ["VST", "CEG", "NRG", "ETR", "AES", "OKE", "LNG", "CTRA", "AM", "NFE"],
  "Consumer Discretionary": ["ONON", "CELH", "BROS", "DKNG", "RCL", "HLT", "LULU", "ELF", "ULTA", "BURL"],
  Utilities: ["VST", "CEG", "ETR", "NRG", "AES", "WTRG", "GNRC", "GEV", "ETN", "NFE"],
};

// AGI-boosted sectors get a +1 rank boost
const AGI_BOOSTED_SECTORS = new Set(["Technology", "Utilities"]);

async function fetchSectorPerformance(): Promise<Array<{ sector: string; changesPercentage: number }>> {
  const key = process.env.FMP_API_KEY;
  if (!key) return [];
  try {
    const url = `https://financialmodelingprep.com/stable/sector-performance?apikey=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
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

export async function runSectorRotation(): Promise<SectorRotationResult> {
  const rawSectors = await fetchSectorPerformance();

  // Parse and sort sector performance
  const sectorPerf = rawSectors.map(s => ({
    sector: s.sector,
    change: typeof s.changesPercentage === "string"
      ? parseFloat(s.changesPercentage)
      : (s.changesPercentage ?? 0),
  }));

  // Apply AGI boost: move boosted sectors up 1 rank in sorting by adding a bonus
  const sectorWithBoost = sectorPerf.map(s => ({
    ...s,
    boostedScore: s.change + (AGI_BOOSTED_SECTORS.has(s.sector) ? 0.5 : 0),
  }));

  sectorWithBoost.sort((a, b) => b.boostedScore - a.boostedScore);

  const sectorRankings = sectorWithBoost.map(s => ({
    sector: s.sector,
    score: s.change,
    trend: s.change > 0.2 ? "UP" as const : s.change < -0.2 ? "DOWN" as const : "FLAT" as const,
  }));

  const totalSectors = sectorRankings.length;
  const overweight = sectorRankings.slice(0, 3).map(s => s.sector);
  const underweight = sectorRankings.slice(Math.max(0, totalSectors - 3)).map(s => s.sector);
  const neutralSectors = sectorRankings.slice(3, Math.max(3, totalSectors - 3)).map(s => s.sector);

  // Gather candidate tickers from top sectors
  const topSectorNames = overweight.slice(0, 3);
  const candidateTickers = new Set<string>();
  for (const sectorName of topSectorNames) {
    const tickers = SECTOR_CANDIDATE_MAP[sectorName] ?? [];
    tickers.forEach(t => candidateTickers.add(t));
  }

  const tickerArray = Array.from(candidateTickers);
  const allProfiles: CandidateTicker[] = [];

  for (let i = 0; i < tickerArray.length; i += BATCH_SIZE) {
    const batch = tickerArray.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(t => fetchProfileSafe(t)));

    for (let j = 0; j < batch.length; j++) {
      const ticker = batch[j];
      const result = results[j];
      if (result.status === "rejected" || !result.value) continue;
      const profile = result.value;

      const exclusion = isExcluded(ticker);
      if (exclusion.excluded) continue;

      const price: number = profile.price ?? 0;
      const volAvg: number = profile.volAvg ?? 0;
      const marketCap: number = profile.marketCap ?? profile.mktCap ?? 0;

      if (!price || price <= 0) continue;
      if (marketCap < MIN_MARKET_CAP || marketCap > MAX_MARKET_CAP) continue;
      if (volAvg * price < MIN_LIQUIDITY) continue;

      const agiAlignmentScore = getAgiAlignment(
        profile.sector ?? "",
        profile.industry ?? "",
        profile.description ?? ""
      );

      allProfiles.push({
        ticker,
        companyName: profile.companyName ?? ticker,
        marketCap,
        sector: profile.sector ?? "Unknown",
        industry: profile.industry ?? "Unknown",
        agiAlignmentScore,
        screeningNotes: `Sector Rotation: ${profile.sector ?? "Unknown"}`,
        screenType: "SECTOR_ROTATION",
      });
    }
  }

  // Sort by marketCap descending and take top candidates
  allProfiles.sort((a, b) => b.marketCap - a.marketCap);
  const topSectorCandidates = allProfiles.slice(0, TOP_CANDIDATES);

  return {
    sectorRankings,
    overweight,
    underweight,
    neutral: neutralSectors,
    topSectorCandidates,
    timestamp: new Date().toISOString(),
  };
}
