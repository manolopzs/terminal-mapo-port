import { useState } from "react";
import { useLocation } from "wouter";
import { T } from "@/styles/tokens";
import { DataCard } from "@/components/terminal/DataCard";
import { Badge } from "@/components/terminal/Badge";
import { EmptyState } from "@/components/terminal/EmptyState";
import { LoadingState } from "@/components/terminal/LoadingState";

interface Candidate {
  ticker: string;
  companyName?: string;
  name?: string;
  score: number;
  rating?: string;
  sector?: string;
  marketCap?: number;
  agiAlignment?: number;
  source?: string;
  quantSignals?: { compositeCount: number };
  price?: number;
}

type SortDir = "asc" | "desc";
type SortCol = "rank" | "ticker" | "company" | "marketCap" | "score" | "rating" | "signals" | "sector" | "source";

const AGI_SOURCES = new Set(["CS", "PA", "SS", "DA"]);
const BROAD_SOURCES = new Set(["SR", "GS", "MM"]);

const AGENT_ABBREV: Record<string, string> = {
  "compute-scout": "CS",
  "power-analyst": "PA",
  "semi-specialist": "SS",
  "defense-analyst": "DA",
  "sector-rotation": "SR",
  "growth-scout": "GS",
  "macro-momentum": "MM",
};

const COL_LABELS: Record<SortCol, string> = {
  rank: "RANK",
  ticker: "TICKER",
  company: "COMPANY",
  marketCap: "MKT CAP",
  score: "SCORE",
  rating: "RATING",
  signals: "SIGNALS",
  sector: "SECTOR",
  source: "SOURCE",
};

const COLS: SortCol[] = ["rank", "ticker", "company", "marketCap", "score", "rating", "signals", "sector", "source"];

function abbreviateAgent(source?: string): string {
  if (!source) return "--";
  return AGENT_ABBREV[source] ?? source.slice(0, 2).toUpperCase();
}

function formatMarketCap(val?: number): string {
  if (!val) return "--";
  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(0)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toFixed(0)}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return T.green;
  if (score >= 65) return T.blue;
  if (score >= 50) return T.amber;
  return T.red;
}

function ratingColor(rating?: string): string {
  if (!rating) return T.dim;
  const r = rating.toUpperCase();
  if (r === "STRONG_BUY" || r === "STRONG BUY") return T.green;
  if (r === "BUY") return T.blue;
  if (r === "HOLD") return T.amber;
  return T.red;
}

export function ScreenPage() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterAGI, setFilterAGI] = useState(true);
  const [filterBroad, setFilterBroad] = useState(true);
  const [sortCol, setSortCol] = useState<SortCol>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [progressWidth, setProgressWidth] = useState(0);
  const [, navigate] = useLocation();

  const runScreen = async () => {
    setRunning(true);
    setResults(null);
    setError(null);
    setProgressWidth(0);
    requestAnimationFrame(() => {
      setTimeout(() => setProgressWidth(95), 50);
    });

    try {
      const res = await fetch("/api/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engines: { agi: filterAGI, broad: filterBroad } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResults(data.candidates ?? data.results ?? data ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
      setProgressWidth(0);
    }
  };

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const getRows = (): (Candidate & { _abbrev: string })[] => {
    if (!results) return [];

    let rows = results.map(r => ({ ...r, _abbrev: abbreviateAgent(r.source) }));

    rows = rows.filter(r => {
      const abbr = r._abbrev;
      const isAGI = AGI_SOURCES.has(abbr);
      const isBroad = BROAD_SOURCES.has(abbr);
      if (isAGI && filterAGI) return true;
      if (isBroad && filterBroad) return true;
      if (!isAGI && !isBroad) return filterAGI || filterBroad;
      return false;
    });

    rows.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      switch (sortCol) {
        case "rank":
        case "score":
          av = a.score; bv = b.score; break;
        case "ticker":
          av = a.ticker; bv = b.ticker; break;
        case "company":
          av = a.companyName ?? a.name ?? "";
          bv = b.companyName ?? b.name ?? "";
          break;
        case "marketCap":
          av = a.marketCap ?? 0; bv = b.marketCap ?? 0; break;
        case "rating":
          av = a.rating ?? ""; bv = b.rating ?? ""; break;
        case "signals":
          av = a.quantSignals?.compositeCount ?? -1;
          bv = b.quantSignals?.compositeCount ?? -1;
          break;
        case "sector":
          av = a.sector ?? ""; bv = b.sector ?? ""; break;
        case "source":
          av = a._abbrev; bv = b._abbrev; break;
        default:
          av = 0; bv = 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  };

  const rows = getRows();
  const count = rows.length;
  const maxScore = rows.length ? Math.max(...rows.map(r => r.score)) : 0;
  const avgScore = rows.length ? rows.reduce((s, r) => s + r.score, 0) / rows.length : 0;

  return (
    <div style={{ animation: "fadeSlideIn 200ms ease forwards" }}>
      {/* Controls */}
      <DataCard>
        <div style={{ padding: 16, marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <button
              onClick={runScreen}
              disabled={running}
              style={{
                background: running ? T.muted : T.green,
                color: T.bg,
                fontFamily: T.font.mono,
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: "12px 24px",
                borderRadius: 4,
                border: "none",
                cursor: running ? "not-allowed" : "pointer",
                opacity: running ? 0.6 : 1,
                transition: "opacity 150ms",
              }}
            >
              {running ? "RUNNING..." : "RUN FULL SCREEN"}
            </button>

            <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center" }}>
              <span style={{
                fontFamily: T.font.mono,
                fontSize: 9,
                color: T.muted,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginRight: 4,
              }}>
                ENGINES:
              </span>
              <span onClick={() => setFilterAGI(v => !v)} style={{ cursor: "pointer" }}>
                <Badge color={T.purple} filled={filterAGI}>AGI ENGINE</Badge>
              </span>
              <span onClick={() => setFilterBroad(v => !v)} style={{ cursor: "pointer" }}>
                <Badge color={filterBroad ? T.blue : T.muted} filled={filterBroad}>BROAD MARKET</Badge>
              </span>
            </div>
          </div>

          {running && (
            <div style={{ marginTop: 12 }}>
              <div
                className="animate-pulse"
                style={{
                  fontFamily: T.font.mono,
                  fontSize: 11,
                  color: T.amber,
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                SCREENING ~8,000 TICKERS... THIS TAKES 30-60 SECONDS
              </div>
              <div style={{ height: 2, background: T.border, borderRadius: 1, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    background: T.amber,
                    width: `${progressWidth}%`,
                    transition: "width 45s linear",
                    borderRadius: 1,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </DataCard>

      <div style={{ marginBottom: 12 }} />

      {/* Error */}
      {error && (
        <DataCard accent={T.red}>
          <div style={{ padding: 16 }}>
            <div style={{ fontFamily: T.font.mono, fontSize: 12, color: T.red, marginBottom: 12 }}>
              {error}
            </div>
            <button
              onClick={runScreen}
              style={{
                background: "transparent",
                border: `1px solid ${T.red}`,
                color: T.red,
                fontFamily: T.font.mono,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: "6px 12px",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              RETRY
            </button>
          </div>
        </DataCard>
      )}

      {/* Empty initial state */}
      {!results && !error && !running && (
        <EmptyState message="Run a screen to discover opportunities." />
      )}

      {/* Results */}
      {results && (
        <>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.dim,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 8,
          }}>
            {count} CANDIDATES SCORED&nbsp;&nbsp;|&nbsp;&nbsp;TOP SCORE: {maxScore}&nbsp;&nbsp;|&nbsp;&nbsp;AVG SCORE: {avgScore.toFixed(0)}
          </div>

          <DataCard>
            <div style={{ overflowX: "auto" }}>
              {/* Header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "44px 72px 140px 80px 64px 96px 64px 96px 56px",
                background: T.surfaceAlt,
                padding: "8px 16px",
                borderBottom: `1px solid ${T.border}`,
                minWidth: 720,
              }}>
                {COLS.map(col => (
                  <div
                    key={col}
                    onClick={() => handleSort(col)}
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: 9,
                      color: sortCol === col ? T.white : T.muted,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      cursor: "pointer",
                      userSelect: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    {COL_LABELS[col]}
                    {sortCol === col && (
                      <span style={{ fontSize: 7, lineHeight: 1 }}>{sortDir === "asc" ? "▲" : "▼"}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {rows.length === 0 && <LoadingState rows={5} />}
              {rows.map((candidate, i) => {
                const rank = i + 1;
                const isTopFive = rank <= 5;
                const abbr = candidate._abbrev;
                const company = candidate.companyName ?? candidate.name ?? "";
                const rating = candidate.rating?.toUpperCase().replace(/_/g, " ");
                const rColor = ratingColor(candidate.rating);

                return (
                  <div
                    key={`${candidate.ticker}-${i}`}
                    onClick={() => navigate(`/analyze?ticker=${candidate.ticker}`)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "44px 72px 140px 80px 64px 96px 64px 96px 56px",
                      padding: "10px 16px",
                      borderBottom: `1px solid ${T.border}`,
                      cursor: "pointer",
                      background: "transparent",
                      minWidth: 720,
                      transition: "background 100ms",
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = T.surfaceAlt}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
                  >
                    <div style={{
                      fontFamily: T.font.mono,
                      fontSize: 12,
                      color: isTopFive ? T.gold : T.dim,
                      fontWeight: isTopFive ? 700 : 400,
                      display: "flex",
                      alignItems: "center",
                    }}>
                      {rank}
                    </div>

                    <div style={{
                      fontFamily: T.font.mono,
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      color: T.white,
                      textTransform: "uppercase",
                      display: "flex",
                      alignItems: "center",
                    }}>
                      {candidate.ticker}
                    </div>

                    <div style={{
                      fontFamily: T.font.sans,
                      fontSize: 12,
                      color: T.dim,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                    }}>
                      {company}
                    </div>

                    <div style={{
                      fontFamily: T.font.mono,
                      fontSize: 11,
                      color: T.dim,
                      display: "flex",
                      alignItems: "center",
                    }}>
                      {formatMarketCap(candidate.marketCap)}
                    </div>

                    <div style={{
                      fontFamily: T.font.mono,
                      fontSize: 14,
                      fontWeight: 700,
                      color: scoreColor(candidate.score),
                      display: "flex",
                      alignItems: "center",
                    }}>
                      {candidate.score}
                    </div>

                    <div style={{ display: "flex", alignItems: "center" }}>
                      {rating ? (
                        <Badge color={rColor} filled>{rating}</Badge>
                      ) : (
                        <span style={{ fontFamily: T.font.mono, fontSize: 11, color: T.muted }}>--</span>
                      )}
                    </div>

                    <div style={{
                      fontFamily: T.font.mono,
                      fontSize: 11,
                      color: T.dim,
                      display: "flex",
                      alignItems: "center",
                    }}>
                      {candidate.quantSignals ? `${candidate.quantSignals.compositeCount}/7` : "--"}
                    </div>

                    <div style={{ display: "flex", alignItems: "center" }}>
                      {candidate.sector ? (
                        <Badge color={T.cyan}>{candidate.sector}</Badge>
                      ) : (
                        <span style={{ fontFamily: T.font.mono, fontSize: 11, color: T.muted }}>--</span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center" }}>
                      {abbr !== "--" ? (
                        <Badge color={T.muted}>{abbr}</Badge>
                      ) : (
                        <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.muted }}>--</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </DataCard>
        </>
      )}
    </div>
  );
}
