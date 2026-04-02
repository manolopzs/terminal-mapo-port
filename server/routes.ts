import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeRoute } from "../src/api/analyze/route.js";
import { portfolioStatusRoute } from "../src/api/portfolio/status/route.js";
import { portfolioValidateRoute } from "../src/api/portfolio/validate/route.js";
import { briefingRoute } from "../src/api/briefing/route.js";
import { screenRoute } from "../src/api/screen/route.js";
import { rebalanceRoute } from "../src/api/rebalance/route.js";
import { cronMorningRoute } from "../src/api/cron/morning/route.js";
import { cronDrawdownRoute } from "../src/api/cron/drawdown/route.js";
import { cronEarningsRoute } from "../src/api/cron/earnings/route.js";
import { portfolioUpdateRoute } from "../src/api/portfolio/update/route.js";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { readFileSync } from "fs";
import { join } from "path";
import { fetchLiveQuotes, fetchEarningsSchedule, fetchMarketSentiment, fetchPortfolioNews, fetchExtendedQuotes } from "./liveData";
import { insertHoldingSchema, insertTradeSchema } from "@shared/schema";
import * as fmp from "./lib/fmp.js";
import { getDailyPrices, getRSI } from "./lib/alphavantage.js";
import { calcMomentum, calcGoldenCross, calcSUE, calcRevisions, calcBeta, calcValueFactor, calcDonchian, buildSignalSummary } from "./lib/quantSignals.js";
import { isExcluded, RULES } from "./lib/constants.js";
import { isSupabaseEnabled } from "./lib/supabase.js";

const anthropic = new Anthropic();
const openai = process.env.OPENAI_API_KEY ? new OpenAI() : null;

type AIModel = "claude" | "gpt" | "gemini";

const MODEL_MAP: Record<AIModel, { sdk: "anthropic" | "openai"; modelId: string; label: string }> = {
  claude: { sdk: "anthropic", modelId: "claude-opus-4-6", label: "Claude Opus 4.6" },
  gpt: { sdk: "openai", modelId: "gpt-4o", label: "GPT-4o" },
  gemini: { sdk: "openai", modelId: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Wave 2 MAPO routes
  app.post("/api/analyze", analyzeRoute);
  app.get("/api/portfolio/status", portfolioStatusRoute);
  app.post("/api/portfolio/validate", portfolioValidateRoute);
  app.get("/api/briefing", briefingRoute);
  app.post("/api/screen/v2", screenRoute);
  app.post("/api/rebalance", rebalanceRoute);
  app.get("/api/cron/morning", cronMorningRoute);
  app.get("/api/cron/drawdown", cronDrawdownRoute);
  app.get("/api/cron/earnings", cronEarningsRoute);
  app.post("/api/portfolio/update", portfolioUpdateRoute);

  // Portfolios
  app.get("/api/portfolios", async (_req, res) => {
    const portfolios = await storage.getPortfolios();
    res.json(portfolios);
  });

  app.post("/api/portfolios", async (req, res) => {
    const { name, type } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: "name and type are required" });
    }
    const portfolio = await storage.createPortfolio({ name, type });
    res.status(201).json(portfolio);
  });

  app.delete("/api/portfolios/:id", async (req, res) => {
    const deleted = await storage.deletePortfolio(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Portfolio not found" });
    res.json({ success: true });
  });

  // Holdings
  app.get("/api/holdings", async (req, res) => {
    const portfolioId = req.query.portfolioId as string | undefined;
    const holdings = await storage.getHoldings(portfolioId);
    res.json(holdings);
  });

  app.post("/api/holdings", async (req, res) => {
    const result = insertHoldingSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid holding data", details: result.error.flatten() });
    }
    const holding = await storage.createHolding(result.data);
    res.status(201).json(holding);
  });

  app.put("/api/holdings/:id", async (req, res) => {
    const result = insertHoldingSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid holding data", details: result.error.flatten() });
    }
    const updated = await storage.updateHolding(req.params.id, result.data);
    if (!updated) return res.status(404).json({ error: "Holding not found" });
    res.json(updated);
  });

  app.delete("/api/holdings/:id", async (req, res) => {
    const deleted = await storage.deleteHolding(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Holding not found" });
    res.json({ success: true });
  });

  // Trades
  app.get("/api/trades", async (req, res) => {
    const portfolioId = req.query.portfolioId as string | undefined;
    const trades = await storage.getTrades(portfolioId);
    res.json(trades);
  });

  app.post("/api/trades", async (req, res) => {
    const result = insertTradeSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid trade data", details: result.error.flatten() });
    }
    const trade = await storage.createTrade(result.data);

    // On SELL: reduce or remove the matching holding
    if (result.data.action === "SELL" && result.data.portfolioId) {
      const holdings = await storage.getHoldings(result.data.portfolioId);
      const holding = holdings.find(
        (h) => h.ticker.toUpperCase() === result.data.ticker.toUpperCase()
      );
      if (holding) {
        const remaining = holding.quantity - result.data.shares;
        if (remaining <= 0) {
          // Full exit — remove the holding
          await storage.deleteHolding(holding.id);
        } else {
          // Partial sell — reduce quantity and cost basis proportionally
          const costPerShare = holding.costBasis / holding.quantity;
          await storage.updateHolding(holding.id, {
            quantity: remaining,
            costBasis: costPerShare * remaining,
            value: holding.price * remaining,
          });
        }
      }
    }

    // On BUY: add to or create the matching holding
    if (result.data.action === "BUY" && result.data.portfolioId) {
      const holdings = await storage.getHoldings(result.data.portfolioId);
      const holding = holdings.find(
        (h) => h.ticker.toUpperCase() === result.data.ticker.toUpperCase()
      );
      if (holding) {
        const newQty = holding.quantity + result.data.shares;
        const newCostBasis = holding.costBasis + (result.data.shares * result.data.price);
        await storage.updateHolding(holding.id, {
          quantity: newQty,
          costBasis: newCostBasis,
          value: holding.price * newQty,
        });
      }
    }

    res.status(201).json(trade);
  });

  // Chat messages
  app.get("/api/chat", async (req, res) => {
    const portfolioId = req.query.portfolioId as string;
    if (!portfolioId) return res.status(400).json({ error: "portfolioId required" });
    const messages = await storage.getChatMessages(portfolioId);
    res.json(messages);
  });

  app.delete("/api/chat", async (req, res) => {
    const portfolioId = req.query.portfolioId as string;
    if (!portfolioId) return res.status(400).json({ error: "portfolioId required" });
    await storage.clearChatMessages(portfolioId);
    res.json({ success: true });
  });

  // AI Analyst endpoint
  app.post("/api/chat", async (req, res) => {
    const { portfolioId, message, model: modelKey } = req.body;
    if (!portfolioId || !message) {
      return res.status(400).json({ error: "portfolioId and message required" });
    }

    const selectedModel = MODEL_MAP[(modelKey as AIModel) || "claude"] || MODEL_MAP.claude;

    try {
      // Save user message
      await storage.createChatMessage({
        portfolioId,
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      });

      // Get context data
      const holdings = await storage.getHoldings(portfolioId);
      const trades = await storage.getTrades(portfolioId);
      const summary = await storage.getPortfolioSummary(portfolioId);
      const portfolio = await storage.getPortfolio(portfolioId);

      // Build compact context for the AI
      const holdingsContext = holdings.map(h =>
        `${h.ticker}: ${h.quantity}sh, $${h.value.toFixed(0)} (${(h.gainLossPct ?? 0) >= 0 ? '+' : ''}${(h.gainLossPct ?? 0).toFixed(1)}%), ${h.sector}`
      ).join("\n");

      const tradesContext = trades.slice(0, 20).map(t =>
        `${t.date} ${t.action} ${t.ticker} ${t.shares}sh @$${t.price.toFixed(2)}${t.pnl != null ? ` P&L:$${t.pnl.toFixed(0)}` : ''}`
      ).join("\n");

      const summaryCashVal = (summary as any).cash ?? 0;
      const systemPrompt = `You are the MAPO Portfolio Analyst — AI-powered investment system implementing MAPO Framework v4.0 (March 2026).

## LIVE PORTFOLIO CONTEXT
Portfolio: ${portfolio?.name ?? "Unknown"}
Total Value: $${summary.totalValue.toFixed(2)} | Cash: $${summaryCashVal.toFixed(2)} (${summary.totalValue > 0 ? ((summaryCashVal / summary.totalValue) * 100).toFixed(1) : 0}%)
Cost Basis: $${summary.totalCostBasis.toFixed(2)} | G/L: ${summary.totalGainLoss >= 0 ? '+' : ''}$${summary.totalGainLoss.toFixed(2)} (${summary.totalGainLossPct >= 0 ? '+' : ''}${summary.totalGainLossPct.toFixed(2)}%)
Positions: ${summary.holdingsCount} | Target: $45,000+ in 12 months from $20,454 starting capital

HOLDINGS:
${holdingsContext || "No holdings"}

RECENT TRADES:
${tradesContext || "No trades recorded"}

---

## MAPO FRAMEWORK v4.0 — FULL RULES

### ALWAYS / NEVER
ALWAYS: Search real-time data before analysis | Apply 6-factor scoring | Check exclusion list | Keep mega-cap <30% | Document every buy/sell | Provide bull + bear case | Run validation checklist | Apply AGI Macro Thesis | Maintain 5% cash minimum | Check avg daily volume >$5M | Run correlation check before new entry | Re-score any position that gaps >5% in one session.
NEVER: Buy ETFs | Exceed 25% single position | Exceed 40% single sector | Enter without score ≥65 | Buy exclusion list tickers | Open position within 3 days of earnings | Average down after 15% drawdown review | Hold 2+ positions with pairwise correlation >0.70 | Allocate to stock with avg volume <$5M.

### 6-FACTOR SCORING (1-100)
| Factor | Weight | Key Metrics |
|---|---|---|
| Financial Health | 25% | ROE, ROA, debt ratios, FCF, operating cash flow, EBITDA margins |
| Valuation | 20% | P/E TTM+Fwd, P/S, P/B, PEG, EV/EBITDA vs peers and 5yr avg |
| Growth Trajectory | 20% | Revenue growth %, EPS growth %, SUE, earnings revisions, guidance |
| Technical Factors | 15% | vs 50/200-DMA, Donchian channel, dual MA crossover, volume, RSI, 52wk range |
| News Sentiment | 10% | Analyst upgrades/downgrades, insider activity, M&A signals |
| Macro Alignment | 10% | AGI structural theme fit, sector tailwinds, rate sensitivity |

Score thresholds: 80-100 STRONG BUY (up to 25%) | 65-79 BUY (10-20%) | 50-64 HOLD (no add) | <50 AVOID (exit if held)

### QUANT ALPHA SIGNALS (pre-screening boosters)
- Price Momentum (12-1): top 40% by 12mo return excl. last month → +5 pts Technical
- Golden Cross: 50-DMA above 200-DMA → base entry condition; absent → -5 pts Technical
- SUE >1 std dev beat over 8Q → +5 pts Growth
- EPS revised up >3% in 30 days → +4 pts Growth
- Beta >1.8 → -3 pts Technical
- Value: P/B bottom 30% of sector + EV/EBITDA below 5yr avg → +3 pts Valuation
- Donchian: within lower 60% of 52wk range = valid entry; >95% of high = REJECT

### POSITION SIZING
Base: Score 65-79 = 10-15% | Score 80-100 = 15-25%
+2-3% if 3+ quant signals confirmed | -2-3% if Beta >1.5, near 52wk high, or below 200-DMA | Hard cap 25%

### ENTRY CRITERIA (all must pass)
Score ≥65 | Clear bull case with 2+ near-term catalysts | Upside:downside ≥2:1 | Market cap <$50B preferred | NOT on exclusion list | NOT within 5% of 52wk high | 50-DMA above 200-DMA preferred | Adding would NOT push sector >40% or position >25% | At least 1 quant signal confirmed | Avg daily volume >$5M | Bid-ask spread <0.5% | Not within 3 days of earnings

### EXIT CRITERIA (any one triggers review)
Score drops below 50 | Original thesis broken | Materially better opportunity | Position reaches 25% from appreciation (trim) | All quant signals reversed

### DRAWDOWN ESCALATION
10% → review thesis | 15% → mandatory re-score; if <65, reduce 50% | 20% → auto-exit unless board-level catalyst within 30 days | 25% → forced full exit, 90-day cooldown | Portfolio -12% in 30 days → halt all entries, move 10% to cash

### CASH MANAGEMENT
Min 5% | Max 20% | Freed cash from exits: redeploy within 10 trading days

### CORRELATION GUARD
Max pairwise: 0.75 | Portfolio avg >0.60 → mandatory diversification | Never hold 2+ positions with correlation >0.70

### AGI STRUCTURAL MACRO THESIS (permanent sector overweights)
STRONG OW: AI Compute Infrastructure (data center, cooling, networking, fiber) | Power/Electrical Grid (utilities serving AI clusters)
OW: Semiconductors $5B-$50B AI-exposed (NOT NVDA/AMD) | Defense/National Security AI
SELECTIVE: Enterprise AI Software (real revenue, proven monetization)
AVOID/UW: Consumer Discretionary | Commercial Real Estate | Super Mega Cap Tech (>$500B)
AGI Macro score: Core Infrastructure 85-100 | Secondary Beneficiary 70-84 | Neutral 50-69 | Disruption Risk 20-49 | High Disruption 0-19
China Revenue >30%: -5 to -10 pts Macro | US Defense/Gov contracts: +5 pts Macro

### EXCLUSION LIST (never recommend)
BMNR, UP, MP, CLSK, NBIS, AMD, TE, IREN, IBIT, GOOGL, META, NVDA, AAPL, MSFT, AMZN, TSLA
All ETFs, mutual funds, options, futures, leveraged instruments — permanently excluded.

### MARKET CAP RULES
Primary target: <$50B (small/mid cap = highest alpha) | Large cap $50B-$200B: exceptional scores only | Mega cap >$200B: max 30% total | Super mega cap >$500B: AVOID

### PORTFOLIO VALIDATION CHECKLIST
Before any portfolio construction confirm: 4-8 positions | No position >25% | No sector >40% | Mega cap <30% | All scores ≥65 | No exclusion list | No position within 5% of 52wk high | All S&P500/NASDAQ | Bull+bear case documented | Min 3 sectors | Cash ≥5% | No pairwise correlation >0.75 | Avg daily volume >$5M

### STANDARD ANALYSIS OUTPUT FORMAT
## [COMPANY] ([TICKER])
Sector | Market Cap | Price | 52-Week range
Quant Signals: Momentum [Y/N] | SUE [Y/N] | Golden Cross [Y/N] | Beta [X.X]
Investment Report: 2-3 paragraphs
Bull Case / Bear Case: 3-5 catalysts each
Scoring Breakdown table (factor / weight / score / notes)
OVERALL SCORE: XX/100 — [SIGNAL]
Recommendation: action + suggested allocation %

---

RESPONSE INSTRUCTIONS:
- Be concise — use bullet points and tables
- When analyzing a stock, always use the 6-factor scoring methodology
- Flag any portfolio rule violations immediately
- Provide actionable recommendations with clear rationale
- Use markdown formatting
- Be direct — no generic advice`;

      // Get previous chat context (last 10 messages)
      const prevMessages = await storage.getChatMessages(portfolioId);
      const recentMessages = prevMessages.slice(-10);
      const chatHistory = recentMessages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      let assistantContent: string;

      if (selectedModel.sdk === "anthropic") {
        // Anthropic Messages API
        const response = await anthropic.messages.create({
          model: selectedModel.modelId,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            ...chatHistory,
            { role: "user", content: message },
          ],
        });
        assistantContent = response.content[0].type === "text"
          ? response.content[0].text
          : "I couldn't generate a response.";
      } else {
        // OpenAI Responses API
        const inputMessages = [
          ...chatHistory.map(m => ({ type: "message" as const, role: m.role as "user" | "assistant", content: m.content })),
          { type: "message" as const, role: "user" as const, content: message },
        ];

        if (!openai) throw new Error("OpenAI API key not configured");
        const response = await openai.responses.create({
          model: selectedModel.modelId,
          instructions: systemPrompt,
          input: inputMessages,
          max_output_tokens: 1024,
        });

        const outputMsg = (response.output as any[]).find((o) => o.type === "message");
        assistantContent = outputMsg?.content?.[0]?.text || "I couldn't generate a response.";
      }

      // Save assistant message
      const saved = await storage.createChatMessage({
        portfolioId,
        role: "assistant",
        content: assistantContent,
        timestamp: new Date().toISOString(),
      });

      res.json({ message: saved, model: selectedModel.label });
    } catch (error) {
      console.error("AI Analyst error:", error);
      res.status(500).json({ error: "Failed to get AI response" });
    }
  });

  // Performance data
  app.get("/api/performance", async (req, res) => {
    const portfolioId = req.query.portfolioId as string | undefined;
    try {
      // Load price data and trade data to compute performance
      const priceDataPath = join(process.cwd(), "price-data.json");
      const priceDataRaw = readFileSync(priceDataPath, "utf-8");
      const prices: Record<string, Record<string, number>> = JSON.parse(priceDataRaw);

      // Get trades for this portfolio
      const trades = await storage.getTrades(portfolioId);

      // Determine portfolio type
      let portfolio;
      if (portfolioId) {
        portfolio = await storage.getPortfolio(portfolioId);
      }

      // For Mapo AI portfolio, compute from trades
      if (trades.length > 0) {
        // Load mapo-ai-portfolio.json for starting capital and start date
        let startingCapital = 20469.11;
        let mapoData: Record<string, any> = {};
        try {
          const mapoPath = join(process.cwd(), "mapo-ai-portfolio.json");
          const mapoRaw = readFileSync(mapoPath, "utf-8");
          mapoData = JSON.parse(mapoRaw);
          startingCapital = mapoData.startingCapital || startingCapital;
        } catch (e) {}

        // Sort trades by date
        const sortedTrades = [...trades].sort((a, b) => a.date.localeCompare(b.date));

        // Get all trading dates from VOO
        const allDates = Object.keys(prices.VOO || {}).sort();

        // Base date: portfolio startDate from JSON, falling back to first trade date.
        // Find the first available price date on or after the portfolio start date.
        const portfolioStartDate = mapoData.startDate || sortedTrades[0]?.date || allDates[0];
        const baseDate = allDates.find(d => d >= portfolioStartDate) || allDates[0];

        // Group trades by date
        const tradesByDate: Record<string, typeof trades> = {};
        for (const t of sortedTrades) {
          if (!tradesByDate[t.date]) tradesByDate[t.date] = [];
          tradesByDate[t.date].push(t);
        }

        const positions: Record<string, number> = {};
        let cash = startingCapital;

        const vooBase = prices.VOO?.[baseDate] || 1;
        const qqqBase = prices.QQQ?.[baseDate] || 1;

        const performanceData: { date: string; portfolio: number; voo: number; qqq: number }[] = [];

        for (const date of allDates) {
          // Process trades
          if (tradesByDate[date]) {
            for (const t of tradesByDate[date]) {
              if (t.action === "BUY") {
                cash -= t.total;
                positions[t.ticker] = (positions[t.ticker] || 0) + t.shares;
              } else if (t.action === "SELL") {
                cash += t.total;
                positions[t.ticker] = (positions[t.ticker] || 0) - t.shares;
                if ((positions[t.ticker] || 0) <= 0) delete positions[t.ticker];
              }
            }
          }

          // Calc holdings value
          let holdingsValue = 0;
          for (const [ticker, shares] of Object.entries(positions)) {
            if (prices[ticker]?.[date]) {
              holdingsValue += shares * prices[ticker][date];
            }
          }

          const totalValue = cash + holdingsValue;
          const pctReturn = ((totalValue - startingCapital) / startingCapital) * 100;
          const vooReturn = prices.VOO?.[date] ? ((prices.VOO[date] - vooBase) / vooBase) * 100 : 0;
          const qqqReturn = prices.QQQ?.[date] ? ((prices.QQQ[date] - qqqBase) / qqqBase) * 100 : 0;

          performanceData.push({
            date,
            portfolio: Math.round(pctReturn * 100) / 100,
            voo: Math.round(vooReturn * 100) / 100,
            qqq: Math.round(qqqReturn * 100) / 100,
          });
        }

        return res.json(performanceData);
      }

      // For Schwab portfolio (no trades), compute actual weighted portfolio return
      // using real stock prices and current portfolio weights
      const allDates = Object.keys(prices.VOO || {}).sort();
      const holdings = await storage.getHoldings(portfolioId);
      const totalCurrentValue = holdings.reduce((s, h) => s + h.value, 0);

      // Use first available date as base for benchmarks
      const firstDate = allDates[0];
      const vooBase = prices.VOO?.[firstDate] || 1;
      const qqqBase = prices.QQQ?.[firstDate] || 1;

      // Calculate weighted portfolio return based on holdings
      // For each day, compute the portfolio return as the weighted sum
      // of each holding's return using current weights
      const holdingWeights = holdings.map(h => ({
        ticker: h.ticker,
        weight: totalCurrentValue > 0 ? h.value / totalCurrentValue : 0,
      }));

      // Get base prices for each holding on the first date
      const holdingBasePrices: Record<string, number> = {};
      for (const h of holdings) {
        holdingBasePrices[h.ticker] = prices[h.ticker]?.[firstDate] || h.price;
      }

      const performanceData = allDates.map(date => {
        const vooReturn = prices.VOO?.[date] ? ((prices.VOO[date] - vooBase) / vooBase) * 100 : 0;
        const qqqReturn = prices.QQQ?.[date] ? ((prices.QQQ[date] - qqqBase) / qqqBase) * 100 : 0;

        // Weighted portfolio return
        let portfolioReturn = 0;
        for (const hw of holdingWeights) {
          const basePrice = holdingBasePrices[hw.ticker];
          const currentPrice = prices[hw.ticker]?.[date];
          if (basePrice && currentPrice) {
            const holdingReturn = ((currentPrice - basePrice) / basePrice) * 100;
            portfolioReturn += holdingReturn * hw.weight;
          }
        }

        return {
          date,
          portfolio: Math.round(portfolioReturn * 100) / 100,
          voo: Math.round(vooReturn * 100) / 100,
          qqq: Math.round(qqqReturn * 100) / 100,
        };
      });

      return res.json(performanceData);
    } catch (error) {
      console.error("Performance data error:", error);
      return res.json([]);
    }
  });

  // Summary
  app.get("/api/summary", async (req, res) => {
    const portfolioId = req.query.portfolioId as string | undefined;
    const summary = await storage.getPortfolioSummary(portfolioId);
    res.json(summary);
  });

  // ====== LIVE DATA ENDPOINTS ======

  // Live quotes for portfolio holdings + market tickers
  app.get("/api/live/quotes", async (req, res) => {
    try {
      const portfolioId = req.query.portfolioId as string | undefined;
      const holdings = await storage.getHoldings(portfolioId);
      const holdingTickers = holdings.map(h => h.ticker);

      // Market tickers for the tape
      const marketTickers = ["SPY", "QQQ", "DIA", "IWM", "VIX", "GLD", "TLT", "VOO"];

      // Combine and deduplicate
      const allTickers = Array.from(new Set([...holdingTickers, ...marketTickers]));

      const quotes = await fetchLiveQuotes(allTickers);

      // Also update holdings in storage with live prices
      for (const holding of holdings) {
        const quote = quotes.find(q => q.symbol === holding.ticker);
        if (quote && quote.price > 0) {
          const newValue = holding.quantity * quote.price;
          const gainLoss = newValue - holding.costBasis;
          const gainLossPct = holding.costBasis > 0 ? (gainLoss / holding.costBasis) * 100 : 0;
          await storage.updateHolding(holding.id, {
            price: quote.price,
            value: newValue,
            dayChange: holding.quantity * quote.change,
            dayChangePct: quote.changesPercentage,
            gainLoss,
            gainLossPct,
          });
        }
      }

      res.json({
        quotes,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Live quotes error:", error);
      res.status(500).json({ error: "Failed to fetch live quotes" });
    }
  });

  // Live earnings schedule for portfolio holdings
  app.get("/api/live/earnings", async (req, res) => {
    try {
      const portfolioId = req.query.portfolioId as string | undefined;
      const holdings = await storage.getHoldings(portfolioId);
      const tickers = holdings.map(h => h.ticker);
      const earnings = await fetchEarningsSchedule(tickers);
      res.json(earnings);
    } catch (error) {
      console.error("Earnings schedule error:", error);
      res.status(500).json({ error: "Failed to fetch earnings" });
    }
  });

  // Live market sentiment
  app.get("/api/live/sentiment", async (_req, res) => {
    try {
      const sentiment = await fetchMarketSentiment();
      res.json(sentiment);
    } catch (error) {
      console.error("Market sentiment error:", error);
      res.status(500).json({ error: "Failed to fetch sentiment" });
    }
  });

  // Live news for portfolio holdings
  app.get("/api/live/news", async (req, res) => {
    try {
      const portfolioId = req.query.portfolioId as string | undefined;
      const holdings = await storage.getHoldings(portfolioId);
      const tickers = holdings.map(h => h.ticker);
      const news = await fetchPortfolioNews(tickers);
      res.json(news);
    } catch (error) {
      console.error("Live news error:", error);
      res.status(500).json({ error: "Failed to fetch news" });
    }
  });

  // Real analytics: volatility, correlation, risk metrics from price history
  app.get("/api/analytics", async (req, res) => {
    try {
      const portfolioId = req.query.portfolioId as string | undefined;
      const priceDataPath = join(process.cwd(), "price-data.json");
      const priceDataRaw = readFileSync(priceDataPath, "utf-8");
      const prices: Record<string, Record<string, number>> = JSON.parse(priceDataRaw);
      const holdings = await storage.getHoldings(portfolioId);

      if (holdings.length === 0) {
        return res.json({ volatility: {}, correlation: {}, sharpe: null, sortino: null, beta: null, maxDrawdown: null });
      }

      const tickers = holdings.map(h => h.ticker);
      const allDates = Object.keys(prices.VOO || {}).sort();
      const recentDates = allDates.slice(-63); // ~3 months of trading days

      // Compute log returns for each ticker + VOO (benchmark)
      const getReturns = (ticker: string, dates: string[]): number[] => {
        const tickerPrices = prices[ticker];
        if (!tickerPrices) return [];
        const returns: number[] = [];
        for (let i = 1; i < dates.length; i++) {
          const p0 = tickerPrices[dates[i - 1]];
          const p1 = tickerPrices[dates[i]];
          if (p0 && p1 && p0 > 0) {
            returns.push(Math.log(p1 / p0));
          }
        }
        return returns;
      };

      const mean = (arr: number[]): number =>
        arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

      const stddev = (arr: number[]): number => {
        if (arr.length < 2) return 0;
        const m = mean(arr);
        const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
        return Math.sqrt(variance);
      };

      const pearson = (a: number[], b: number[]): number => {
        const len = Math.min(a.length, b.length);
        if (len < 5) return 0;
        const a2 = a.slice(0, len);
        const b2 = b.slice(0, len);
        const ma = mean(a2);
        const mb = mean(b2);
        const num = a2.reduce((s, v, i) => s + (v - ma) * (b2[i] - mb), 0);
        const den = Math.sqrt(a2.reduce((s, v) => s + (v - ma) ** 2, 0) * b2.reduce((s, v) => s + (v - mb) ** 2, 0));
        return den === 0 ? 0 : Math.max(-1, Math.min(1, num / den));
      };

      // Per-ticker annualized volatility (30-day window)
      const volatility: Record<string, number> = {};
      const tickerReturns: Record<string, number[]> = {};
      for (const ticker of tickers) {
        const rets = getReturns(ticker, recentDates);
        tickerReturns[ticker] = rets;
        const vol = stddev(rets) * Math.sqrt(252) * 100;
        volatility[ticker] = parseFloat(vol.toFixed(1));
      }

      // Pairwise correlations (top 6 by value)
      const top6 = [...holdings].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 6);
      const correlation: Record<string, number> = {};
      for (let i = 0; i < top6.length; i++) {
        for (let j = 0; j < top6.length; j++) {
          const key = `${top6[i].ticker}_${top6[j].ticker}`;
          if (i === j) {
            correlation[key] = 1.0;
          } else {
            const r1 = tickerReturns[top6[i].ticker] || [];
            const r2 = tickerReturns[top6[j].ticker] || [];
            correlation[key] = parseFloat(pearson(r1, r2).toFixed(3));
          }
        }
      }

      // Portfolio-level metrics using weighted daily returns
      const totalValue = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
      const weights = holdings.map(h => ({ ticker: h.ticker, w: totalValue > 0 ? (h.value ?? 0) / totalValue : 0 }));

      const portfolioReturns: number[] = [];
      for (let i = 1; i < recentDates.length; i++) {
        let dayReturn = 0;
        let covered = 0;
        for (const { ticker, w } of weights) {
          const p0 = prices[ticker]?.[recentDates[i - 1]];
          const p1 = prices[ticker]?.[recentDates[i]];
          if (p0 && p1 && p0 > 0) {
            dayReturn += Math.log(p1 / p0) * w;
            covered += w;
          }
        }
        if (covered > 0.3) portfolioReturns.push(dayReturn / covered);
      }

      const vooReturns = getReturns("VOO", recentDates);

      // Annualized return
      const annualizedReturn = mean(portfolioReturns) * 252 * 100;
      const annualizedVol = stddev(portfolioReturns) * Math.sqrt(252) * 100;
      const riskFreeRate = 4.5;

      // Sharpe
      const sharpe = annualizedVol > 0 ? parseFloat(((annualizedReturn - riskFreeRate) / annualizedVol).toFixed(2)) : null;

      // Sortino (downside deviation only)
      const downsideReturns = portfolioReturns.filter(r => r < 0);
      const downsideVol = stddev(downsideReturns) * Math.sqrt(252) * 100;
      const sortino = downsideVol > 0 ? parseFloat(((annualizedReturn - riskFreeRate) / downsideVol).toFixed(2)) : null;

      // Beta vs VOO
      const minLen = Math.min(portfolioReturns.length, vooReturns.length);
      const pr = portfolioReturns.slice(0, minLen);
      const vr = vooReturns.slice(0, minLen);
      const covPV = pr.reduce((s, v, i) => s + (v - mean(pr)) * (vr[i] - mean(vr)), 0) / (minLen - 1);
      const varVOO = vr.reduce((s, v) => s + (v - mean(vr)) ** 2, 0) / (minLen - 1);
      const beta = varVOO > 0 ? parseFloat((covPV / varVOO).toFixed(2)) : null;

      // Max drawdown from price history
      let peak = 1.0;
      let equity = 1.0;
      let maxDD = 0;
      for (const r of portfolioReturns) {
        equity *= Math.exp(r);
        if (equity > peak) peak = equity;
        const dd = (equity - peak) / peak;
        if (dd < maxDD) maxDD = dd;
      }
      const maxDrawdown = parseFloat((maxDD * 100).toFixed(1));

      res.json({ volatility, correlation, sharpe, sortino, beta, maxDrawdown, annualizedReturn: parseFloat(annualizedReturn.toFixed(1)), annualizedVol: parseFloat(annualizedVol.toFixed(1)), top6Tickers: top6.map(h => h.ticker) });
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Failed to compute analytics" });
    }
  });

  // ====== MARKET QUOTES (for MarketTab + ScreenerTab) ======
  app.get("/api/market/quotes", async (req, res) => {
    try {
      const symbolsParam = req.query.symbols as string;
      if (!symbolsParam) return res.json({});
      const symbols = symbolsParam.split(",").map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 40);
      const quotes = await fetchLiveQuotes(symbols);
      // Return as a Record<symbol, quote>
      const result: Record<string, any> = {};
      for (const q of quotes) {
        result[q.symbol] = {
          c: q.price,
          d: q.change,
          dp: q.changesPercentage,
          h: q.dayHigh ?? 0,
          l: q.dayLow ?? 0,
          o: 0,
          pc: q.previousClose ?? 0,
        };
      }
      res.json(result);
    } catch (error) {
      console.error("Market quotes error:", error);
      res.json({});
    }
  });

  // ====== MAPO FULL 6-FACTOR SCORE ======
  app.post("/api/mapo-score", async (req, res) => {
    try {
      const { ticker } = req.body;
      if (!ticker || typeof ticker !== "string") {
        return res.status(400).json({ error: "ticker required" });
      }
      const sym = ticker.toUpperCase().trim();

      // Gate 1: Exclusion List - instant reject
      const exclusionCheck = isExcluded(sym);
      if (exclusionCheck.excluded) {
        return res.json({
          ticker: sym, score: 15, signal: "AVOID", rejected: true,
          rejectReason: `EXCLUDED: ${exclusionCheck.reason}`,
          factors: { financialHealth: 15, valuation: 15, growth: 15, technical: 15, sentiment: 15, macroFit: 15 },
          factorNotes: { financialHealth: "Excluded", valuation: "Excluded", growth: "Excluded", technical: "Excluded", sentiment: "Excluded", macroFit: "Excluded" },
          thesis: `${sym} is on the MAPO permanent exclusion list: ${exclusionCheck.reason}. Do not buy.`,
          risks: ["On permanent exclusion list"], catalysts: [],
          entryNote: "DO NOT BUY - Exclusion List",
          quantSignals: null, dataSource: "exclusion-list",
          analyzedAt: new Date().toISOString(),
        });
      }

      // Fetch all data in parallel from FMP + Alpha Vantage
      const [
        profileR, incomeR, balanceR, cashflowR, ratiosR, metricsR,
        growthR, earningsR, upgradesR, insiderR,
        fmpQuoteR, barsR, rsiR,
      ] = await Promise.allSettled([
        fmp.getProfile(sym), fmp.getIncomeStatement(sym), fmp.getBalanceSheet(sym),
        fmp.getCashFlow(sym), fmp.getKeyRatios(sym), fmp.getKeyMetrics(sym),
        fmp.getFinancialGrowth(sym), fmp.getEarnings(sym),
        fmp.getUpgradesDowngrades(sym), fmp.getInsiderTrading(sym),
        fmp.getFMPQuote(sym), getDailyPrices(sym, "full"), getRSI(sym, 14),
      ]);

      const ok = <T>(r: PromiseSettledResult<T>): T | null => r.status === "fulfilled" ? r.value : null;

      const profileData = ok(profileR)?.[0] ?? null;
      const incomeData = ok(incomeR) ?? [];
      const balanceData = ok(balanceR) ?? [];
      const cashflowData = ok(cashflowR) ?? [];
      const ratiosData = ok(ratiosR) ?? [];
      const metricsData = ok(metricsR) ?? [];
      const growthData = ok(growthR) ?? [];
      const earningsData = ok(earningsR) ?? [];
      const upgradesData = ok(upgradesR) ?? [];
      const insiderData = ok(insiderR) ?? [];
      // Fetch news from Finnhub
      let newsData: any[] = [];
      try {
        newsData = await fetchPortfolioNews([sym]);
      } catch { /* ignore */ }
      const fmpQuoteData = ok(fmpQuoteR)?.[0] ?? null;
      const bars = ok(barsR) ?? [];
      const rsiValue = ok(rsiR);

      const currentPrice = fmpQuoteData?.price ?? profileData?.price ?? 0;
      const marketCap = profileData?.mktCap ?? fmpQuoteData?.marketCap ?? 0;

      // Fetch SPY for beta calculation
      let spBars: typeof bars = [];
      try { spBars = await getDailyPrices("SPY", "compact"); } catch { /* ignore */ }

      // Compute all 7 quant signals (pure math)
      const momentum = calcMomentum(bars);
      const goldenCross = calcGoldenCross(bars);
      const sue = calcSUE(earningsData);
      const revisions = calcRevisions(earningsData);
      const betaValue = calcBeta(bars, spBars);
      const valueFactor = calcValueFactor(metricsData);
      const donchian = calcDonchian(bars, currentPrice);

      const quantSignals = {
        momentum, goldenCross, sue, revisions,
        beta: { value: betaValue, lowVol: betaValue < 1.2, highVol: betaValue > RULES.HIGH_BETA_THRESHOLD },
        valueFactor, donchian,
        compositeCount: [momentum.confirmed, goldenCross.confirmed, sue.confirmed, revisions.confirmed, valueFactor.confirmed].filter(Boolean).length,
      };

      const signalSummary = buildSignalSummary(quantSignals);

      // Gate 2: Donchian reject
      if (donchian.reject) {
        return res.json({
          ticker: sym, score: 30, signal: "AVOID", rejected: true,
          rejectReason: `DONCHIAN REJECT: ${sym} at ${(donchian.position * 100).toFixed(0)}% of 52-week range. Too close to 52-week high.`,
          factors: { financialHealth: 50, valuation: 30, growth: 50, technical: 30, sentiment: 50, macroFit: 50 },
          factorNotes: { financialHealth: "N/A", valuation: "N/A - near 52wk high", growth: "N/A", technical: "Donchian reject", sentiment: "N/A", macroFit: "N/A" },
          thesis: `${sym} is near its 52-week high ($${donchian.high52w}). MAPO requires waiting for a better entry point.`,
          risks: ["Near 52-week high - poor risk/reward"],
          catalysts: [], entryNote: `Wait for pullback below $${(donchian.high52w * 0.90).toFixed(2)}`,
          quantSignals: { ...quantSignals, signalSummary: signalSummary },
          dataSource: "donchian-reject", analyzedAt: new Date().toISOString(),
        });
      }

      // Build rich data package for Claude
      const dataPackage = {
        company: {
          ticker: sym,
          name: profileData?.companyName ?? sym,
          sector: profileData?.sector ?? "Unknown",
          industry: profileData?.industry ?? "Unknown",
          marketCapB: marketCap ? `$${(marketCap / 1e9).toFixed(1)}B` : "Unknown",
          price: `$${currentPrice.toFixed(2)}`,
          exchange: profileData?.exchangeShortName ?? "Unknown",
          description: (profileData?.description ?? "").slice(0, 400),
        },
        fundamentals: {
          ratios: ratiosData.slice(0, 3).map((r: any) => ({
            // stable API field names (post Aug 2025)
            roe: r?.returnOnEquity, roa: r?.returnOnAssets,
            debtToEquity: r?.debtToEquityRatio, currentRatio: r?.currentRatio,
            peRatio: r?.priceToEarningsRatio, pbRatio: r?.priceToBookRatio,
            psRatio: r?.priceToSalesRatio, pegRatio: r?.priceToEarningsGrowthRatio,
            netMargin: r?.netProfitMargin, grossMargin: r?.grossProfitMargin,
            evToEbitda: r?.enterpriseValueMultiple ?? r?.evToEBITDA,
          })),
          metrics: metricsData.slice(0, 3).map((m: any) => ({
            fcfPerShare: m?.freeCashFlowPerShare, evToEbitda: m?.evToEBITDA, evToSales: m?.evToSales,
          })),
          growth: growthData.slice(0, 3).map((g: any) => ({
            date: g?.date, revenueGrowth: g?.revenueGrowth, netIncomeGrowth: g?.netIncomeGrowth,
            epsGrowth: g?.epsgrowth ?? g?.epsGrowth, fcfGrowth: g?.freeCashFlowGrowth,
          })),
          income: incomeData.slice(0, 4).map((i: any) => ({
            date: i?.date, revenue: i?.revenue, grossProfit: i?.grossProfit,
            netIncome: i?.netIncome, eps: i?.eps ?? i?.netIncomePerShare, ebitda: i?.ebitda,
          })),
          cashflow: cashflowData.slice(0, 3).map((c: any) => ({
            date: c?.date, operatingCF: c?.operatingCashFlow ?? c?.netCashProvidedByOperatingActivities,
            freeCF: c?.freeCashFlow, capex: c?.capitalExpenditure,
          })),
        },
        technicals: {
          currentPrice, rsi: rsiValue ? Math.round(rsiValue) : null,
          sma50: goldenCross.sma50, sma200: goldenCross.sma200,
          goldenCross: goldenCross.confirmed,
          high52w: donchian.high52w, low52w: donchian.low52w,
          donchianPct: `${(donchian.position * 100).toFixed(0)}% of 52wk range`,
          beta: betaValue,
        },
        quantSignals: signalSummary,
        quantSignalCount: `${quantSignals.compositeCount}/5 signals confirmed`,
        earnings: {
          surprises: earningsData.filter((e: any) => e.epsActual != null).slice(0, 4).map((s: any) => ({
            date: s?.date, actual: s?.epsActual ?? s?.actualEarningResult, estimated: s?.epsEstimated ?? s?.estimatedEarning,
            surprise: s?.estimatedEarning ? `${(((s?.actualEarningResult ?? 0) - s?.estimatedEarning) / Math.abs(s?.estimatedEarning) * 100).toFixed(1)}%` : null,
          })),
          sueScore: sue.score,
          revisionPct: `${(revisions.revisionPct * 100).toFixed(1)}%`,
        },
        sentiment: {
          analysts: upgradesData.slice(0, 4).map((r: any) => ({ date: r?.publishedDate ?? r?.date, action: r?.action, analyst: r?.gradingCompany ?? r?.analyst, fromGrade: r?.previousGrade, toGrade: r?.newGrade })),
          insider: insiderData.slice(0, 5).map((t: any) => ({ date: t?.transactionDate, name: t?.reportingName, type: t?.transactionType, shares: t?.securitiesTransacted })),
          news: newsData.slice(0, 5).map((n: any) => ({ title: (n?.headline ?? n?.title ?? "").slice(0, 100), time: n?.time })),
        },
      };

      const scoringPrompt = `You are the MAPO Portfolio Analyst v4.0. Score ${sym} using the 6-factor MAPO methodology. Real financial data from FMP and Alpha Vantage is provided below. You MUST cite specific numbers from this data in your factorNotes. Do not use generic statements — reference actual figures (e.g. "ROE 24.3%", "EV/EBITDA 18.2x vs 5yr avg 22.1x", "revenue grew 27.7% YoY").

QUANT SIGNALS ALREADY COMPUTED (mathematical, non-negotiable):
${signalSummary}
Confirmed signals: ${quantSignals.compositeCount}/5

REAL DATA:
${JSON.stringify(dataPackage, null, 2)}

SCORING INSTRUCTIONS:
- Financial Health (25%): Score actual ROE, ROA, debt ratios, FCF margins, current ratio from data. High ROE >15%, strong FCF, low debt = high score.
- Valuation (20%): Score actual P/E, P/B, EV/EBITDA vs historical. Value signal confirmed = +3pts. Low valuations vs history = higher score.
- Growth (20%): Score actual revenue/EPS/FCF growth rates. SUE confirmed = +5pts to base. Revisions confirmed = +4pts to base.
- Technical (15%): Score price vs MAs, RSI (>70 overbought, <30 oversold), Donchian. Golden Cross = base met. Death Cross = -5pts. Momentum = +5pts. Beta >1.8 = -3pts.
- Sentiment (10%): Score analyst actions (upgrades vs downgrades), insider buying vs selling, news tone.
- Macro Fit (10%): AGI thesis alignment. Core AI infra = 85-100. Non-mega semis = 70-95. Defense AI = 75-90. Enterprise AI (real revenue) = 60-85. Neutral = 50-69. Consumer/CRE disruption risk = 20-49. China revenue >30% = -5 to -10pts.

Weighted composite = Financial*0.25 + Valuation*0.20 + Growth*0.20 + Technical*0.15 + Sentiment*0.10 + MacroFit*0.10

Return ONLY valid JSON, no markdown, no backticks, no explanation:
{
  "ticker": "${sym}",
  "score": <weighted composite 0-100>,
  "factors": {
    "financialHealth": <0-100>,
    "valuation": <0-100>,
    "growth": <0-100>,
    "technical": <0-100>,
    "sentiment": <0-100>,
    "macroFit": <0-100>
  },
  "factorNotes": {
    "financialHealth": "<cite specific ROE/ROA/debt numbers>",
    "valuation": "<cite P/E, EV/EBITDA vs history>",
    "growth": "<cite revenue/EPS growth rates, SUE/revision adjustments>",
    "technical": "<MA status, RSI, Donchian, quant adjustments applied>",
    "sentiment": "<analyst actions, insider activity summary>",
    "macroFit": "<AGI thesis assessment with specific alignment category>"
  },
  "signal": "<STRONG BUY | BUY | HOLD | AVOID>",
  "thesis": "<2-3 sentences citing real data points>",
  "risks": ["<specific risk 1>", "<specific risk 2>", "<specific risk 3>"],
  "catalysts": ["<specific catalyst 1>", "<specific catalyst 2>", "<specific catalyst 3>"],
  "entryNote": "<specific entry/action note with price levels>",
  "rejected": false,
  "rejectReason": "",
  "agiAlignment": "<Core Infra | Secondary Beneficiary | Neutral | Disruption Risk | High Disruption>"
}`;

      const aiResponse = await anthropic.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: scoringPrompt }],
      });

      const text = aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "{}";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(500).json({ error: "Invalid AI response", raw: text.slice(0, 300) });

      let parsed: any;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        return res.status(500).json({ error: "Failed to parse AI response", raw: text.slice(0, 300) });
      }

      // Save score to Supabase score_history (fire and forget)
      if (isSupabaseEnabled && parsed.score) {
        import("./lib/supabaseStorage.js").then(({ SupabaseStorage }) => {
          const sb = new SupabaseStorage();
          sb.saveScore({
            ticker: sym,
            compositeScore: parsed.score,
            financialHealth: parsed.factors?.financialHealth,
            valuation: parsed.factors?.valuation,
            growth: parsed.factors?.growth,
            technical: parsed.factors?.technical,
            sentiment: parsed.factors?.sentiment,
            macroFit: parsed.factors?.macroFit,
            quantSignals: quantSignals,
            rating: parsed.signal,
            thesis: parsed.thesis,
            risks: parsed.risks,
            catalysts: parsed.catalysts,
            factorNotes: parsed.factorNotes,
            agiAlignment: parsed.agiAlignment,
            dataSource: "fmp+alphavantage+claude",
          }).catch(() => {});
        }).catch(() => {});
      }

      return res.json({
        ...parsed,
        quantSignals: { ...quantSignals, signalSummary: signalSummary },
        dataSource: "fmp+alphavantage+claude",
        analyzedAt: new Date().toISOString(),
      });

    } catch (error: any) {
      console.error("MAPO score error:", error);
      res.status(500).json({ error: "Failed to compute MAPO score", detail: error.message });
    }
  });

  // ====== STOCK SCREENER ======
  // Uses MAPO curated universe (AGI thesis + broad market small/mid cap)
  // enriched with live FMP profile data, filtered by sector/cap params
  app.post("/api/screen", async (req, res) => {
    try {
      const { sector, maxMarketCap = 50_000_000_000, minMarketCap = 500_000_000 } = req.body;

      // MAPO universe: AGI thesis + broad small/mid cap, all <$50B, exclusion-list clean
      const MAPO_UNIVERSE: Record<string, string[]> = {
        "Technology": ["COHR","SMCI","CRDO","CIEN","LITE","AAOI","VIAV","IIVI","FORM","ACMR","ONTO","AEHR","ICHR","AEIS","MKSI","NTAP","PSTG","ESTC","GTLB","MXCHIP"],
        "Industrials": ["STRL","ATKR","POWL","NVEE","GVA","IESC","TPIC","MYR","EME","PWR","PCOR","ESAB","GTLS","TDW","MYRG","HLIO"],
        "Utilities": ["VST","NRG","CEG","OGE","CLNE","NRUC","MGEE","AVA","IDACORP","NWE","PNM","SPWR"],
        "Energy": ["TALO","NOG","CIVI","OVV","SM","MTDR","CHRD","GPOR","VTLE","MGY"],
        "Financials": ["DLO","RELY","STEP","LPLA","COOP","KNSL","RYAN","HIMS","AFRM","UPST"],
        "Health Care": ["HIMS","ACAD","CRVS","RXRX","RCKT","ARWR","TMDX","IRTC","OMCL","TDOC"],
        "Consumer Discretionary": ["ELF","BOOT","SHAK","TXRH","WING","CAVA","KRUS","PTLO","FAT"],
        "Communication Services": ["DV","MGNI","IAS","TTD","PUBM","APPS","VNET","CLFD"],
        "Materials": ["IOSP","TREX","AZEK","IBP","UFP","PGTI"],
        "Real Estate": ["REXR","IIPR","STAG","COLD","EXR","LSI"],
      };

      // If sector specified, use that universe; otherwise flatten all
      let candidates: string[];
      if (sector && MAPO_UNIVERSE[sector]) {
        candidates = MAPO_UNIVERSE[sector];
      } else {
        candidates = Object.values(MAPO_UNIVERSE).flat();
      }

      // Remove exclusion list tickers
      candidates = candidates.filter(t => !isExcluded(t).excluded);

      // Fetch profiles in batches of 10
      const batchSize = 10;
      const profiles: any[] = [];
      for (let i = 0; i < candidates.length && i < 80; i += batchSize) {
        const batch = candidates.slice(i, i + batchSize);
        const batchProfiles = await Promise.allSettled(batch.map(t => fmp.getProfile(t)));
        batchProfiles.forEach(r => {
          if (r.status === "fulfilled" && r.value?.[0]) profiles.push(r.value[0]);
        });
      }

      const filtered = profiles
        .filter(p => {
          const cap = p.marketCap ?? p.mktCap ?? 0;
          return cap >= minMarketCap && cap <= maxMarketCap;
        })
        .sort((a, b) => ((b.marketCap ?? b.mktCap ?? 0) - (a.marketCap ?? a.mktCap ?? 0)))
        .slice(0, 40)
        .map(p => {
          const cap = p.marketCap ?? p.mktCap ?? 0;
          return {
          ticker: p.symbol,
          name: p.companyName,
          sector: p.sector,
          industry: p.industry,
          marketCapB: cap ? `$${(cap / 1e9).toFixed(1)}B` : "?",
          price: p.price,
          change: p.changes,
          changePct: p.changesPercentage ?? ((p.changes / (p.price - p.changes)) * 100),
          beta: p.beta,
          volume: p.volAvg,
          high52w: p.range?.split("-")?.[1] ?? null,
          low52w: p.range?.split("-")?.[0] ?? null,
          exchange: p.exchangeShortName,
          description: (p.description ?? "").slice(0, 120),
        };
        });

      res.json(filtered);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Score history
  app.get("/api/score-history", async (req, res) => {
    const ticker = req.query.ticker as string | undefined;
    if (isSupabaseEnabled) {
      const { SupabaseStorage } = await import("./lib/supabaseStorage.js");
      const sb = new SupabaseStorage();
      const history = await sb.getScoreHistory(ticker);
      return res.json(history);
    }
    res.json([]);
  });

  // Rebalance analysis
  app.get("/api/rebalance", async (req, res) => {
    const portfolioId = req.query.portfolioId as string | undefined;
    try {
      const holdings = await storage.getHoldings(portfolioId);
      const summary = await storage.getPortfolioSummary(portfolioId);

      // Determine cash: prefer summary.cash (from portfolioMeta / in-memory storage),
      // fall back to mapo-ai-portfolio.json, then hardcoded default.
      let cash: number;
      const summaryCash = (summary as any).cash;
      if (typeof summaryCash === "number") {
        cash = summaryCash;
      } else {
        cash = 277.00;
        try {
          const mapoPath = join(process.cwd(), "mapo-ai-portfolio.json");
          const mapoRaw = readFileSync(mapoPath, "utf-8");
          const mapoData = JSON.parse(mapoRaw);
          if (typeof mapoData.cash === "number") {
            cash = mapoData.cash;
          }
        } catch (_e) {
          // default cash stays 277.00
        }
      }

      // summary.totalValue already includes cash (from MemStorage.getPortfolioSummary)
      const totalValue = summary.totalValue;
      const cashTargetPct = 10;
      const numPositions = holdings.length;
      const targetPct = numPositions > 0 ? (100 - cashTargetPct) / numPositions : 0;

      // Per-position calculations
      const positions = holdings.map((holding) => {
        const currentPct = totalValue > 0 ? (holding.value / totalValue) * 100 : 0;
        const diffPct = currentPct - targetPct;
        const actionAmount = Math.abs((diffPct / 100) * totalValue);
        const shares = holding.price > 0 ? Math.round((actionAmount / holding.price) * 100) / 100 : 0;
        let action: "BUY" | "SELL" | "HOLD";
        if (diffPct > 2) {
          action = "SELL";
        } else if (diffPct < -2) {
          action = "BUY";
        } else {
          action = "HOLD";
        }
        return {
          ticker: holding.ticker,
          name: holding.name,
          currentValue: holding.value,
          currentPct: Math.round(currentPct * 100) / 100,
          targetPct: Math.round(targetPct * 100) / 100,
          diffPct: Math.round(diffPct * 100) / 100,
          action,
          actionAmount: Math.round(actionAmount * 100) / 100,
          shares,
          currentPrice: holding.price,
        };
      });

      // Cash analysis
      const cashPct = totalValue > 0 ? (cash / totalValue) * 100 : 0;
      let cashAction: "DEPLOY" | "RAISE" | "OK";
      if (cashPct < 5) {
        cashAction = "RAISE";
      } else if (cashPct > 20) {
        cashAction = "DEPLOY";
      } else {
        cashAction = "OK";
      }
      const cashActionAmount = Math.round(Math.abs(((cashPct - cashTargetPct) / 100) * totalValue) * 100) / 100;

      // Drawdown alerts (positions with gainLossPct < -15)
      const drawdownAlerts: string[] = [];
      for (const holding of holdings) {
        const gainLossPct = holding.gainLossPct ?? 0;
        if (gainLossPct < -15) {
          drawdownAlerts.push(`${holding.ticker} at ${gainLossPct.toFixed(1)}% — re-score required`);
        }
      }
      // maxDrawdownAlert = worst single-position alert (most negative gainLossPct)
      let maxDrawdownAlert: string | null = null;
      if (drawdownAlerts.length > 0) {
        let worstPct = 0;
        let worstAlert = "";
        for (const holding of holdings) {
          const gainLossPct = holding.gainLossPct ?? 0;
          if (gainLossPct < -15 && gainLossPct < worstPct) {
            worstPct = gainLossPct;
            worstAlert = `${holding.ticker} at ${gainLossPct.toFixed(1)}% — re-score required`;
          }
        }
        maxDrawdownAlert = worstAlert || null;
      }

      // Concentration alerts: group by sector
      const sectorTotals: Record<string, number> = {};
      for (const holding of holdings) {
        const sector = holding.sector ?? "Other";
        sectorTotals[sector] = (sectorTotals[sector] ?? 0) + holding.value;
      }
      const concentrationAlerts: string[] = [];
      for (const [sector, sectorValue] of Object.entries(sectorTotals)) {
        const sectorPct = totalValue > 0 ? (sectorValue / totalValue) * 100 : 0;
        if (sectorPct > 40) {
          concentrationAlerts.push(`${sector} sector at ${sectorPct.toFixed(0)}% — over 40% MAPO limit`);
        }
      }

      res.json({
        positions,
        totalValue: Math.round(totalValue * 100) / 100,
        cashValue: cash,
        cashPct: Math.round(cashPct * 100) / 100,
        targetCashPct: cashTargetPct,
        cashAction,
        cashActionAmount,
        maxDrawdownAlert,
        concentrationAlerts,
      });
    } catch (error) {
      console.error("Rebalance error:", error);
      res.status(500).json({ error: "Failed to compute rebalance analysis" });
    }
  });

  // ====== EXTENDED QUOTES (52-week high/low) ======
  app.get("/api/live/extended-quotes", async (req, res) => {
    try {
      const portfolioId = req.query.portfolioId as string | undefined;
      const holdings = await storage.getHoldings(portfolioId);
      const tickers = holdings.map(h => h.ticker);
      const extendedQuotes = await fetchExtendedQuotes(tickers);
      res.json(extendedQuotes);
    } catch (error) {
      console.error("Extended quotes error:", error);
      res.status(500).json({ error: "Failed to fetch extended quotes" });
    }
  });

  // ====== MACRO CALENDAR ======
  app.get("/api/macro/calendar", (_req, res) => {
    interface MacroEvent {
      date: string;
      type: "FOMC" | "CPI" | "GDP" | "EARNINGS";
      label: string;
      impact: "HIGH" | "MEDIUM";
      daysUntil: number;
    }

    const fomcDates = [
      "2026-01-28", "2026-03-18", "2026-05-06", "2026-06-17",
      "2026-07-29", "2026-09-16", "2026-11-04", "2026-12-16",
    ];
    const cpiDates = [
      "2026-01-15", "2026-02-12", "2026-03-12", "2026-04-10", "2026-05-13",
      "2026-06-11", "2026-07-15", "2026-08-12", "2026-09-11", "2026-10-14",
      "2026-11-12", "2026-12-10",
    ];
    const gdpDates = [
      "2026-01-29", "2026-02-26", "2026-03-26", "2026-04-29",
      "2026-07-30", "2026-10-29",
    ];

    const now = new Date();
    const cutoff = new Date(now.getTime() + 90 * 86400000);

    const rawEvents: Omit<MacroEvent, "daysUntil">[] = [
      ...fomcDates.map(date => ({ date, type: "FOMC" as const, label: "FOMC Meeting", impact: "HIGH" as const })),
      ...cpiDates.map(date => ({ date, type: "CPI" as const, label: "CPI Report", impact: "HIGH" as const })),
      ...gdpDates.map(date => ({ date, type: "GDP" as const, label: "GDP Advance", impact: "MEDIUM" as const })),
    ];

    const events: MacroEvent[] = rawEvents
      .map(e => ({
        ...e,
        daysUntil: Math.ceil((new Date(e.date).getTime() - now.getTime()) / 86400000),
      }))
      .filter(e => {
        const eventDate = new Date(e.date);
        return eventDate >= now && eventDate <= cutoff;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json(events);
  });

  return httpServer;
}
