import { useState } from "react";
import {
  LayoutGrid, TrendingUp, Search, Star, RefreshCw,
  BookOpenCheck, ScrollText, Settings, Plus,
  ArrowRightLeft, LogOut, BookOpen, ChevronDown,
  Trash2, FolderPlus,
} from "lucide-react";
import { usePortfolios, useCreatePortfolio, useDeletePortfolio } from "@/hooks/use-portfolio";
import { useToast } from "@/hooks/use-toast";
import { logout } from "@/lib/auth";

type TabId = "PORTFOLIO" | "MARKET" | "SCREENER" | "MAPO" | "REBALANCE" | "JOURNAL" | "TRADES" | "SETTINGS";

interface NavRailProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  activePortfolioId: string;
  onSelectPortfolio: (id: string) => void;
  onAddPosition: () => void;
  onLogTrade: () => void;
  onBriefing: () => void;
}

const NAV_ITEMS: { id: TabId; icon: React.ElementType; label: string; shortcut: string }[] = [
  { id: "PORTFOLIO",  icon: LayoutGrid,    label: "Portfolio",   shortcut: "1" },
  { id: "MARKET",     icon: TrendingUp,    label: "Market",      shortcut: "2" },
  { id: "SCREENER",   icon: Search,        label: "Screener",    shortcut: "3" },
  { id: "MAPO",       icon: Star,          label: "MAPO Score",  shortcut: "4" },
  { id: "REBALANCE",  icon: RefreshCw,     label: "Rebalance",   shortcut: "5" },
  { id: "TRADES",     icon: ScrollText,    label: "Trade Log",   shortcut: "6" },
  { id: "JOURNAL",    icon: BookOpenCheck, label: "Journal",     shortcut: "7" },
  { id: "SETTINGS",   icon: Settings,      label: "Settings",    shortcut: "S" },
];

export function NavRail({
  activeTab, onTabChange,
  activePortfolioId, onSelectPortfolio,
  onAddPosition, onLogTrade, onBriefing,
}: NavRailProps) {
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: portfolios } = usePortfolios();
  const createPortfolio = useCreatePortfolio();
  const deletePortfolio = useDeletePortfolio();
  const { toast } = useToast();

  const activePortfolio = portfolios?.find(p => p.id === activePortfolioId);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createPortfolio.mutate(
      { name: newName.trim(), type: "custom" },
      {
        onSuccess: (p: any) => {
          setNewName("");
          setShowNewForm(false);
          onSelectPortfolio(p.id);
          toast({ title: "Portfolio created" });
        },
      }
    );
  }

  return (
    <div style={{
      width: 44,
      minWidth: 44,
      height: "100%",
      background: "#060A11",
      borderRight: "1px solid #0F1825",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      paddingTop: 6,
      paddingBottom: 8,
      position: "relative",
      zIndex: 20,
      flexShrink: 0,
    }}>

      {/* Nav items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, width: "100%" }}>
        {NAV_ITEMS.map(({ id, icon: Icon, label, shortcut }) => {
          const active = activeTab === id;
          return (
            <Tip key={id} label={`${label}  [${shortcut}]`}>
              <button
                onClick={() => onTabChange(id)}
                style={{
                  width: "100%",
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: active ? "rgba(var(--color-primary-rgb, 212,168,83), 0.08)" : "transparent",
                  border: "none",
                  borderLeft: active ? "2px solid var(--color-primary, #D4A853)" : "2px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.12s",
                  color: active ? "var(--color-primary, #D4A853)" : "#3A4A5C",
                  position: "relative",
                }}
                onMouseEnter={e => {
                  if (!active) e.currentTarget.style.color = "#6A7A8E";
                }}
                onMouseLeave={e => {
                  if (!active) e.currentTarget.style.color = "#3A4A5C";
                }}
              >
                <Icon size={14} strokeWidth={active ? 2.2 : 1.8} />
              </button>
            </Tip>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ width: 24, height: 1, background: "#0F1825", margin: "4px 0", flexShrink: 0 }} />

      {/* Action buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", flexShrink: 0 }}>
        <Tip label="Add Position  [A]">
          <button onClick={onAddPosition} style={actionBtnStyle} onMouseEnter={e => { e.currentTarget.style.color = "var(--color-green, #00E6A8)"; e.currentTarget.style.background = "rgba(0,230,168,0.06)"; }} onMouseLeave={e => { e.currentTarget.style.color = "#3A4A5C"; e.currentTarget.style.background = "transparent"; }}>
            <Plus size={13} strokeWidth={2} />
          </button>
        </Tip>
        <Tip label="Log Trade  [T]">
          <button onClick={onLogTrade} style={actionBtnStyle} onMouseEnter={e => { e.currentTarget.style.color = "var(--color-primary, #D4A853)"; e.currentTarget.style.background = "var(--color-primary-a06)"; }} onMouseLeave={e => { e.currentTarget.style.color = "#3A4A5C"; e.currentTarget.style.background = "transparent"; }}>
            <ArrowRightLeft size={13} strokeWidth={1.8} />
          </button>
        </Tip>
        <Tip label="Morning Briefing  [B]">
          <button onClick={onBriefing} style={actionBtnStyle} onMouseEnter={e => { e.currentTarget.style.color = "#6A7A8E"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }} onMouseLeave={e => { e.currentTarget.style.color = "#3A4A5C"; e.currentTarget.style.background = "transparent"; }}>
            <BookOpen size={13} strokeWidth={1.8} />
          </button>
        </Tip>
      </div>

      {/* Divider */}
      <div style={{ width: 24, height: 1, background: "#0F1825", margin: "4px 0", flexShrink: 0 }} />

      {/* Portfolio picker */}
      <div style={{ position: "relative", width: "100%", flexShrink: 0 }}>
        <Tip label={`Portfolio: ${activePortfolio?.name ?? "—"}`}>
          <button
            onClick={() => setPortfolioOpen(o => !o)}
            style={{
              ...actionBtnStyle,
              color: portfolioOpen ? "var(--color-primary, #D4A853)" : "#3A4A5C",
              background: portfolioOpen ? "var(--color-primary-a06)" : "transparent",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--color-primary, #D4A853)"; }}
            onMouseLeave={e => { if (!portfolioOpen) e.currentTarget.style.color = "#3A4A5C"; }}
          >
            <LayoutGrid size={13} strokeWidth={1.8} />
            <ChevronDown size={8} style={{ position: "absolute", bottom: 5, right: 8, opacity: 0.5 }} />
          </button>
        </Tip>

        {/* Portfolio dropdown — pops to the right */}
        {portfolioOpen && (
          <div style={{
            position: "fixed",
            left: 44,
            bottom: 48,
            width: 220,
            background: "#080C14",
            border: "1px solid #1C2840",
            borderRadius: 4,
            zIndex: 100,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            padding: "6px 0",
          }}>
            <div style={{ fontSize: 8, color: "#2E3E52", letterSpacing: 1.5, textTransform: "uppercase", padding: "4px 12px 8px" }}>
              Portfolios
            </div>
            {(portfolios ?? []).map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => { onSelectPortfolio(p.id); setPortfolioOpen(false); }}
                  style={{
                    flex: 1,
                    padding: "7px 12px",
                    background: p.id === activePortfolioId ? "var(--color-primary-a06)" : "transparent",
                    border: "none",
                    borderLeft: `2px solid ${p.id === activePortfolioId ? "var(--color-primary, #D4A853)" : "transparent"}`,
                    color: p.id === activePortfolioId ? "var(--color-primary, #D4A853)" : "#8B949E",
                    fontSize: 11,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontWeight: p.id === activePortfolioId ? 700 : 400,
                    transition: "all 0.1s",
                  }}
                  onMouseEnter={e => { if (p.id !== activePortfolioId) e.currentTarget.style.color = "#C9D1D9"; }}
                  onMouseLeave={e => { if (p.id !== activePortfolioId) e.currentTarget.style.color = "#8B949E"; }}
                >
                  {p.name}
                </button>
                {confirmDelete === p.id ? (
                  <div style={{ display: "flex", gap: 4, paddingRight: 8 }}>
                    <button onClick={() => { deletePortfolio.mutate(p.id); setConfirmDelete(null); setPortfolioOpen(false); }} style={{ fontSize: 9, color: "var(--color-red)", background: "none", border: "none", cursor: "pointer" }}>Del</button>
                    <button onClick={() => setConfirmDelete(null)} style={{ fontSize: 9, color: "#4A5A6E", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(p.id)} style={{ padding: "4px 8px", background: "none", border: "none", color: "#2E3E52", cursor: "pointer", opacity: 0.6, transition: "all 0.1s" }} onMouseEnter={e => { e.currentTarget.style.color = "var(--color-red)"; e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.color = "#2E3E52"; e.currentTarget.style.opacity = "0.6"; }}>
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            ))}

            {/* New portfolio form */}
            {showNewForm ? (
              <form onSubmit={handleCreate} style={{ padding: "8px 12px", borderTop: "1px solid #1C2840", marginTop: 4 }}>
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Portfolio name..."
                  style={{
                    width: "100%",
                    background: "#0B0F1A",
                    border: "1px solid #1C2840",
                    borderRadius: 3,
                    color: "#C9D1D9",
                    fontSize: 11,
                    padding: "5px 8px",
                    outline: "none",
                    fontFamily: "'Inter', system-ui, sans-serif",
                    boxSizing: "border-box",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "var(--color-primary, #D4A853)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#1C2840"; }}
                />
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button type="submit" style={{ flex: 1, padding: "4px", fontSize: 9, fontWeight: 700, background: "var(--color-primary-a10)", border: "1px solid var(--color-primary-a20)", borderRadius: 3, color: "var(--color-primary, #D4A853)", cursor: "pointer", fontFamily: "'Inter', system-ui" }}>Create</button>
                  <button type="button" onClick={() => setShowNewForm(false)} style={{ padding: "4px 8px", fontSize: 9, background: "none", border: "1px solid #1C2840", borderRadius: 3, color: "#4A5A6E", cursor: "pointer" }}>Cancel</button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowNewForm(true)}
                style={{ width: "100%", padding: "7px 12px", background: "none", border: "none", borderTop: "1px solid #0F1825", color: "#3A4A5C", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "'Inter', system-ui", marginTop: 4, transition: "color 0.1s" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#6A7A8E"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#3A4A5C"; }}
              >
                <FolderPlus size={11} /> New Portfolio
              </button>
            )}
          </div>
        )}
      </div>

      {/* Logout */}
      <Tip label="Logout">
        <button
          onClick={() => { logout(); window.location.reload(); }}
          style={{ ...actionBtnStyle, marginTop: 2 }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--color-red)"; e.currentTarget.style.background = "rgba(255,68,88,0.06)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#3A4A5C"; e.currentTarget.style.background = "transparent"; }}
        >
          <LogOut size={13} strokeWidth={1.8} />
        </button>
      </Tip>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  width: "100%",
  height: 34,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  borderLeft: "2px solid transparent",
  cursor: "pointer",
  transition: "all 0.12s",
  color: "#3A4A5C",
  position: "relative",
};

// Tooltip wrapper
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div
      style={{ position: "relative", width: "100%" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: "fixed",
          left: 50,
          transform: "translateY(-50%)",
          background: "#080C14",
          border: "1px solid #1C2840",
          borderRadius: 3,
          padding: "4px 9px",
          fontSize: 10,
          color: "#C9D1D9",
          whiteSpace: "nowrap",
          zIndex: 200,
          pointerEvents: "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          fontFamily: "'Inter', system-ui, sans-serif",
          letterSpacing: 0.3,
        }}>
          {label}
        </div>
      )}
    </div>
  );
}
