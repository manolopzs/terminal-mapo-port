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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTimeout(() => {
      if (login(email, password)) {
        onSuccess();
      } else {
        setError("Invalid credentials");
        setLoading(false);
      }
    }, 600);
  }

  return (
    <div
      className="h-screen w-screen flex items-center justify-center"
      style={{ background: "#080C14" }}
    >
      <div style={{ width: 360 }}>
        {/* Logo / Title */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "#00D9FF",
              fontFamily: "monospace",
              marginBottom: 6,
            }}
          >
            ◈ MAPO TERMINAL
          </div>
          <div
            style={{
              fontSize: 9,
              color: "#484F58",
              letterSpacing: 2,
              textTransform: "uppercase",
              fontFamily: "monospace",
            }}
          >
            Portfolio Intelligence System v4.0
          </div>
        </div>

        {/* Login form */}
        <div
          style={{
            background: "#0D1117",
            border: "1px solid #1A2332",
            borderRadius: 4,
            padding: "28px 28px",
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: "#8B949E",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 20,
              fontFamily: "monospace",
              borderBottom: "1px solid #1A2332",
              paddingBottom: 12,
            }}
          >
            Secure Login
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 8,
                  color: "#8B949E",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  fontFamily: "monospace",
                  marginBottom: 6,
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="user@domain.com"
                style={{
                  width: "100%",
                  background: "#080C14",
                  border: "1px solid #1A2332",
                  borderRadius: 3,
                  padding: "8px 12px",
                  fontSize: 11,
                  color: "#C9D1D9",
                  fontFamily: "monospace",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#00D9FF")}
                onBlur={(e) => (e.target.style.borderColor = "#1A2332")}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 8,
                  color: "#8B949E",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  fontFamily: "monospace",
                  marginBottom: 6,
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
                  background: "#080C14",
                  border: "1px solid #1A2332",
                  borderRadius: 3,
                  padding: "8px 12px",
                  fontSize: 11,
                  color: "#C9D1D9",
                  fontFamily: "monospace",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#00D9FF")}
                onBlur={(e) => (e.target.style.borderColor = "#1A2332")}
              />
            </div>

            {error && (
              <div
                style={{
                  fontSize: 9,
                  color: "#FF4D4D",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  fontFamily: "monospace",
                  marginBottom: 14,
                  padding: "6px 10px",
                  background: "rgba(255,77,77,0.08)",
                  border: "1px solid rgba(255,77,77,0.2)",
                  borderRadius: 3,
                }}
              >
                ✕ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "9px",
                background: loading
                  ? "#1A2332"
                  : "linear-gradient(135deg, #00D9FF 0%, #0066FF 100%)",
                border: "none",
                borderRadius: 3,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: loading ? "#484F58" : "#080C14",
                fontFamily: "monospace",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              {loading ? "Authenticating..." : "Access Terminal"}
            </button>
          </form>
        </div>

        <div
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: 8,
            color: "#2D3748",
            letterSpacing: 1.5,
            fontFamily: "monospace",
            textTransform: "uppercase",
          }}
        >
          Authorized Access Only — Private Portfolio System
        </div>
      </div>
    </div>
  );
}
