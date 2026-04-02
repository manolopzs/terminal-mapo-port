import { useLocation, Link } from "wouter";
import { LayoutDashboard, Search, Filter, RefreshCw, Clock } from "lucide-react";
import { StatusDot } from "@/components/terminal/StatusDot";
import { T } from "@/styles/tokens";
import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/analyze", label: "Analyze", icon: Search },
  { path: "/screen", label: "Screen", icon: Filter },
  { path: "/rebalance", label: "Rebalance", icon: RefreshCw },
  { path: "/trades", label: "Trade Log", icon: Clock },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/analyze": "Analyze",
  "/screen": "Screen Universe",
  "/rebalance": "Rebalance",
  "/trades": "Trade Log",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const collapsed = isMobile;
  const [totalValue, setTotalValue] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/holdings")
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          const sum = data.reduce((acc, h) => acc + (Number(h.value) || 0), 0);
          setTotalValue(sum);
        }
      })
      .catch(() => {});
  }, []);

  const pageTitle = PAGE_TITLES[location] ?? "MAPO Terminal";
  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, overflow: "hidden" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: collapsed ? 64 : 220,
          flexShrink: 0,
          background: T.surface,
          borderRight: `1px solid ${T.border}`,
          display: "flex",
          flexDirection: "column",
          transition: "width 300ms ease",
          overflow: "hidden",
        }}
      >
        {/* Logo */}
        <div style={{ padding: "20px 16px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: `2px solid ${T.green}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: T.font.display,
              fontSize: 20,
              fontWeight: 700,
              color: T.green,
              flexShrink: 0,
            }}
          >
            M
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontFamily: T.font.display, fontSize: 16, fontWeight: 700, color: T.white }}>
                MAPO
              </div>
              <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.dim }}>v4.0</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav
          style={{
            flex: 1,
            padding: "0 8px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const isActive = path === "/" ? (location === "/" || location === "") : location === path;
            return (
              <Link key={path} to={path}>
                <a
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: `8px 12px 8px ${isActive ? "9px" : "12px"}`,
                    borderLeft: isActive ? `3px solid ${T.green}` : "3px solid transparent",
                    background: isActive ? T.surfaceAlt : "transparent",
                    borderRadius: 4,
                    color: isActive ? T.green : T.dim,
                    fontFamily: T.font.mono,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    textDecoration: "none",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLAnchorElement).style.background = T.surfaceAlt;
                      (e.currentTarget as HTMLAnchorElement).style.color = T.white;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                      (e.currentTarget as HTMLAnchorElement).style.color = T.dim;
                    }
                  }}
                >
                  <Icon size={14} style={{ flexShrink: 0 }} />
                  {!collapsed && label}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ borderTop: `1px solid ${T.border}`, padding: 16 }}>
          {!collapsed && (
            <>
              <div
                style={{
                  fontFamily: T.font.mono,
                  fontSize: 16,
                  fontWeight: 700,
                  color: T.green,
                  marginBottom: 2,
                }}
              >
                {totalValue != null
                  ? `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : "—"}
              </div>
              <div
                style={{
                  fontFamily: T.font.mono,
                  fontSize: 9,
                  color: T.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  marginBottom: 8,
                }}
              >
                Total Value
              </div>
            </>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusDot color={T.green} size={6} />
            {!collapsed && (
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: 9,
                  color: T.green,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                System Online
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <div
          style={{
            padding: "20px 24px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h1
            style={{
              fontFamily: T.font.display,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: T.white,
              margin: 0,
            }}
          >
            {pageTitle}
          </h1>
          <span style={{ fontFamily: T.font.mono, fontSize: 12, color: T.dim }}>{dateStr}</span>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
