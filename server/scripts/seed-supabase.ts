import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

const portfolioId = "f5b21d3c-311f-4627-a550-ecbe1ba64d3e";

async function seed() {
  const mapoData = JSON.parse(
    readFileSync(join(__dirname, "../../mapo-ai-portfolio.json"), "utf-8")
  );

  console.log("Seeding portfolio...");

  // Upsert portfolio
  const { error: portErr } = await supabase.from("portfolios").upsert({
    id: portfolioId,
    name: mapoData.name ?? "Mapo AI Portfolio",
    type: mapoData.type ?? "custom",
  });
  if (portErr) {
    console.error("Portfolio error:", portErr.message);
    return;
  }
  console.log("Portfolio upserted:", portfolioId);

  // Upsert meta
  const { error: metaErr } = await supabase.from("portfolio_meta").upsert({
    portfolio_id: portfolioId,
    cash: mapoData.cash ?? 277,
    starting_capital: mapoData.startingCapital ?? 20469.11,
  });
  if (metaErr) console.error("Meta error:", metaErr.message);
  else console.log("Portfolio meta upserted (cash:", mapoData.cash, ")");

  // Upsert holdings
  if (mapoData.holdings?.length) {
    const holdingRows = mapoData.holdings.map((h: any) => ({
      id: randomUUID(),
      portfolio_id: portfolioId,
      ticker: h.ticker,
      name: h.name ?? h.ticker,
      quantity: h.quantity ?? h.shares ?? 0,
      cost_basis: h.costBasis ?? h.cost_basis ?? 0,
      price: h.price ?? 0,
      value: h.value ?? (h.price ?? 0) * (h.quantity ?? h.shares ?? 0),
      day_change: h.dayChange ?? null,
      day_change_pct: h.dayChangePct ?? null,
      gain_loss: h.gainLoss ?? null,
      gain_loss_pct: h.gainLossPct ?? null,
      type: h.type ?? "Stock",
      sector: h.sector ?? "Other",
      source: h.source ?? "manual",
    }));

    // Delete existing first, then insert fresh
    await supabase.from("holdings").delete().eq("portfolio_id", portfolioId);
    const { error: holdErr } = await supabase.from("holdings").insert(holdingRows);
    if (holdErr) console.error("Holdings error:", holdErr.message);
    else console.log(`Seeded ${holdingRows.length} holdings`);
  }

  // Upsert trades
  if (mapoData.trades?.length) {
    const tradeRows = mapoData.trades.map((t: any) => ({
      id: randomUUID(),
      portfolio_id: portfolioId,
      date: t.date,
      action: t.action,
      ticker: t.ticker,
      name: t.name ?? t.ticker,
      shares: t.shares,
      price: t.price,
      total: t.total,
      pnl: t.pnl ?? null,
      rationale: t.rationale ?? null,
    }));

    await supabase.from("trades").delete().eq("portfolio_id", portfolioId);
    const { error: tradeErr } = await supabase.from("trades").insert(tradeRows);
    if (tradeErr) console.error("Trades error:", tradeErr.message);
    else console.log(`Seeded ${tradeRows.length} trades`);
  }

  console.log("\nSeed complete!");
  console.log("Portfolio ID:", portfolioId);
}

seed().catch(console.error);
