export interface FMPProfile {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  marketCap: number;
  mktCap: number;
  price: number;
  changes: number;
  changesPercentage: number;
  beta: number;
  volAvg: number;
  range: string;
  description: string;
  exchangeShortName: string;
}

export interface FMPQuote {
  symbol: string;
  price: number;
  changesPercentage: number;
  avgVolume: number;
  marketCap: number;
  change: number;
}

export interface FMPIncomeStatement {
  date: string;
  revenue: number;
  grossProfit: number;
  operatingIncome: number;
  netIncome: number;
  eps: number;
  epsDiluted: number;
  period: string;
}

export interface FMPKeyMetrics {
  date: string;
  peRatio: number;
  pbRatio: number;
  priceToSalesRatio: number;
  enterpriseValueOverEBITDA: number;
  evToEBITDA: number;
  freeCashFlowYield: number;
  revenuePerShare: number;
}

export interface FMPKeyRatios {
  date: string;
  returnOnEquity: number;
  returnOnAssets: number;
  currentRatio: number;
  debtEquityRatio: number;
  netProfitMargin: number;
  grossProfitMargin: number;
  operatingProfitMargin: number;
}

export interface FMPFinancialGrowth {
  date: string;
  revenueGrowth: number;
  netIncomeGrowth: number;
  epsGrowth: number;
  freeCashFlowGrowth: number;
}

export interface FMPEarnings {
  date: string;
  epsActual: number | null;
  epsEstimated: number | null;
  revenueActual?: number | null;
  revenueEstimated?: number | null;
}

export interface FMPSectorPerformance {
  sector: string;
  changesPercentage: number;
}

export interface CandidateTicker {
  ticker: string;
  companyName: string;
  marketCap: number;
  sector: string;
  industry: string;
  agiAlignmentScore: number;
  screeningNotes: string;
  screenType: string;
}
