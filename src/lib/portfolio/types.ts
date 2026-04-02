export interface Holding {
  id: string;
  ticker: string;
  companyName: string;
  shares: number;
  entryPrice: number;
  entryDate: string;
  entryScore: number;
  sector: string;
  marketCapAtEntry: number;
  trancheNumber: number;
  notes?: string;
  // Runtime-enriched fields (not stored)
  currentPrice?: number;
  value?: number;
  returnPct?: number;
  marketCap?: number;
  avgDailyVolume?: number;
}

export interface Trade {
  id: string;
  ticker: string;
  action: "BUY" | "SELL" | "TRIM";
  shares: number;
  price: number;
  totalValue: number;
  scoreAtTrade?: number;
  rationale: string;
  tradeDate: string;
}

export interface PortfolioSnapshot {
  snapshotDate: string;
  totalValue: number;
  cash: number;
  holdingsJson: Holding[];
  sp500Value?: number;
  totalReturn?: number;
  sp500Return?: number;
  alpha?: number;
}

export interface PortfolioState {
  holdings: Holding[];
  cash: number;
  totalValue: number;
  cashPct: number;
  lastUpdated: string;
}
