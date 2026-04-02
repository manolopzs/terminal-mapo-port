import { getEarnings, getUpgradesDowngrades } from "../../../../server/lib/fmp.js";
import { callClaude } from "../../claude/client.js";
import type { CandidateTicker } from "../../fmp/types.js";

const BATCH_SIZE = 5;

const SYSTEM_PROMPT = `You are a catalyst identification specialist. For each company provided, identify 2+ specific near-term catalysts (within 90 days) based on the data provided. Catalysts must be specific and verifiable: earnings dates, product launches, analyst days, FDA decisions, contract announcements, index additions. Never use em dashes or double hyphens. Respond in JSON array: [{ "ticker": string, "catalysts": [string], "hasSufficientCatalysts": boolean }]`;

function getNextEarningsDate(earningsData: any[]): string | null {
  if (!Array.isArray(earningsData)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const entry of earningsData) {
    if (!entry.date) continue;
    const d = new Date(entry.date);
    if (d >= today && entry.epsActual == null) {
      return entry.date;
    }
  }
  return null;
}

function summarizeAnalystActions(upgradeData: any[]): string {
  if (!Array.isArray(upgradeData) || upgradeData.length === 0) return "No recent analyst actions";
  const recent = upgradeData.slice(0, 5);
  return recent
    .map(a => {
      const action = a.action ?? a.gradingAction ?? "Unknown action";
      const firm = a.gradingCompany ?? a.firm ?? "Unknown firm";
      const grade = a.newGrade ?? a.ratingTo ?? "";
      return `${firm}: ${action}${grade ? ` to ${grade}` : ""}`;
    })
    .join("; ");
}

async function fetchEarningsSafe(ticker: string): Promise<any[]> {
  try {
    const data = await getEarnings(ticker);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchUpgradesSafe(ticker: string): Promise<any[]> {
  try {
    const data = await getUpgradesDowngrades(ticker);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

interface CatalystResult {
  ticker: string;
  catalysts: string[];
  hasSufficientCatalysts: boolean;
}

export async function runCatalystHunter(candidates: CandidateTicker[]): Promise<CandidateTicker[]> {
  if (candidates.length === 0) return [];

  // Process all candidates in batches to fetch earnings and upgrades
  const enriched: Array<{
    ticker: string;
    companyName: string;
    nextEarnings: string | null;
    recentAnalystActions: string;
  }> = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async c => {
        const [earningsData, upgradesData] = await Promise.allSettled([
          fetchEarningsSafe(c.ticker),
          fetchUpgradesSafe(c.ticker),
        ]);

        const earnings = earningsData.status === "fulfilled" ? earningsData.value : [];
        const upgrades = upgradesData.status === "fulfilled" ? upgradesData.value : [];

        return {
          ticker: c.ticker,
          companyName: c.companyName,
          nextEarnings: getNextEarningsDate(earnings),
          recentAnalystActions: summarizeAnalystActions(upgrades),
        };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        enriched.push(result.value);
      }
    }
  }

  // Single batch call to Claude with all candidates
  let catalystMap: Map<string, CatalystResult> = new Map();
  try {
    const userMessage = `Analyze the following companies and identify near-term catalysts for each:\n\n${JSON.stringify(enriched, null, 2)}`;

    const response = await callClaude({
      system: SYSTEM_PROMPT,
      prompt: userMessage,
      maxTokens: 3000,
    });

    // Extract JSON array from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed: CatalystResult[] = JSON.parse(jsonMatch[0]);
      for (const item of parsed) {
        if (item.ticker) {
          catalystMap.set(item.ticker, item);
        }
      }
    }
  } catch {
    // If Claude fails, pass through all candidates unchanged
    return candidates;
  }

  // Filter and annotate candidates
  const filtered: CandidateTicker[] = [];
  for (const candidate of candidates) {
    const catalystResult = catalystMap.get(candidate.ticker);
    if (!catalystResult) {
      // If not in response, include with original notes (benefit of the doubt)
      filtered.push(candidate);
      continue;
    }
    if (catalystResult.hasSufficientCatalysts === false) {
      continue;
    }
    const catalystNote = catalystResult.catalysts?.length > 0
      ? `Catalysts: ${catalystResult.catalysts.join("; ")}`
      : "";

    filtered.push({
      ...candidate,
      screeningNotes: catalystNote
        ? `${candidate.screeningNotes}; ${catalystNote}`
        : candidate.screeningNotes,
    });
  }

  return filtered;
}
