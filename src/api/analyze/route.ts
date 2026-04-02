/**
 * POST /api/analyze { ticker }
 * Full MAPO stock analysis: quant signals + Claude 6-factor scoring
 */
import type { Request, Response } from "express";
import { analyzeStock } from "../../lib/agents/scoring/composite-scorer.js";

export async function analyzeRoute(req: Request, res: Response): Promise<void> {
  const { ticker } = req.body as { ticker?: string };
  if (!ticker) {
    res.status(400).json({ error: "ticker required" });
    return;
  }

  try {
    const result = await analyzeStock(ticker.trim().toUpperCase());
    res.json(result);
  } catch (err: any) {
    console.error("[/api/analyze]", err);
    res.status(500).json({ error: err.message });
  }
}
