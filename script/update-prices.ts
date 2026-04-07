/**
 * Fetches recent daily prices from FMP and updates price-data.json
 * Usage: npx tsx script/update-prices.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const FMP_KEY = process.env.FMP_API_KEY;
if (!FMP_KEY) {
  console.error("Set FMP_API_KEY env var");
  process.exit(1);
}

const PRICE_PATH = join(process.cwd(), "price-data.json");

async function fetchDailyPrices(ticker: string): Promise<{ date: string; close: number }[]> {
  const url = `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${ticker}&apikey=${FMP_KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    console.warn(`  FMP ${res.status} for ${ticker}`);
    return [];
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((d: any) => ({ date: d.date, close: d.close ?? d.adjClose ?? 0 }));
}

async function main() {
  const prices: Record<string, Record<string, number>> = JSON.parse(
    readFileSync(PRICE_PATH, "utf-8")
  );

  // Determine what tickers we need and the last date we have
  const tickers = Object.keys(prices);
  const allDates = Object.keys(prices.VOO || {}).sort();
  const lastDate = allDates[allDates.length - 1];
  console.log(`Current data ends at: ${lastDate}`);
  console.log(`Tickers in file: ${tickers.join(", ")}`);

  // Also add SNOW if not present
  if (!prices.SNOW) {
    tickers.push("SNOW");
    prices.SNOW = {};
    console.log("Added SNOW (missing from price data)");
  }

  let newDates = 0;
  for (const ticker of tickers) {
    process.stdout.write(`Fetching ${ticker}... `);
    const bars = await fetchDailyPrices(ticker);
    if (bars.length === 0) {
      console.log("no data");
      continue;
    }

    let added = 0;
    for (const bar of bars) {
      if (bar.date > lastDate && bar.close > 0) {
        prices[ticker][bar.date] = parseFloat(bar.close.toFixed(2));
        added++;
      }
    }
    console.log(`+${added} days`);
    newDates = Math.max(newDates, added);

    // Small delay to respect rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  // Also backfill SNOW for dates before lastDate if missing
  if (Object.keys(prices.SNOW).length < allDates.length) {
    process.stdout.write("Backfilling SNOW history... ");
    const bars = await fetchDailyPrices("SNOW");
    let backfilled = 0;
    for (const bar of bars) {
      if (!prices.SNOW[bar.date] && bar.close > 0) {
        prices.SNOW[bar.date] = parseFloat(bar.close.toFixed(2));
        backfilled++;
      }
    }
    console.log(`+${backfilled} backfilled`);
  }

  writeFileSync(PRICE_PATH, JSON.stringify(prices, null, 2) + "\n");
  console.log(`\nDone. Added up to ${newDates} new trading days.`);
}

main().catch(console.error);
