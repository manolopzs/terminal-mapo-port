import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { T } from "@/styles/tokens";
import { Badge } from "@/components/terminal/Badge";
import { LoadingState } from "@/components/terminal/LoadingState";

interface BriefingPanelProps {
  open: boolean;
  onClose: () => void;
}

interface BriefingData {
  briefing?: string;
  macroRegime?: string;
  agiThesis?: string;
  [key: string]: any;
}

function regimeBadgeColor(regime?: string): string {
  if (!regime) return T.amber;
  const r = regime.toUpperCase();
  if (r.includes("RISK-ON") || r.includes("RISK_ON")) return T.green;
  if (r.includes("RISK-OFF") || r.includes("RISK_OFF")) return T.red;
  return T.amber;
}

function agiThesisBadgeColor(thesis?: string): string {
  if (!thesis) return T.blue;
  const t = thesis.toUpperCase();
  if (t.includes("ACCELERATING")) return T.purple;
  if (t.includes("STABLE")) return T.blue;
  return T.amber;
}

function formatBriefingLine(line: string, i: number) {
  if (line.startsWith("## ") || line.startsWith("# ")) {
    const text = line.replace(/^#+ /, "");
    return (
      <div key={i} style={{
        fontFamily: T.font.mono,
        fontSize: 13,
        color: T.white,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginTop: 16,
        marginBottom: 6,
        borderBottom: `1px solid ${T.border}`,
        paddingBottom: 6,
      }}>
        {text}
      </div>
    );
  }

  if (line.startsWith("**") && line.endsWith("**")) {
    const text = line.slice(2, -2);
    return (
      <div key={i} style={{
        fontFamily: T.font.mono,
        fontSize: 11,
        color: T.white,
        fontWeight: 700,
        lineHeight: 1.7,
        marginBottom: 2,
      }}>
        {text}
      </div>
    );
  }

  if (line.startsWith("- ") || line.startsWith("* ")) {
    const text = line.slice(2);
    return (
      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        <span style={{ color: T.muted, fontFamily: T.font.mono, fontSize: 11, flexShrink: 0, lineHeight: 1.7 }}>•</span>
        <span style={{ fontFamily: T.font.mono, fontSize: 11, color: T.dim, lineHeight: 1.7 }}>{text}</span>
      </div>
    );
  }

  if (line.trim() === "") {
    return <div key={i} style={{ height: 8 }} />;
  }

  return (
    <div key={i} style={{
      fontFamily: T.font.mono,
      fontSize: 11,
      color: T.dim,
      lineHeight: 1.7,
      marginBottom: 2,
    }}>
      {line}
    </div>
  );
}

export function BriefingPanel({ open, onClose }: BriefingPanelProps) {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [regime, setRegime] = useState<string | null>(null);
  const [agiStatus, setAgiStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setContent(null);
    setRegime(null);
    setAgiStatus(null);

    const fetchBriefing = async () => {
      try {
        const res = await fetch("/api/briefing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: BriefingData = await res.json();
        setContent(data.briefing ?? JSON.stringify(data, null, 2));
        setRegime(data.macroRegime ?? null);
        setAgiStatus(data.agiThesis ?? null);
      } catch (e: any) {
        setContent(`ERROR: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchBriefing();
  }, [open]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const lines = content ? content.split("\n") : [];

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
          width: 480,
          background: T.surface,
          borderLeft: `1px solid ${T.border}`,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 250ms ease",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 20px 16px",
          borderBottom: `1px solid ${T.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{
                fontFamily: T.font.display,
                fontSize: 16,
                color: T.white,
                fontWeight: 600,
                marginBottom: 4,
              }}>
                MORNING BRIEFING
              </div>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 10,
                color: T.dim,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}>
                {today}
              </div>
              {(regime || agiStatus) && (
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {regime && (
                    <Badge color={regimeBadgeColor(regime)} filled>{regime}</Badge>
                  )}
                  {agiStatus && (
                    <Badge color={agiThesisBadgeColor(agiStatus)} filled>{agiStatus}</Badge>
                  )}
                </div>
              )}
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
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {loading && <LoadingState rows={8} />}
          {!loading && content && (
            <div>{lines.map((line, i) => formatBriefingLine(line, i))}</div>
          )}
        </div>
      </div>
    </>
  );
}
