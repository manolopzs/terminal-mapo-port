import { getFMPQuote } from "../../../../server/lib/fmp.js";
import { callClaude } from "../../claude/client.js";

export interface SituationalAwarenessResult {
  status: "ACCELERATING" | "STABLE" | "DECELERATING";
  confidenceLevel: number;
  keyDevelopments: string[];
  capexTracker: string;
  implicationsForPortfolio: string;
  timestamp: string;
}

const AI_CORE_TICKERS = ["NVDA", "MSFT", "GOOGL", "META", "AMZN"];

const SYSTEM_PROMPT = `You are the MAPO AGI Thesis Monitor. Based on recent market data and AI infrastructure developments, assess whether the AGI Structural Macro Thesis (Situational Awareness by Aschenbrenner) is ACCELERATING, STABLE, or DECELERATING. Focus on: AI compute capex commitments, data center buildout pace, power grid investment signals, and semiconductor demand. Never use em dashes or double hyphens. Respond in JSON: { "status": "ACCELERATING" | "STABLE" | "DECELERATING", "confidenceLevel": number (0-100), "keyDevelopments": [array of 3-5 strings], "capexTracker": string, "implicationsForPortfolio": string }`;

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

export async function runSituationalAwareness(): Promise<SituationalAwarenessResult> {
  const today = new Date().toISOString().split("T")[0];

  const [quoteResults, sectorData] = await Promise.allSettled([
    Promise.allSettled(AI_CORE_TICKERS.map(t => getFMPQuote(t))),
    fetchSectorPerformance(),
  ]);

  const quotes: Array<{ ticker: string; price: number; changesPercentage: number }> = [];
  if (quoteResults.status === "fulfilled") {
    for (let i = 0; i < AI_CORE_TICKERS.length; i++) {
      const res = quoteResults.value[i];
      if (res.status === "fulfilled" && Array.isArray(res.value) && res.value[0]) {
        const q = res.value[0];
        quotes.push({
          ticker: AI_CORE_TICKERS[i],
          price: q.price ?? 0,
          changesPercentage: q.changesPercentage ?? 0,
        });
      }
    }
  }

  const sectors: Array<{ sector: string; changesPercentage: number }> =
    sectorData.status === "fulfilled" ? sectorData.value : [];

  const techSector = sectors.find(s => s.sector?.toLowerCase().includes("technology"));
  const utilsSector = sectors.find(s => s.sector?.toLowerCase().includes("utilities"));

  const quotesText = quotes.length > 0
    ? quotes.map(q => `${q.ticker}: ${q.changesPercentage >= 0 ? "+" : ""}${q.changesPercentage.toFixed(2)}% @ $${q.price.toFixed(2)}`).join(", ")
    : "Quote data unavailable";

  const sectorText = [
    techSector ? `Technology sector: ${techSector.changesPercentage >= 0 ? "+" : ""}${Number(techSector.changesPercentage).toFixed(2)}%` : null,
    utilsSector ? `Utilities sector: ${utilsSector.changesPercentage >= 0 ? "+" : ""}${Number(utilsSector.changesPercentage).toFixed(2)}%` : null,
  ]
    .filter(Boolean)
    .join("; ") || "Sector data unavailable";

  const userMessage = `Today is ${today}.

AI Infrastructure Stock Moves (leading indicators of AGI capex sentiment):
${quotesText}

Sector Signals:
${sectorText}

Based on these market signals, assess the current status of the AGI Structural Macro Thesis. Provide your assessment in the requested JSON format.`;

  let parsed: Partial<SituationalAwarenessResult> = {};
  try {
    const response = await callClaude({
      system: SYSTEM_PROMPT,
      prompt: userMessage,
      maxTokens: 1200,
    });

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Graceful fallback
  }

  const status = (parsed.status === "ACCELERATING" || parsed.status === "DECELERATING")
    ? parsed.status
    : "STABLE";

  return {
    status,
    confidenceLevel: typeof parsed.confidenceLevel === "number"
      ? Math.max(0, Math.min(100, parsed.confidenceLevel))
      : 50,
    keyDevelopments: Array.isArray(parsed.keyDevelopments)
      ? parsed.keyDevelopments.slice(0, 5)
      : ["Insufficient data to determine key developments at this time."],
    capexTracker: typeof parsed.capexTracker === "string"
      ? parsed.capexTracker
      : "Capex tracking data unavailable.",
    implicationsForPortfolio: typeof parsed.implicationsForPortfolio === "string"
      ? parsed.implicationsForPortfolio
      : "Maintain current AGI thesis allocation pending further data.",
    timestamp: new Date().toISOString(),
  };
}
