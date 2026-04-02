import { getProfile } from "../../../../server/lib/fmp.js";
import { isExcluded } from "../../constants/exclusion-list.js";
import { getAgiAlignment } from "../../constants/sector-map.js";
import type { CandidateTicker } from "../../fmp/types.js";

const POWER_TICKERS = [
  "VST", "CEG", "ETR", "NRG", "AES", "WTRG", "MGEE", "OTTR", "ATO", "NI",
  "GNRC", "AMRC", "ARRY", "HASI", "BW", "GEV", "POWL", "ETN", "AMPS", "NFE",
];

const MIN_MARKET_CAP = 1_000_000_000;
const MAX_MARKET_CAP = 50_000_000_000;
const MIN_LIQUIDITY = 5_000_000;
const MIN_AGI_SCORE = 80;
const BATCH_SIZE = 5;
const TOP_N = 10;

async function fetchProfileSafe(ticker: string): Promise<any | null> {
  try {
    const data = await getProfile(ticker);
    if (!data) return null;
    return Array.isArray(data) ? data[0] ?? null : data;
  } catch {
    return null;
  }
}

async function processBatch(tickers: string[]): Promise<Array<any | null>> {
  const results = await Promise.allSettled(tickers.map(t => fetchProfileSafe(t)));
  return results.map(r => (r.status === "fulfilled" ? r.value : null));
}

export async function runPowerAnalyst(): Promise<CandidateTicker[]> {
  const candidates: CandidateTicker[] = [];

  for (let i = 0; i < POWER_TICKERS.length; i += BATCH_SIZE) {
    const batch = POWER_TICKERS.slice(i, i + BATCH_SIZE);
    const profiles = await processBatch(batch);

    for (let j = 0; j < batch.length; j++) {
      const ticker = batch[j];
      const profile = profiles[j];
      if (!profile) continue;

      const exclusion = isExcluded(ticker);
      if (exclusion.excluded) continue;

      const price: number = profile.price ?? 0;
      const volAvg: number = profile.volAvg ?? 0;
      const marketCap: number = profile.marketCap ?? profile.mktCap ?? 0;

      if (!price || price <= 0) continue;
      if (marketCap < MIN_MARKET_CAP || marketCap > MAX_MARKET_CAP) continue;
      if (volAvg * price < MIN_LIQUIDITY) continue;

      const baseScore = getAgiAlignment(
        profile.sector ?? "",
        profile.industry ?? "",
        profile.description ?? ""
      );
      const agiAlignmentScore = Math.max(MIN_AGI_SCORE, baseScore);

      candidates.push({
        ticker,
        companyName: profile.companyName ?? ticker,
        marketCap,
        sector: profile.sector ?? "Unknown",
        industry: profile.industry ?? "Unknown",
        agiAlignmentScore,
        screeningNotes: "Power Grid + AI Infrastructure",
        screenType: "AGI_POWER",
      });
    }
  }

  candidates.sort((a, b) => b.marketCap - a.marketCap);
  return candidates.slice(0, TOP_N);
}
