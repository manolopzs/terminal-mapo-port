import { useState, useEffect, useMemo } from "react";

interface JournalEntry {
  id: string;
  date: string;           // YYYY-MM-DD
  ticker: string;         // uppercase
  action: "BUY" | "SELL" | "WATCH" | "AVOID";
  conviction: 1 | 2 | 3 | 4 | 5;
  thesis: string;
  mapoScore: number | null;
  outcome: "PENDING" | "WIN" | "LOSS" | "NEUTRAL";
  actualReturn: number | null;
  createdAt: string;      // ISO datetime
}

const STORAGE_KEY = "mapo_journal";

function genId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString();
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadEntries(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as JournalEntry[]) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: JournalEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

const CONVICTION_DOTS = (n: number) =>
  Array.from({ length: 5 }, (_, i) => (
    <span key={i} style={{ color: i < n ? "var(--color-primary)" : "#1C2840", fontSize: 9, fontFamily: "monospace" }}>
      {i < n ? "●" : "○"}
    </span>
  ));

export function JournalTab() {
  const [entries, setEntries] = useState<JournalEntry[]>(() => loadEntries());
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterOutcome, setFilterOutcome] = useState<"ALL" | JournalEntry["outcome"]>("ALL");
  const [filterAction, setFilterAction] = useState<"ALL" | JournalEntry["action"]>("ALL");

  // New entry form state
  const [form, setForm] = useState({
    ticker: "",
    date: todayIso(),
    action: "BUY" as JournalEntry["action"],
    conviction: 3 as JournalEntry["conviction"],
    thesis: "",
    mapoScore: "",
    outcome: "PENDING" as JournalEntry["outcome"],
  });

  // Edit form state (per expanded entry)
  const [editOutcome, setEditOutcome] = useState<JournalEntry["outcome"]>("PENDING");
  const [editReturn, setEditReturn] = useState("");

  // Persist whenever entries change
  useEffect(() => {
    saveEntries(entries);
  }, [entries]);

  // When expanding an entry, seed edit fields
  function handleExpand(entry: JournalEntry) {
    if (expandedId === entry.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(entry.id);
    setEditOutcome(entry.outcome);
    setEditReturn(entry.actualReturn !== null ? String(entry.actualReturn) : "");
  }

  function handleFormChange(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    const newEntry: JournalEntry = {
      id: genId(),
      date: form.date,
      ticker: form.ticker.trim().toUpperCase(),
      action: form.action,
      conviction: form.conviction,
      thesis: form.thesis.trim(),
      mapoScore: form.mapoScore !== "" ? parseFloat(form.mapoScore) : null,
      outcome: form.outcome,
      actualReturn: null,
      createdAt: new Date().toISOString(),
    };
    setEntries((prev) => [newEntry, ...prev]);
    setShowForm(false);
    setForm({
      ticker: "",
      date: todayIso(),
      action: "BUY",
      conviction: 3,
      thesis: "",
      mapoScore: "",
      outcome: "PENDING",
    });
  }

  function handleSaveEdit(id: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              outcome: editOutcome,
              actualReturn: editReturn !== "" ? parseFloat(editReturn) : null,
            }
          : e
      )
    );
    setExpandedId(null);
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this journal entry?")) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  // Stats
  const stats = useMemo(() => {
    const wins = entries.filter((e) => e.outcome === "WIN");
    const losses = entries.filter((e) => e.outcome === "LOSS");
    const closed = wins.length + losses.length;
    const winRate = closed > 0 ? ((wins.length / closed) * 100).toFixed(0) : "—";
    const avgConvWin =
      wins.length > 0
        ? (wins.reduce((s, e) => s + e.conviction, 0) / wins.length).toFixed(1)
        : "—";
    const avgConvLoss =
      losses.length > 0
        ? (losses.reduce((s, e) => s + e.conviction, 0) / losses.length).toFixed(1)
        : "—";
    return { total: entries.length, winRate, avgConvWin, avgConvLoss };
  }, [entries]);

  // Filtered + sorted entries
  const filtered = useMemo(() => {
    return entries
      .filter((e) => filterOutcome === "ALL" || e.outcome === filterOutcome)
      .filter((e) => filterAction === "ALL" || e.action === filterAction)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [entries, filterOutcome, filterAction]);

  return (
    <div data-journal="root" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div
        data-journal="header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          borderBottom: "1px solid #1C2840",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#C9D1D9",
            fontFamily: "monospace",
          }}
        >
          Decision Journal
        </span>
        <button
          data-journal="btn-new-entry"
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: "5px 14px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            fontFamily: "monospace",
            background: showForm ? "var(--color-primary-a10)" : "transparent",
            border: "1px solid var(--color-primary-a30)",
            color: "var(--color-primary)",
            cursor: "pointer",
            borderRadius: 2,
          }}
        >
          {showForm ? "Cancel" : "+ New Entry"}
        </button>
      </div>

      {/* Stats bar */}
      <div
        data-journal="stats-bar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          padding: "8px 16px",
          borderBottom: "1px solid #1C2840",
          background: "#0B0F1A",
          flexShrink: 0,
          fontFamily: "monospace",
        }}
      >
        <StatItem label="Total Entries" value={String(stats.total)} />
        <span style={{ color: "#1C2840", margin: "0 14px", fontSize: 12 }}>|</span>
        <StatItem
          label="Win Rate"
          value={stats.winRate === "—" ? "—" : `${stats.winRate}%`}
          valueColor={
            stats.winRate === "—"
              ? "#C9D1D9"
              : parseInt(stats.winRate) > 50
              ? "var(--color-green)"
              : "var(--color-red)"
          }
        />
        <span style={{ color: "#1C2840", margin: "0 14px", fontSize: 12 }}>|</span>
        <StatItem label="Avg Conv (Wins)" value={stats.avgConvWin} />
        <span style={{ color: "#1C2840", margin: "0 14px", fontSize: 12 }}>|</span>
        <StatItem label="Avg Conv (Losses)" value={stats.avgConvLoss} />
      </div>

      {/* New Entry Form */}
      {showForm && (
        <form
          data-journal="new-entry-form"
          onSubmit={handleAddEntry}
          style={{
            background: "#0B0F1A",
            border: "1px solid #1C2840",
            borderRadius: 4,
            padding: 16,
            margin: "12px 16px",
            flexShrink: 0,
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <FieldGroup label="Ticker">
            <input
              required
              value={form.ticker}
              onChange={(e) => handleFormChange("ticker", e.target.value.toUpperCase())}
              placeholder="NVDA"
              maxLength={10}
              style={inputStyle}
            />
          </FieldGroup>

          <FieldGroup label="Date">
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => handleFormChange("date", e.target.value)}
              style={inputStyle}
            />
          </FieldGroup>

          <FieldGroup label="Action">
            <select
              value={form.action}
              onChange={(e) => handleFormChange("action", e.target.value)}
              style={inputStyle}
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
              <option value="WATCH">WATCH</option>
              <option value="AVOID">AVOID</option>
            </select>
          </FieldGroup>

          <FieldGroup label="Outcome">
            <select
              value={form.outcome}
              onChange={(e) => handleFormChange("outcome", e.target.value)}
              style={inputStyle}
            >
              <option value="PENDING">PENDING</option>
              <option value="WIN">WIN</option>
              <option value="LOSS">LOSS</option>
              <option value="NEUTRAL">NEUTRAL</option>
            </select>
          </FieldGroup>

          <FieldGroup label="MAPO Score (opt.)">
            <input
              type="number"
              min={0}
              max={100}
              value={form.mapoScore}
              onChange={(e) => handleFormChange("mapoScore", e.target.value)}
              placeholder="e.g. 74"
              style={{ ...inputStyle, width: 80 }}
            />
          </FieldGroup>

          <FieldGroup label="Conviction">
            <div style={{ display: "flex", gap: 4 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleFormChange("conviction", n)}
                  style={{
                    width: 28,
                    height: 28,
                    border: "1px solid",
                    borderColor: form.conviction >= n ? "var(--color-primary)" : "#1C2840",
                    background: form.conviction >= n ? "var(--color-primary-a15)" : "transparent",
                    color: form.conviction >= n ? "var(--color-primary)" : "#4A5A6E",
                    borderRadius: 2,
                    cursor: "pointer",
                    fontSize: 9,
                    fontFamily: "monospace",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </FieldGroup>

          <FieldGroup label="Thesis" style={{ flex: "0 0 100%" }}>
            <textarea
              required
              value={form.thesis}
              onChange={(e) => handleFormChange("thesis", e.target.value)}
              placeholder="Write your investment thesis..."
              rows={3}
              style={{
                ...inputStyle,
                width: "100%",
                resize: "vertical",
                minHeight: 80,
                fontFamily: "monospace",
              }}
            />
          </FieldGroup>

          <button
            type="submit"
            data-journal="btn-submit-entry"
            style={{
              padding: "6px 18px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              fontFamily: "monospace",
              background: "var(--color-primary)",
              border: "none",
              borderRadius: 2,
              color: "#070B14",
              cursor: "pointer",
            }}
          >
            Save Entry
          </button>
        </form>
      )}

      {/* Filter bar */}
      <div
        data-journal="filter-bar"
        style={{
          display: "flex",
          gap: 8,
          padding: "6px 16px",
          borderBottom: "1px solid #1C2840",
          background: "#070B14",
          flexShrink: 0,
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 9, color: "#4A5A6E", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "monospace" }}>
          Filter:
        </span>
        {(["ALL", "PENDING", "WIN", "LOSS", "NEUTRAL"] as const).map((o) => (
          <FilterChip
            key={o}
            label={o}
            active={filterOutcome === o}
            onClick={() => setFilterOutcome(o)}
          />
        ))}
        <span style={{ width: 1, background: "#1C2840", height: 16 }} />
        {(["ALL", "BUY", "SELL", "WATCH", "AVOID"] as const).map((a) => (
          <FilterChip
            key={a}
            label={a}
            active={filterAction === a}
            onClick={() => setFilterAction(a)}
          />
        ))}
      </div>

      {/* Entry list */}
      <div data-journal="entry-list" style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 && (
          <div
            style={{
              textAlign: "center",
              marginTop: 60,
              fontSize: 10,
              color: "#4A5A6E",
              fontFamily: "monospace",
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            No journal entries yet. Click "+ New Entry" to add one.
          </div>
        )}

        {filtered.map((entry) => {
          const isExpanded = expandedId === entry.id;
          return (
            <div key={entry.id} data-journal={`entry-${entry.id}`} style={{ borderBottom: "1px solid #0B0F1A" }}>
              {/* Entry row */}
              <div
                data-journal="entry-row"
                onClick={() => handleExpand(entry)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 16px",
                  cursor: "pointer",
                  background: isExpanded ? "rgba(212,168,83,0.03)" : "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = "rgba(212,168,83,0.02)"; }}
                onMouseLeave={(e) => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {/* Date */}
                <span style={{ fontSize: 9, color: "#4A5A6E", fontFamily: "monospace", flexShrink: 0, width: 80 }}>
                  {entry.date}
                </span>

                {/* Ticker */}
                <span style={{ fontSize: 11, fontWeight: 700, color: "#C9D1D9", fontFamily: "monospace", width: 60, flexShrink: 0 }}>
                  {entry.ticker}
                </span>

                {/* Action badge */}
                <ActionBadge action={entry.action} />

                {/* Conviction dots */}
                <span style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  {CONVICTION_DOTS(entry.conviction)}
                </span>

                {/* Thesis truncated */}
                <span
                  style={{
                    fontSize: 9,
                    color: "#8B949E",
                    fontFamily: "monospace",
                    fontStyle: "italic",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {entry.thesis.length > 100 ? entry.thesis.slice(0, 100) + "…" : entry.thesis}
                </span>

                {/* MAPO score */}
                {entry.mapoScore !== null && (
                  <span style={{ fontSize: 9, color: "var(--color-primary)", fontFamily: "monospace", flexShrink: 0 }}>
                    {entry.mapoScore}
                  </span>
                )}

                {/* Outcome badge */}
                <OutcomeBadge outcome={entry.outcome} />

                {/* Actual return */}
                {entry.actualReturn !== null && (
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: "monospace",
                      flexShrink: 0,
                      color: entry.actualReturn >= 0 ? "var(--color-green)" : "var(--color-red)",
                    }}
                  >
                    {entry.actualReturn >= 0 ? "+" : ""}{entry.actualReturn.toFixed(1)}%
                  </span>
                )}
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div
                  data-journal="entry-detail"
                  style={{
                    padding: "12px 14px 14px 20px",
                    background: "rgba(212,168,83,0.02)",
                    borderTop: "1px solid #1C2840",
                    borderLeft: "3px solid #1C2840",
                    marginLeft: 16,
                  }}
                >
                  {/* Full thesis */}
                  <div
                    style={{
                      fontSize: 10,
                      color: "#C9D1D9",
                      fontFamily: "monospace",
                      lineHeight: 1.7,
                      marginBottom: 14,
                      background: "#0B0F1A",
                      border: "1px solid #1C2840",
                      borderRadius: 3,
                      padding: "10px 12px",
                    }}
                  >
                    <span style={{ fontSize: 9, color: "#4A5A6E", letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Full Thesis
                    </span>
                    {entry.thesis}
                  </div>

                  {/* Edit form */}
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <FieldGroup label="Update Outcome">
                      <select
                        value={editOutcome}
                        onChange={(e) => setEditOutcome(e.target.value as JournalEntry["outcome"])}
                        style={inputStyle}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="WIN">WIN</option>
                        <option value="LOSS">LOSS</option>
                        <option value="NEUTRAL">NEUTRAL</option>
                      </select>
                    </FieldGroup>

                    <FieldGroup label="Actual Return (%)">
                      <input
                        type="number"
                        step="0.01"
                        value={editReturn}
                        onChange={(e) => setEditReturn(e.target.value)}
                        placeholder="e.g. 12.5"
                        style={{ ...inputStyle, width: 100 }}
                      />
                    </FieldGroup>

                    <button
                      data-journal="btn-save-edit"
                      onClick={() => handleSaveEdit(entry.id)}
                      style={{
                        padding: "5px 14px",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 1.2,
                        textTransform: "uppercase",
                        fontFamily: "monospace",
                        background: "transparent",
                        border: "1px solid rgba(0,200,83,0.4)",
                        color: "var(--color-green)",
                        borderRadius: 2,
                        cursor: "pointer",
                      }}
                    >
                      Save
                    </button>

                    <button
                      data-journal="btn-delete"
                      onClick={() => handleDelete(entry.id)}
                      style={{
                        padding: "5px 14px",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 1.2,
                        textTransform: "uppercase",
                        fontFamily: "monospace",
                        background: "transparent",
                        border: "1px solid rgba(255,77,77,0.3)",
                        color: "var(--color-red)",
                        borderRadius: 2,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Sub-components ----

const inputStyle: React.CSSProperties = {
  background: "#070B14",
  border: "1px solid #1C2840",
  borderRadius: 3,
  color: "#C9D1D9",
  fontFamily: "monospace",
  fontSize: 10,
  padding: "6px 10px",
  outline: "none",
};

function FieldGroup({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      <span
        style={{
          fontSize: 9,
          color: "#4A5A6E",
          letterSpacing: 1.5,
          textTransform: "uppercase",
          fontFamily: "monospace",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function StatItem({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 9, color: "#4A5A6E", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "monospace" }}>
        {label}
      </span>
      <span style={{ fontSize: 11, fontWeight: 700, color: valueColor ?? "#C9D1D9", fontFamily: "monospace" }}>
        {value}
      </span>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "2px 8px",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        fontFamily: "monospace",
        background: active ? "var(--color-primary-a10)" : "transparent",
        border: active ? "1px solid var(--color-primary-a35)" : "1px solid #1C2840",
        color: active ? "var(--color-primary)" : "#8B949E",
        borderRadius: 2,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function ActionBadge({ action }: { action: JournalEntry["action"] }) {
  const map = {
    BUY: { bg: "rgba(0,200,83,0.1)", border: "rgba(0,200,83,0.3)", color: "var(--color-green)" },
    SELL: { bg: "rgba(255,77,77,0.1)", border: "rgba(255,77,77,0.3)", color: "var(--color-red)" },
    WATCH: { bg: "var(--color-orange-a10)", border: "rgba(240,136,62,0.3)", color: "var(--color-orange)" },
    AVOID: { bg: "rgba(72,79,88,0.15)", border: "rgba(72,79,88,0.4)", color: "#4A5A6E" },
  };
  const s = map[action];
  return (
    <span
      style={{
        padding: "2px 7px",
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        borderRadius: 2,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        fontFamily: "monospace",
        flexShrink: 0,
      }}
    >
      {action}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: JournalEntry["outcome"] }) {
  const map = {
    PENDING: { bg: "rgba(139,148,158,0.1)", border: "rgba(139,148,158,0.2)", color: "#8B949E" },
    WIN: { bg: "rgba(0,200,83,0.1)", border: "rgba(0,200,83,0.3)", color: "var(--color-green)" },
    LOSS: { bg: "rgba(255,77,77,0.1)", border: "rgba(255,77,77,0.3)", color: "var(--color-red)" },
    NEUTRAL: { bg: "var(--color-orange-a10)", border: "rgba(240,136,62,0.3)", color: "var(--color-orange)" },
  };
  const s = map[outcome];
  return (
    <span
      style={{
        padding: "2px 7px",
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        borderRadius: 2,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        fontFamily: "monospace",
        flexShrink: 0,
      }}
    >
      {outcome}
    </span>
  );
}
