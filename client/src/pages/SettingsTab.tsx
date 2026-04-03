import { useEffect, useState } from "react";
import { PALETTES, getSavedPaletteId, applyPalette } from "@/lib/palette";

// ── API checks ────────────────────────────────────────────────────────────────
const API_CHECKS: { key: string; label: string; endpoint: string; hint: string }[] = [
  { key: "portfolio", label: "Portfolio DB", endpoint: "/api/portfolios", hint: "DATABASE_URL / Supabase" },
  { key: "finnhub", label: "Finnhub", endpoint: "/api/live/sentiment", hint: "FINNHUB_API_KEY" },
  { key: "fmp", label: "FMP (quotes)", endpoint: "/api/market/quotes?symbols=SPY", hint: "FMP_API_KEY" },
  { key: "pulse", label: "Market Pulse", endpoint: "/api/market/pulse", hint: "Finnhub composite" },
  { key: "performance", label: "Performance", endpoint: "/api/performance?portfolioId=test", hint: "FMP + AlphaVantage" },
  { key: "auth", label: "Auth", endpoint: "/api/login", hint: "AUTH_EMAIL / AUTH_PASS" },
  { key: "anthropic", label: "AI Analyst (Claude)", endpoint: "/api/ai/brief", hint: "ANTHROPIC_API_KEY" },
];

type Status = "checking" | "ok" | "error" | "warn";

interface CheckResult {
  status: Status;
  latencyMs: number | null;
  detail: string;
}

async function checkEndpoint(endpoint: string): Promise<CheckResult> {
  const start = Date.now();
  try {
    const isPost = endpoint === "/api/login";
    const res = await fetch(endpoint, {
      method: isPost ? "POST" : "GET",
      headers: isPost ? { "Content-Type": "application/json" } : {},
      body: isPost ? JSON.stringify({ email: "ping", password: "ping" }) : undefined,
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - start;
    // Auth endpoint returns 401 on wrong creds — that still means it's running
    if (res.ok || res.status === 401 || res.status === 400) {
      return { status: "ok", latencyMs, detail: `${res.status} · ${latencyMs}ms` };
    }
    return { status: "warn", latencyMs, detail: `${res.status} · ${latencyMs}ms` };
  } catch (e: any) {
    const latencyMs = Date.now() - start;
    if (e?.name === "TimeoutError") return { status: "error", latencyMs, detail: "Timeout >8s" };
    return { status: "error", latencyMs: null, detail: e?.message ?? "Failed" };
  }
}

const STATUS_COLOR: Record<Status, string> = {
  checking: "#3A4A5C",
  ok: "var(--color-green)",
  warn: "var(--color-orange)",
  error: "var(--color-red)",
};
const STATUS_LABEL: Record<Status, string> = {
  checking: "CHECKING",
  ok: "OK",
  warn: "WARN",
  error: "ERROR",
};

export function SettingsTab() {
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [running, setRunning] = useState(false);
  const [activePalette, setActivePalette] = useState(getSavedPaletteId);

  async function runChecks() {
    setRunning(true);
    setResults({});
    await Promise.all(
      API_CHECKS.map(async (check) => {
        const result = await checkEndpoint(check.endpoint);
        setResults(prev => ({ ...prev, [check.key]: result }));
      })
    );
    setRunning(false);
  }

  useEffect(() => { runChecks(); }, []);

  const okCount = Object.values(results).filter(r => r.status === "ok").length;
  const errorCount = Object.values(results).filter(r => r.status === "error").length;
  const warnCount = Object.values(results).filter(r => r.status === "warn").length;
  const total = API_CHECKS.length;

  return (
    <div style={{
      flex: 1,
      overflow: "auto",
      padding: "24px 32px",
      background: "#040810",
      display: "flex",
      flexDirection: "column",
      gap: 28,
    }}>

      {/* ── System Health ───────────────────────────────────────────────────── */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 9, color: "#3A4A5C", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
              System Health
            </div>
            <div style={{ fontSize: 11, color: "#4A5A6E" }}>
              {running
                ? "Running checks..."
                : `${okCount}/${total} services operational${errorCount > 0 ? ` · ${errorCount} error${errorCount > 1 ? "s" : ""}` : ""}${warnCount > 0 ? ` · ${warnCount} warn` : ""}`}
            </div>
          </div>
          <button
            onClick={runChecks}
            disabled={running}
            style={{
              padding: "5px 14px",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              background: "transparent",
              border: "1px solid #1C2840",
              borderRadius: 3,
              color: running ? "#3A4A5C" : "var(--color-primary)",
              cursor: running ? "default" : "pointer",
              transition: "border-color 0.15s, color 0.15s",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
            onMouseEnter={e => { if (!running) e.currentTarget.style.borderColor = "var(--color-primary)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1C2840"; }}
          >
            {running ? "Running..." : "Re-run Tests"}
          </button>
        </div>

        {/* Overall bar */}
        {!running && Object.keys(results).length > 0 && (
          <div style={{ height: 3, borderRadius: 2, overflow: "hidden", display: "flex", marginBottom: 16 }}>
            <div style={{ flex: okCount, background: "var(--color-green)", opacity: 0.8 }} />
            <div style={{ flex: warnCount, background: "var(--color-orange)", opacity: 0.8 }} />
            <div style={{ flex: errorCount, background: "var(--color-red)", opacity: 0.8 }} />
            <div style={{ flex: total - okCount - warnCount - errorCount, background: "#1C2840" }} />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {API_CHECKS.map(check => {
            const r = results[check.key];
            const status: Status = r?.status ?? "checking";
            const color = STATUS_COLOR[status];
            return (
              <div key={check.key} style={{
                padding: "10px 14px",
                background: "#080C14",
                border: `1px solid ${status === "ok" ? "var(--color-green-a08)" : status === "error" ? "var(--color-red-a10)" : status === "warn" ? "var(--color-orange-a10)" : "#1C2840"}`,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0,
                      boxShadow: status === "ok" ? `0 0 5px ${color}60` : "none",
                      animation: status === "checking" ? "pulse-dot 1.2s ease-in-out infinite" : "none",
                    }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#C9D1D9", fontFamily: "'Inter', system-ui, sans-serif" }}>
                      {check.label}
                    </span>
                    <span style={{ fontSize: 8, fontWeight: 700, color, letterSpacing: 1 }}>
                      {STATUS_LABEL[status]}
                    </span>
                  </div>
                  <div style={{ fontSize: 8, color: "#2E3E52", paddingLeft: 14 }}>{check.hint}</div>
                </div>
                {r?.latencyMs != null && (
                  <span className="font-mono tabular-nums" style={{
                    fontSize: 10, color: r.latencyMs < 500 ? "#3A5A6E" : r.latencyMs < 2000 ? "var(--color-primary)" : "var(--color-orange)",
                  }}>
                    {r.latencyMs}ms
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Color Palette ───────────────────────────────────────────────────── */}
      <section>
        <div style={{ fontSize: 9, color: "#3A4A5C", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
          Color Palette
        </div>
        <div style={{ fontSize: 11, color: "#4A5A6E", marginBottom: 14 }}>
          Visual identity — applied instantly across the terminal
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {PALETTES.map(p => {
            const active = activePalette === p.id;
            const primary = p.vars["--color-primary"];
            const green   = p.vars["--color-green"];
            const red     = p.vars["--color-red"];
            const orange  = p.vars["--color-orange"];
            return (
              <button
                key={p.id}
                onClick={() => { setActivePalette(p.id); applyPalette(p.id); }}
                style={{
                  padding: "12px 16px",
                  background: active ? `${primary}12` : "#080C14",
                  border: `1px solid ${active ? primary + "50" : "#1C2840"}`,
                  borderRadius: 4,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                  {[primary, green, red, orange].map((c, i) => (
                    <div key={i} style={{ width: 10, height: 28, borderRadius: 2, background: c, opacity: 0.9 }} />
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: active ? primary : "#8B949E", marginBottom: 2, fontFamily: "'Inter', system-ui, sans-serif" }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 9, color: "#3A4A5C" }}>{p.description}</div>
                </div>
                {active && (
                  <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: primary, flexShrink: 0, boxShadow: `0 0 6px ${primary}80` }} />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Build Info ──────────────────────────────────────────────────────── */}
      <section style={{ borderTop: "1px solid #0F1825", paddingTop: 20 }}>
        <div style={{ fontSize: 9, color: "#3A4A5C", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
          Build
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[
            { label: "Version", value: "1.0.0" },
            { label: "Stack", value: "React · Express · Drizzle · Supabase" },
            { label: "AI", value: "Claude claude-sonnet-4-6" },
            { label: "Data", value: "Finnhub · FMP · AlphaVantage" },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 8, color: "#2E3E52", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 10, color: "#5A6B80", fontFamily: "'Inter', system-ui, sans-serif" }}>{value}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
