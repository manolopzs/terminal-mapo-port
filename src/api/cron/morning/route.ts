/**
 * Cron: GET /api/cron/morning
 * Schedule: 30 13 * * 1-5 (7:30 AM CST, market days)
 */
import type { Request, Response } from "express";
import { sendAlert } from "../../../lib/alerts/send.js";
import { supabase, isSupabaseEnabled } from "../../../lib/supabase.js";

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // No secret configured: allow all
  const auth = req.headers["x-cron-secret"] ?? req.headers["authorization"];
  return auth === `Bearer ${secret}` || auth === secret;
}

export async function cronMorningRoute(req: Request, res: Response): Promise<void> {
  if (!verifyCron(req)) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    // Call briefing endpoint internally
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
    const briefingRes = await fetch(`${baseUrl}/api/briefing`);
    if (!briefingRes.ok) throw new Error(`Briefing endpoint returned ${briefingRes.status}`);
    const briefingData = await briefingRes.json();

    const briefingText: string = briefingData.briefing ?? "No briefing generated.";
    const today = new Date().toISOString().split("T")[0];

    // Send via configured alert channel
    await sendAlert(
      `MAPO Morning Briefing ${today}\n\n${briefingText}`,
      "INFO"
    );

    // Persist to Supabase if available
    if (isSupabaseEnabled) {
      try {
        await supabase.from("briefings" as any).upsert({
          briefing_date: today,
          content: briefingText,
          macro_regime: briefingData.macro?.regime ?? null,
          agi_status: briefingData.agi?.status ?? null,
          created_at: new Date().toISOString(),
        });
      } catch { /* briefings table may not exist, non-fatal */ }
    }

    console.log(`[cron/morning] Briefing sent for ${today}`);
    res.json({ success: true, date: today });
  } catch (err: any) {
    console.error("[cron/morning]", err);
    await sendAlert(`MAPO Morning Briefing FAILED: ${err.message}`, "CRITICAL").catch(() => {});
    res.status(500).json({ error: err.message });
  }
}
