import { useState } from "react";
import { login } from "@/lib/auth";

interface LoginProps {
  onSuccess: () => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const ok = await login(email, password);
    if (ok) {
      onSuccess();
    } else {
      setError("Invalid credentials");
      setLoading(false);
    }
  }

  return (
    <div
      className="h-screen w-screen flex items-center justify-center"
      style={{
        background: "#040810",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0,217,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,217,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          pointerEvents: "none",
        }}
      />
      {/* Radial glow behind card */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,217,255,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ width: 380, position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              background: "linear-gradient(135deg, #00C4E8 0%, #0055DD 100%)",
              borderRadius: 12,
              marginBottom: 16,
              boxShadow: "0 0 32px rgba(0,217,255,0.25), 0 0 0 1px rgba(0,217,255,0.15)",
              fontSize: 16,
              fontWeight: 800,
              fontFamily: "'JetBrains Mono', monospace",
              color: "#fff",
              letterSpacing: 1,
            }}
          >
            MT
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#D6DFE8",
              fontFamily: "'Inter', system-ui, sans-serif",
              marginBottom: 6,
            }}
          >
            MAPO TERMINAL
          </div>
          <div
            style={{
              fontSize: 9,
              color: "#3A4A5C",
              letterSpacing: 2.5,
              textTransform: "uppercase",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            Portfolio Intelligence System
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: "#080C14",
            border: "1px solid #1C2840",
            borderRadius: 8,
            padding: "32px",
            boxShadow: "0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,217,255,0.04)",
          }}
        >
          {/* Card header */}
          <div
            style={{
              fontSize: 8,
              color: "#4A5A6E",
              letterSpacing: 2,
              textTransform: "uppercase",
              fontFamily: "'Inter', system-ui, sans-serif",
              marginBottom: 24,
              paddingBottom: 14,
              borderBottom: "1px solid #1C2840",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#00E6A8",
                boxShadow: "0 0 6px rgba(0,230,168,0.5)",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            Secure Access
          </div>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 8,
                  color: "#4A5A6E",
                  letterSpacing: 1.8,
                  textTransform: "uppercase",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  marginBottom: 7,
                }}
              >
                Email
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="Username"
                style={{
                  width: "100%",
                  background: "#0B0F1A",
                  border: "1px solid #1C2840",
                  borderRadius: 5,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#C9D1D9",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(0,217,255,0.5)")}
                onBlur={(e) => (e.target.style.borderColor = "#1C2840")}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 8,
                  color: "#4A5A6E",
                  letterSpacing: 1.8,
                  textTransform: "uppercase",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  marginBottom: 7,
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: "100%",
                  background: "#0B0F1A",
                  border: "1px solid #1C2840",
                  borderRadius: 5,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#C9D1D9",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(0,217,255,0.5)")}
                onBlur={(e) => (e.target.style.borderColor = "#1C2840")}
              />
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  fontSize: 9,
                  color: "#FF4458",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  marginBottom: 16,
                  padding: "8px 12px",
                  background: "rgba(255,68,88,0.08)",
                  border: "1px solid rgba(255,68,88,0.2)",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <span style={{ fontSize: 11 }}>✕</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "11px",
                background: loading
                  ? "#0E1828"
                  : "linear-gradient(135deg, #00C4E8 0%, #0055DD 100%)",
                border: loading ? "1px solid #1C2840" : "none",
                borderRadius: 5,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2.5,
                textTransform: "uppercase",
                color: loading ? "#3A4A5C" : "#fff",
                fontFamily: "'Inter', system-ui, sans-serif",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                boxShadow: loading ? "none" : "0 4px 20px rgba(0,180,255,0.25)",
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.boxShadow = "0 6px 28px rgba(0,180,255,0.4)";
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,180,255,0.25)";
              }}
            >
              {loading ? "Authenticating..." : "Access Terminal"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: 8,
            color: "#1E2D3F",
            letterSpacing: 1.8,
            fontFamily: "'Inter', system-ui, sans-serif",
            textTransform: "uppercase",
          }}
        >
          Authorized Access Only
        </div>
      </div>
    </div>
  );
}
