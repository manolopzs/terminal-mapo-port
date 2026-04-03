import { useState } from "react";
import { login } from "@/lib/auth";

interface LoginProps {
  onSuccess: () => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const ok = await login(user.trim(), pass);
    if (ok) {
      onSuccess();
    } else {
      setError("Access denied");
      setLoading(false);
    }
  }

  return (
    <div style={{
      height: "100vh",
      width: "100vw",
      background: "#040810",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Scanline overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(212,168,83,0.015) 2px, rgba(212,168,83,0.015) 4px)",
        pointerEvents: "none",
      }} />

      {/* Center glow */}
      <div style={{
        position: "absolute",
        width: 800,
        height: 800,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,100,32,0.08) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />

      <div style={{ width: 400, position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 52,
            height: 52,
            background: "linear-gradient(135deg, #C49B3C 0%, #8B6420 100%)",
            borderRadius: 10,
            marginBottom: 18,
            boxShadow: "0 0 40px rgba(196,155,60,0.2)",
            fontSize: 17,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: 1,
          }}>
            MT
          </div>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 5,
            textTransform: "uppercase",
            color: "#C9D1D9",
            marginBottom: 6,
          }}>
            MAPO TERMINAL
          </div>
          <div style={{
            fontSize: 9,
            color: "#2E3E52",
            letterSpacing: 3,
            textTransform: "uppercase",
          }}>
            INTELLIGENCE SYSTEM v2.0
          </div>
        </div>

        {/* Login card */}
        <div style={{
          background: "#07090F",
          border: "1px solid #1C2840",
          borderRadius: 6,
          padding: "28px 28px 32px",
          boxShadow: "0 0 0 1px var(--color-primary-a05), 0 32px 64px rgba(0,0,0,0.6)",
        }}>
          {/* Status bar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 28,
            paddingBottom: 16,
            borderBottom: "1px solid #111827",
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--color-green)",
              boxShadow: "0 0 8px rgba(0,230,168,0.6)",
              display: "inline-block",
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 9, color: "#3A5060", letterSpacing: 2, textTransform: "uppercase" }}>
              SECURE ACCESS REQUIRED
            </span>
          </div>

          <form onSubmit={handleSubmit}>
            {/* User field */}
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 8,
                color: "#4A5A6E",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 8,
              }}>
                User ID
              </div>
              <input
                type="text"
                value={user}
                onChange={e => setUser(e.target.value)}
                placeholder="Enter user ID"
                required
                autoFocus
                autoComplete="username"
                style={{
                  width: "100%",
                  background: "#050810",
                  border: "1px solid #1A2638",
                  borderRadius: 4,
                  padding: "10px 12px",
                  fontSize: 12,
                  color: "#C9D1D9",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                  letterSpacing: 1,
                }}
                onFocus={e => e.target.style.borderColor = "rgba(212,168,83,0.4)"}
                onBlur={e => e.target.style.borderColor = "#1A2638"}
              />
            </div>

            {/* Password field */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 8,
                color: "#4A5A6E",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 8,
              }}>
                Access Key
              </div>
              <input
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="••••••••••"
                required
                autoComplete="current-password"
                style={{
                  width: "100%",
                  background: "#050810",
                  border: "1px solid #1A2638",
                  borderRadius: 4,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "#C9D1D9",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={e => e.target.style.borderColor = "rgba(212,168,83,0.4)"}
                onBlur={e => e.target.style.borderColor = "#1A2638"}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                fontSize: 9,
                color: "var(--color-red)",
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 16,
                padding: "8px 12px",
                background: "rgba(255,68,88,0.06)",
                border: "1px solid var(--color-red-a20)",
                borderRadius: 4,
              }}>
                ✕ &nbsp;{error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                background: loading ? "#0A0F1C" : "linear-gradient(135deg, #C49B3C 0%, #8B6420 100%)",
                border: loading ? "1px solid #1C2840" : "none",
                borderRadius: 4,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: loading ? "#2E3E52" : "#fff",
                fontFamily: "inherit",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 24px rgba(196,155,60,0.2)",
              }}
            >
              {loading ? "Authenticating..." : "Access Terminal"}
            </button>
          </form>
        </div>

        <div style={{
          textAlign: "center",
          marginTop: 18,
          fontSize: 8,
          color: "#141E2E",
          letterSpacing: 2,
          textTransform: "uppercase",
        }}>
          Authorized Personnel Only
        </div>
      </div>
    </div>
  );
}
