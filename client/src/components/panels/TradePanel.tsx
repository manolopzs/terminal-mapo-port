import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { T } from "@/styles/tokens";

interface TradePanelProps {
  open: boolean;
  onClose: () => void;
  initialTicker?: string;
  initialAction?: "BUY" | "SELL" | "TRIM";
  initialPrice?: number;
}

type TradeAction = "BUY" | "SELL" | "TRIM";

const ACTION_COLORS: Record<TradeAction, string> = {
  BUY: T.green,
  SELL: T.red,
  TRIM: T.amber,
};

const inputStyle: React.CSSProperties = {
  fontFamily: T.font.mono,
  background: T.surfaceAlt,
  border: `1px solid ${T.border}`,
  color: T.white,
  padding: "8px 12px",
  borderRadius: 4,
  outline: "none",
  width: "100%",
  fontSize: 14,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontFamily: T.font.mono,
  fontSize: 9,
  color: T.muted,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  display: "block",
  marginBottom: 6,
};

export function TradePanel({ open, onClose, initialTicker, initialAction, initialPrice }: TradePanelProps) {
  const [action, setAction] = useState<TradeAction>(initialAction ?? "BUY");
  const [ticker, setTicker] = useState(initialTicker ?? "");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState(initialPrice?.toFixed(2) ?? "");
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync props when they change
  useEffect(() => {
    if (initialTicker !== undefined) setTicker(initialTicker);
  }, [initialTicker]);

  useEffect(() => {
    if (initialAction !== undefined) setAction(initialAction);
  }, [initialAction]);

  useEffect(() => {
    if (initialPrice !== undefined) setPrice(initialPrice.toFixed(2));
  }, [initialPrice]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setResult(null);
      setError(null);
      setShares("");
      setRationale("");
    }
  }, [open]);

  const submit = async () => {
    if (!ticker || !shares || !price || !rationale) return;
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/portfolio/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ticker: ticker.toUpperCase(),
          shares: Number(shares),
          price: Number(price),
          rationale,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(`${action} ${shares} ${ticker.toUpperCase()} @ $${price} executed.`);
      setTimeout(() => onClose(), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const estimatedValue = shares && price ? Number(shares) * Number(price) : null;
  const isFormValid = ticker && shares && price && rationale;
  const actionColor = ACTION_COLORS[action];

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 49,
          }}
        />
      )}

      <div
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          height: "100vh",
          width: 400,
          background: T.surface,
          borderLeft: `1px solid ${T.border}`,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 250ms ease",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 20px 16px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}>
          <div style={{
            fontFamily: T.font.display,
            fontSize: 16,
            color: T.white,
            fontWeight: 600,
          }}>
            EXECUTE TRADE
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: T.dim,
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 4,
              transition: "color 120ms",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = T.white}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = T.dim}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
          {/* Action Selector */}
          <div>
            <div style={labelStyle}>ACTION</div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["BUY", "SELL", "TRIM"] as TradeAction[]).map(a => (
                <button
                  key={a}
                  onClick={() => setAction(a)}
                  style={{
                    background: action === a ? ACTION_COLORS[a] : "transparent",
                    border: `1px solid ${action === a ? ACTION_COLORS[a] : T.muted}`,
                    color: action === a ? T.bg : T.muted,
                    fontFamily: T.font.mono,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    padding: "6px 16px",
                    borderRadius: 4,
                    cursor: "pointer",
                    transition: "all 120ms",
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Ticker */}
          <div>
            <label style={labelStyle}>TICKER</label>
            <input
              type="text"
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              style={{
                ...inputStyle,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontWeight: 600,
              }}
              onFocus={e => (e.target as HTMLInputElement).style.borderColor = T.green}
              onBlur={e => (e.target as HTMLInputElement).style.borderColor = T.border}
            />
          </div>

          {/* Shares */}
          <div>
            <label style={labelStyle}>SHARES</label>
            <input
              type="number"
              value={shares}
              onChange={e => setShares(e.target.value)}
              placeholder="100"
              min="0"
              style={inputStyle}
              onFocus={e => (e.target as HTMLInputElement).style.borderColor = T.green}
              onBlur={e => (e.target as HTMLInputElement).style.borderColor = T.border}
            />
          </div>

          {/* Price */}
          <div>
            <label style={labelStyle}>PRICE ($)</label>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              style={inputStyle}
              onFocus={e => (e.target as HTMLInputElement).style.borderColor = T.green}
              onBlur={e => (e.target as HTMLInputElement).style.borderColor = T.border}
            />
          </div>

          {/* Estimated position value */}
          {action === "BUY" && estimatedValue !== null && estimatedValue > 0 && (
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 11,
              color: T.dim,
              letterSpacing: "0.06em",
              padding: "8px 12px",
              background: T.surfaceAlt,
              borderRadius: 4,
              border: `1px solid ${T.border}`,
            }}>
              EST. POSITION VALUE:{" "}
              <span style={{ color: T.white }}>
                ${estimatedValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          )}

          {/* Rationale */}
          <div>
            <label style={labelStyle}>RATIONALE</label>
            <textarea
              value={rationale}
              onChange={e => setRationale(e.target.value)}
              placeholder="Enter trade rationale..."
              rows={3}
              style={{
                ...inputStyle,
                fontFamily: T.font.sans,
                fontSize: 12,
                resize: "vertical",
                lineHeight: 1.6,
              }}
              onFocus={e => (e.target as HTMLTextAreaElement).style.borderColor = T.green}
              onBlur={e => (e.target as HTMLTextAreaElement).style.borderColor = T.border}
            />
          </div>

          {/* Submit */}
          <button
            onClick={submit}
            disabled={submitting || !isFormValid}
            style={{
              background: !isFormValid ? T.muted : actionColor,
              color: T.bg,
              fontFamily: T.font.mono,
              fontSize: 13,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "14px 0",
              borderRadius: 4,
              border: "none",
              cursor: !isFormValid || submitting ? "not-allowed" : "pointer",
              opacity: !isFormValid || submitting ? 0.7 : 1,
              width: "100%",
              transition: "opacity 150ms",
            }}
          >
            {submitting ? "EXECUTING..." : "EXECUTE"}
          </button>

          {/* Success */}
          {result && (
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 12,
              color: T.green,
              letterSpacing: "0.04em",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span>✓</span>
              <span>{result}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 12,
              color: T.red,
              letterSpacing: "0.04em",
            }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
