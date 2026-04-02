import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const schema = `
CREATE TABLE IF NOT EXISTS portfolios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_meta (
  portfolio_id TEXT PRIMARY KEY REFERENCES portfolios(id) ON DELETE CASCADE,
  cash DECIMAL(12,2) NOT NULL DEFAULT 0,
  starting_capital DECIMAL(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  quantity DECIMAL(12,4) NOT NULL DEFAULT 0,
  cost_basis DECIMAL(12,2) NOT NULL DEFAULT 0,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  value DECIMAL(12,2) NOT NULL DEFAULT 0,
  day_change DECIMAL(12,2),
  day_change_pct DECIMAL(8,4),
  gain_loss DECIMAL(12,2),
  gain_loss_pct DECIMAL(8,4),
  type TEXT NOT NULL DEFAULT 'Stock',
  sector TEXT NOT NULL DEFAULT 'Other',
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  action TEXT NOT NULL,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  shares DECIMAL(12,4) NOT NULL DEFAULT 0,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  pnl DECIMAL(12,2),
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS score_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ticker TEXT NOT NULL,
  score_date TEXT NOT NULL,
  composite_score INTEGER NOT NULL,
  financial_health INTEGER,
  valuation INTEGER,
  growth INTEGER,
  technical INTEGER,
  sentiment INTEGER,
  macro_fit INTEGER,
  quant_signals JSONB,
  rating TEXT,
  thesis TEXT,
  risks JSONB,
  catalysts JSONB,
  factor_notes JSONB,
  agi_alignment TEXT,
  data_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cooldown_list (
  ticker TEXT PRIMARY KEY,
  exit_date TEXT NOT NULL,
  cooldown_until TEXT NOT NULL,
  exit_reason TEXT
);
`;

async function setup() {
  console.log("Testing Supabase connection...");

  const { data, error } = await supabase.from("portfolios").select("id").limit(1);
  if (error && error.code === "42P01") {
    console.log("\nTables don't exist yet. Please run this SQL in your Supabase SQL Editor:");
    console.log("https://supabase.com/dashboard/project/lmatoflspyjibxoahdff/sql/new");
    console.log("\n--- SQL TO RUN ---");
    console.log(schema);
    console.log("--- END SQL ---\n");
  } else if (error) {
    console.error("Connection error:", error.message);
    console.log("\nIf this is a table-not-found error, run the SQL below at:");
    console.log("https://supabase.com/dashboard/project/lmatoflspyjibxoahdff/sql/new");
    console.log("\n--- SQL TO RUN ---");
    console.log(schema);
    console.log("--- END SQL ---\n");
  } else {
    console.log("Connected to Supabase! Tables are accessible.");
    console.log("portfolios rows found:", (data ?? []).length);
  }
}

setup();
