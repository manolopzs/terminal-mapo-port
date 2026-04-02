import { getFMPQuote } from "../../../../server/lib/fmp.js";
import { callClaude } from "../../claude/client.js";
import { MORNING_BRIEFING_PROMPT } from "../../claude/prompts/morning.js";

export interface MacroSentinelResult {
  regime: "RISK_ON" | "RISK_OFF" | "NEUTRAL";
  keyEvents: string[];
  sectorRanking: Array<{ sector: string; change: number }>;
  agiThesisPulse: string;
  timestamp: string;
}

async function fetchSectorPerformance(): Promise<Array<{ sector: string; changesPercentage: number }>> {
  const key = process.env.FMP_API_KEY;
  if (!key) return [];
  try {
    const url = `https://financialmodelingprep.com/stable/sector-performance?apikey=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

function parseRegime(text: string): "RISK_ON" | "RISK_OFF" | "NEUTRAL" {
  const upper = text.toUpperCase();
  if (upper.includes("RISK_ON") || upper.includes("RISK-ON")) return "RISK_ON";
  if (upper.includes("RISK_OFF") || upper.includes("RISK-OFF")) return "RISK_OFF";
  if (upper.includes("RISK_ON")) return "RISK_ON";
  return "NEUTRAL";
}

function extractKeyEvents(text: string): string[] {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const events: string[] = [];
  let inKeyEvents = false;
  for (const line of lines) {
    if (line.toLowerCase().includes("key macro") || line.toLowerCase().includes("key event")) {
      inKeyEvents = true;
      continue;
    }
    if (inKeyEvents) {
      if (line.startsWith("#") || line.startsWith("###")) {
        inKeyEvents = false;
        continue;
      }
      const cleaned = line.replace(/^[-*]\s*/, "").trim();
      if (cleaned.length > 5) events.push(cleaned);
      if (events.length >= 5) break;
    }
  }
  if (events.length === 0) {
    // Fallback: grab any bullet lines
    for (const line of lines) {
      if (line.startsWith("-") || line.startsWith("*")) {
        const cleaned = line.replace(/^[-*]\s*/, "").trim();
        if (cleaned.length > 5) events.push(cleaned);
      }
      if (events.length >= 5) break;
    }
  }
  return events;
}

function extractAgiPulse(text: string): string {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  let inAgi = false;
  const agiLines: string[] = [];
  for (const line of lines) {
    if (line.toLowerCase().includes("agi thesis") || line.toLowerCase().includes("ai thesis")) {
      inAgi = true;
      continue;
    }
    if (inAgi) {
      if (line.startsWith("#")) break;
      if (line.length > 5) agiLines.push(line);
      if (agiLines.length >= 3) break;
    }
  }
  return agiLines.join(" ").trim() || "No specific AGI thesis signals detected today.";
}

export async function runMacroSentinel(): Promise<MacroSentinelResult> {
  const today = new Date().toISOString().split("T")[0];

  // Fetch sector performance and index quotes in parallel
  const [sectorData, spyData, qqqData, diaData] = await Promise.allSettled([
    fetchSectorPerformance(),
    getFMPQuote("SPY"),
    getFMPQuote("QQQ"),
    getFMPQuote("DIA"),
  ]);

  const sectors: Array<{ sector: string; changesPercentage: number }> =
    sectorData.status === "fulfilled" ? sectorData.value : [];

  const spy = spyData.status === "fulfilled" && Array.isArray(spyData.value) ? spyData.value[0] : null;
  const qqq = qqqData.status === "fulfilled" && Array.isArray(qqqData.value) ? qqqData.value[0] : null;
  const dia = diaData.status === "fulfilled" && Array.isArray(diaData.value) ? diaData.value[0] : null;

  // Sort sectors by performance descending
  const sortedSectors = [...sectors].sort(
    (a, b) => (b.changesPercentage ?? 0) - (a.changesPercentage ?? 0)
  );

  const sectorRanking = sortedSectors.map(s => ({
    sector: s.sector,
    change: typeof s.changesPercentage === "string"
      ? parseFloat(s.changesPercentage)
      : (s.changesPercentage ?? 0),
  }));

  const sectorText = sectorRanking.length > 0
    ? sectorRanking
        .map(s => `${s.sector}: ${s.change > 0 ? "+" : ""}${s.change.toFixed(2)}%`)
        .join(", ")
    : "Sector performance data unavailable";

  const indexText = [
    spy ? `SPY: ${spy.changesPercentage > 0 ? "+" : ""}${spy.changesPercentage?.toFixed(2)}%` : null,
    qqq ? `QQQ: ${qqq.changesPercentage > 0 ? "+" : ""}${qqq.changesPercentage?.toFixed(2)}%` : null,
    dia ? `DIA: ${dia.changesPercentage > 0 ? "+" : ""}${dia.changesPercentage?.toFixed(2)}%` : null,
  ]
    .filter(Boolean)
    .join(", ") || "Index data unavailable";

  const userMessage = `Today is ${today}.

Market Index Performance:
${indexText}

Sector Performance (ranked best to worst):
${sectorText}

Please assess the current market regime. Identify it as exactly one of: RISK_ON, RISK_OFF, or NEUTRAL. Then identify key macro events likely occurring today (Fed meetings, CPI, earnings, geopolitical). Conclude with an AGI Thesis Pulse assessment.`;

  let claudeResponse = "";
  try {
    claudeResponse = await callClaude({
      system: MORNING_BRIEFING_PROMPT,
      prompt: userMessage,
      maxTokens: 1500,
    });
  } catch {
    claudeResponse = "";
  }

  const regime = claudeResponse ? parseRegime(claudeResponse) : "NEUTRAL";
  const keyEvents = claudeResponse ? extractKeyEvents(claudeResponse) : [];
  const agiThesisPulse = claudeResponse
    ? extractAgiPulse(claudeResponse)
    : "Unable to assess AGI thesis pulse at this time.";

  return {
    regime,
    keyEvents,
    sectorRanking,
    agiThesisPulse,
    timestamp: new Date().toISOString(),
  };
}
