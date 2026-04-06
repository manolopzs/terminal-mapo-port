import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { supabase, isSupabaseEnabled } from "../../../../server/lib/supabase.js";
import { getHoldings } from "../../../lib/portfolio/state.js";

function getSb() {
  if (!isSupabaseEnabled) throw new Error("Supabase not configured");
  return supabase;
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
  date?: string; // optional trade date (YYYY-MM-DD), defaults to today
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
  entryScore?: number,
  tradeDate?: string
): Promise<void> {
  const sb = getSb();
  const today = tradeDate ?? new Date().toISOString().split("T")[0];
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
        cost_basis: Math.round(weightedAvgPrice * totalShares * 10000) / 10000,
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
      cost_basis: price * shares,
      price,
      value: shares * price,
      sector: sector ?? "Unknown",
      type: "Stock",
      source: "mapo",
    };

    const { error: insertError } = await sb.from("holdings").insert(row);
    if (insertError) throw new Error(insertError.message);
  }

  await logTrade(upper, "BUY", shares, price, rationale, portfolioId, scoreToUse, body.date);
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
  await logTrade(upper, "SELL", shares, price, rationale, portfolioId, entryScore, body.date);
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

  await logTrade(upper, "TRIM", trimShares, price, rationale, portfolioId, entryScore, body.date);
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

    // Update portfolio_meta.cash so /api/summary stays in sync
    if (portfolioId) {
      const sb = getSb();
      const { data: meta } = await sb
        .from("portfolio_meta")
        .select("cash")
        .eq("portfolio_id", portfolioId)
        .maybeSingle();
      if (meta != null) {
        const tradeTotal = body.shares * body.price;
        const newCash = (body.action === "SELL" || body.action === "TRIM")
          ? Number(meta.cash) + tradeTotal
          : Math.max(0, Number(meta.cash) - tradeTotal);
        await sb.from("portfolio_meta").update({ cash: newCash }).eq("portfolio_id", portfolioId);
      }
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
