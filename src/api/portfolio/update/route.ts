import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { getHoldings } from "../../../lib/portfolio/state.js";

function getSb() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

interface UpdatePortfolioBody {
  action: "BUY" | "SELL" | "TRIM";
  ticker: string;
  shares: number;
  price: number;
  rationale: string;
  companyName?: string;
  sector?: string;
  entryScore?: number;
}

async function getPortfolioId(): Promise<string | null> {
  const { data } = await getSb()
    .from("portfolios")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function logTrade(
  ticker: string,
  action: "BUY" | "SELL" | "TRIM",
  shares: number,
  price: number,
  rationale: string,
  portfolioId: string | null,
  entryScore?: number
): Promise<void> {
  const sb = getSb();
  const today = new Date().toISOString().split("T")[0];
  const row: any = {
    id: randomUUID(),
    ticker,
    action,
    shares,
    price,
    total: shares * price,
    name: ticker,
    rationale: rationale ?? "",
    date: today,
  };
  if (portfolioId) row.portfolio_id = portfolioId;
  const tradeRow = { ...row }; // for fallback

  // Try trade_log first, fallback to trades
  const { error: logError } = await sb.from("trade_log").insert(row);
  if (logError) {
    await sb.from("trades").insert(row); // non-fatal
  }
}

async function handleBuy(body: UpdatePortfolioBody, portfolioId: string | null): Promise<void> {
  const sb = getSb();
  const { ticker, shares, price, companyName, sector, entryScore, rationale } = body;
  const upper = ticker.toUpperCase();
  const today = new Date().toISOString().split("T")[0];
  const scoreToUse = entryScore ?? 65;

  // Check if holding already exists
  const { data: existing, error: fetchError } = await sb
    .from("holdings")
    .select("*")
    .eq("ticker", upper)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);

  if (existing) {
    // Weighted average entry price
    const existingShares = Number(existing.shares ?? existing.quantity ?? 0);
    const existingPrice = Number(existing.entry_price ?? existing.cost_basis ?? 0);
    const totalShares = existingShares + shares;
    const weightedAvgPrice = totalShares > 0
      ? (existingShares * existingPrice + shares * price) / totalShares
      : price;

    const { error: updateError } = await sb
      .from("holdings")
      .update({
        quantity: totalShares,
        cost_basis: Math.round(weightedAvgPrice * 10000) / 10000,
        value: totalShares * price,
        price,
      })
      .eq("ticker", upper);

    if (updateError) throw new Error(updateError.message);
  } else {
    if (!portfolioId) throw new Error("No portfolio found. Create a portfolio first.");
    const row: any = {
      id: randomUUID(),
      portfolio_id: portfolioId,
      ticker: upper,
      name: companyName ?? upper,
      quantity: shares,
      cost_basis: price,
      price,
      value: shares * price,
      sector: sector ?? "Unknown",
      type: "Stock",
      source: "mapo",
    };

    const { error: insertError } = await sb.from("holdings").insert(row);
    if (insertError) throw new Error(insertError.message);
  }

  await logTrade(upper, "BUY", shares, price, rationale, portfolioId, scoreToUse);
}

async function handleSell(body: UpdatePortfolioBody, portfolioId: string | null): Promise<void> {
  const sb = getSb();
  const { ticker, shares, price, rationale, entryScore } = body;
  const upper = ticker.toUpperCase();

  const { error: deleteError } = await sb
    .from("holdings")
    .delete()
    .eq("ticker", upper);

  if (deleteError) throw new Error(deleteError.message);
  await logTrade(upper, "SELL", shares, price, rationale, portfolioId, entryScore);
}

async function handleTrim(body: UpdatePortfolioBody, portfolioId: string | null): Promise<void> {
  const sb = getSb();
  const { ticker, shares: trimShares, price, rationale, entryScore } = body;
  const upper = ticker.toUpperCase();

  const { data: existing, error: fetchError } = await sb
    .from("holdings")
    .select("*")
    .eq("ticker", upper)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) throw new Error(`No holding found for ticker ${upper}`);

  const currentShares = Number(existing.shares ?? existing.quantity ?? 0);
  const remainingShares = currentShares - trimShares;

  if (remainingShares <= 0) {
    const { error } = await sb.from("holdings").delete().eq("ticker", upper);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb
      .from("holdings")
      .update({
        quantity: remainingShares,
        value: remainingShares * price,
        price,
      })
      .eq("ticker", upper);
    if (error) throw new Error(error.message);
  }

  await logTrade(upper, "TRIM", trimShares, price, rationale, portfolioId, entryScore);
}

export async function portfolioUpdateRoute(req: Request, res: Response): Promise<void> {
  const body = req.body as UpdatePortfolioBody;

  if (!body.action || !body.ticker || body.shares == null || body.price == null || !body.rationale) {
    res.status(400).json({
      error: "Missing required fields: action, ticker, shares, price, rationale",
    });
    return;
  }

  if (!["BUY", "SELL", "TRIM"].includes(body.action)) {
    res.status(400).json({ error: "Invalid action. Must be BUY, SELL, or TRIM." });
    return;
  }

  if (body.shares <= 0 || body.price <= 0) {
    res.status(400).json({ error: "shares and price must be positive numbers." });
    return;
  }

  try {
    const portfolioId = await getPortfolioId();

    switch (body.action) {
      case "BUY":  await handleBuy(body, portfolioId); break;
      case "SELL": await handleSell(body, portfolioId); break;
      case "TRIM": await handleTrim(body, portfolioId); break;
    }

    const holdings = await getHoldings();
    res.status(200).json({
      success: true,
      action: body.action,
      ticker: body.ticker.toUpperCase(),
      holdings,
    });
  } catch (err: any) {
    console.error(`[portfolioUpdateRoute] ${body.action} ${body.ticker}:`, err.message ?? err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
}
