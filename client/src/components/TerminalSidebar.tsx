import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  FolderPlus,
  Briefcase,
  TrendingUp,
  Wallet,
  Bitcoin,
  LayoutGrid,
  Trash2,
  ArrowRightLeft,
} from "lucide-react";
// No "All Portfolios" — each portfolio is isolated
import { usePortfolios, useCreatePortfolio, useDeletePortfolio } from "@/hooks/use-portfolio";
import { useToast } from "@/hooks/use-toast";
import type { Portfolio } from "@shared/schema";

interface TerminalSidebarProps {
  activePortfolioId: string;
  onSelectPortfolio: (id: string) => void;
  onAddPosition: () => void;
  onLogTrade: () => void;
}

const PORTFOLIO_ICONS: Record<string, typeof Briefcase> = {
  brokerage: TrendingUp,
  retirement: Wallet,
  crypto: Bitcoin,
  custom: LayoutGrid,
};

export function TerminalSidebar({ activePortfolioId, onSelectPortfolio, onAddPosition, onLogTrade }: TerminalSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("brokerage");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [confirmInput, setConfirmInput] = useState("");

  const { data: portfolios } = usePortfolios();
  const createPortfolio = useCreatePortfolio();
  const deletePortfolio = useDeletePortfolio();
  const { toast } = useToast();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createPortfolio.mutate(
      { name: newName.trim(), type: newType },
      {
        onSuccess: () => {
          toast({ title: "Created", description: `${newName} portfolio created` });
          setNewName("");
          setShowNewForm(false);
        },
      }
    );
  }

  function openDeleteConfirm(id: string, name: string) {
    setConfirmDelete({ id, name });
    setConfirmInput("");
  }

  function cancelDelete() {
    setConfirmDelete(null);
    setConfirmInput("");
  }

  function handleDelete() {
    if (!confirmDelete || confirmInput.toLowerCase() !== "delete") return;
    deletePortfolio.mutate(confirmDelete.id, {
      onSuccess: () => {
        toast({ title: "Deleted", description: `${confirmDelete.name} removed` });
        if (activePortfolioId === confirmDelete.id) {
          const remaining = portfolios?.filter((p) => p.id !== confirmDelete.id);
          if (remaining && remaining.length > 0) onSelectPortfolio(remaining[0].id);
        }
        setConfirmDelete(null);
        setConfirmInput("");
      },
    });
  }

  const width = collapsed ? 42 : 208;

  return (
    <>
    <div
      className="flex flex-col flex-shrink-0"
      style={{
        width,
        minWidth: width,
        background: "#070B14",
        borderRight: "1px solid #1C2840",
        transition: "width 180ms ease, min-width 180ms ease",
        overflow: "hidden",
      }}
    >
      {/* Sidebar header */}
      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{
          height: 56,
          minHeight: 56,
          padding: collapsed ? "0 8px" : "0 12px",
          borderBottom: "1px solid #1C2840",
        }}
      >
        {!collapsed && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.8,
              color: "#4A5A6E",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            Portfolios
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: "none",
            border: "none",
            color: "#4A5A6E",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: collapsed ? "auto" : 0,
            marginRight: collapsed ? "auto" : 0,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#8B9AAB")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#4A5A6E")}
          data-testid="sidebar-toggle"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Ticker tape spacer — match the TickerTape height */}
      <div style={{ height: 24, minHeight: 24, borderBottom: "1px solid #1C2840", flexShrink: 0 }} />

      {/* Portfolio list */}
      <div className="flex-1 overflow-auto" style={{ padding: 0 }}>
        {portfolios?.map((p) => {
          const Icon = PORTFOLIO_ICONS[p.type] || Briefcase;
          const isActive = activePortfolioId === p.id;
          return (
            <div
              key={p.id}
              className="flex items-center"
              style={{
                padding: collapsed ? "8px 0" : "8px 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                background: isActive ? "rgba(0, 217, 255, 0.07)" : "transparent",
                borderBottom: "1px solid rgba(28, 40, 64, 0.6)",
                borderLeft: isActive ? "2px solid #00D9FF" : "2px solid transparent",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <button
                onClick={() => onSelectPortfolio(p.id)}
                className="flex items-center gap-2"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  flex: 1,
                  justifyContent: collapsed ? "center" : "flex-start",
                  padding: 0,
                  color: isActive ? "#00D9FF" : "#A0AABА",
                }}
                data-testid={`portfolio-${p.id}`}
              >
                <Icon size={collapsed ? 14 : 12} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
                {!collapsed && (
                  <div className="flex flex-col items-start" style={{ minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: isActive ? 700 : 500,
                        letterSpacing: 0.3,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 115,
                        display: "block",
                        color: isActive ? "#00D9FF" : "#9AAABB",
                      }}
                    >
                      {p.name}
                    </span>
                    <span
                      style={{
                        fontSize: 7,
                        color: "#3A4A5C",
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                        marginTop: 1,
                      }}
                    >
                      {p.type}
                    </span>
                  </div>
                )}
              </button>
              {!collapsed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openDeleteConfirm(p.id, p.name);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#8B949E",
                    padding: 2,
                    opacity: 0.5,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#FF4D4D"; e.currentTarget.style.opacity = "1"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#8B949E"; e.currentTarget.style.opacity = "0.5"; }}
                  data-testid={`delete-portfolio-${p.id}`}
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div
        className="flex-shrink-0"
        style={{
          borderTop: "1px solid #1C2840",
          padding: collapsed ? "7px 5px" : "7px 9px",
        }}
      >
        {/* New Portfolio */}
        {!collapsed && showNewForm ? (
          <form onSubmit={handleCreate} style={{ marginBottom: 4 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Portfolio name..."
              autoFocus
              style={{
                width: "100%",
                fontSize: 10,
                padding: "5px 8px",
                background: "#0B0F1A",
                border: "1px solid #1C2840",
                borderRadius: 3,
                color: "#C9D1D9",
                outline: "none",
                marginBottom: 4,
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              style={{
                width: "100%",
                fontSize: 10,
                padding: "4px 6px",
                background: "#0B0F1A",
                border: "1px solid #1C2840",
                borderRadius: 3,
                color: "#C9D1D9",
                outline: "none",
                marginBottom: 4,
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              <option value="brokerage">Brokerage</option>
              <option value="retirement">Retirement</option>
              <option value="crypto">Crypto</option>
              <option value="custom">Custom</option>
            </select>
            <div className="flex gap-1">
              <button
                type="submit"
                disabled={createPortfolio.isPending}
                style={{
                  flex: 1,
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "4px 0",
                  background: "#00D9FF",
                  color: "#040810",
                  border: "none",
                  borderRadius: 3,
                  cursor: "pointer",
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                {createPortfolio.isPending ? "..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewForm(false);
                  setNewName("");
                }}
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "4px 8px",
                  background: "#1C2840",
                  color: "#5A6B80",
                  border: "none",
                  borderRadius: 3,
                  cursor: "pointer",
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                ✕
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => (collapsed ? setCollapsed(false) : setShowNewForm(true))}
            className="flex items-center justify-center gap-1"
            style={{
              width: "100%",
              fontSize: 9,
              fontWeight: 600,
              padding: "5px 0",
              background: "#111828",
              color: "#5A6B80",
              border: "1px solid #1C2840",
              borderRadius: 3,
              cursor: "pointer",
              letterSpacing: 0.8,
              textTransform: "uppercase",
              marginBottom: 4,
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#1A2540"; e.currentTarget.style.color = "#8B9AAB"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#111828"; e.currentTarget.style.color = "#5A6B80"; }}
            data-testid="new-portfolio-btn"
          >
            <FolderPlus size={10} />
            {!collapsed && <span>New Portfolio</span>}
          </button>
        )}

        {/* Log Trade */}
        <button
          onClick={() => {
            if (collapsed) setCollapsed(false);
            onLogTrade();
          }}
          className="flex items-center justify-center gap-1"
          style={{
            width: "100%",
            fontSize: 9,
            fontWeight: 600,
            padding: "5px 0",
            background: "rgba(255, 68, 88, 0.07)",
            color: "#FF4458",
            border: "1px solid rgba(255, 68, 88, 0.18)",
            borderRadius: 3,
            cursor: "pointer",
            letterSpacing: 0.8,
            textTransform: "uppercase",
            marginBottom: 4,
            transition: "background 0.12s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 68, 88, 0.14)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 68, 88, 0.07)")}
          data-testid="log-trade-btn"
        >
          <ArrowRightLeft size={10} />
          {!collapsed && <span>Log Trade</span>}
        </button>

        {/* Add Position */}
        <button
          onClick={() => {
            if (collapsed) setCollapsed(false);
            onAddPosition();
          }}
          className="flex items-center justify-center gap-1"
          style={{
            width: "100%",
            fontSize: 9,
            fontWeight: 700,
            padding: "5px 0",
            background: "rgba(0, 217, 255, 0.09)",
            color: "#00D9FF",
            border: "1px solid rgba(0, 217, 255, 0.18)",
            borderRadius: 3,
            cursor: "pointer",
            letterSpacing: 0.8,
            textTransform: "uppercase",
            transition: "background 0.12s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0, 217, 255, 0.16)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0, 217, 255, 0.09)")}
          data-testid="add-position-btn"
        >
          <Plus size={10} />
          {!collapsed && <span>Add Position</span>}
        </button>
      </div>
    </div>

    {/* Delete confirmation modal */}

    {confirmDelete && (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(4,8,16,0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 999,
          backdropFilter: "blur(2px)",
        }}
        onClick={cancelDelete}
      >
        <div
          style={{
            background: "#0D1117",
            border: "1px solid #FF4D4D",
            borderRadius: 4,
            padding: 24,
            width: 340,
            boxShadow: "0 0 40px rgba(255,77,77,0.15)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Trash2 size={13} color="#FF4D4D" />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#FF4D4D", fontFamily: "monospace" }}>
              Delete Portfolio
            </span>
          </div>

          {/* Warning text */}
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: "#C9D1D9" }}>You are about to permanently delete </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#FF4D4D", fontFamily: "monospace" }}>"{confirmDelete.name}"</span>
            <span style={{ fontSize: 10, color: "#C9D1D9" }}>.</span>
          </div>
          <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 20, lineHeight: 1.6 }}>
            This will remove all holdings, trades, and chat history. This action cannot be undone.
          </div>

          {/* Type to confirm */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 8, color: "#8B949E", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 6 }}>
              Type <span style={{ color: "#FF4D4D" }}>delete</span> to confirm
            </label>
            <input
              autoFocus
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleDelete(); if (e.key === "Escape") cancelDelete(); }}
              placeholder="delete"
              style={{
                width: "100%",
                background: "#080C14",
                border: `1px solid ${confirmInput.toLowerCase() === "delete" ? "#FF4D4D" : "#1A2332"}`,
                borderRadius: 3,
                padding: "7px 10px",
                fontSize: 11,
                color: "#C9D1D9",
                fontFamily: "monospace",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={cancelDelete}
              style={{
                flex: 1,
                padding: "8px",
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                background: "transparent",
                border: "1px solid #1A2332",
                borderRadius: 3,
                color: "#8B949E",
                fontFamily: "monospace",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={confirmInput.toLowerCase() !== "delete" || deletePortfolio.isPending}
              style={{
                flex: 1,
                padding: "8px",
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                background: confirmInput.toLowerCase() === "delete" ? "rgba(255,77,77,0.15)" : "#0D1117",
                border: `1px solid ${confirmInput.toLowerCase() === "delete" ? "#FF4D4D" : "#2D3748"}`,
                borderRadius: 3,
                color: confirmInput.toLowerCase() === "delete" ? "#FF4D4D" : "#2D3748",
                fontFamily: "monospace",
                cursor: confirmInput.toLowerCase() === "delete" ? "pointer" : "not-allowed",
                transition: "all 0.15s",
              }}
            >
              {deletePortfolio.isPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
