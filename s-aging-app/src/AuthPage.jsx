import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "./utils/supabase";

const COLORS = {
  green400: "#639922", green600: "#3B6D11", green50: "#EAF3DE",
  red400: "#E24B4A", red50: "#FCEBEB",
  gray400: "#888780", gray600: "#5F5E5A", gray50: "#F8F7F4",
};

export default function AuthPage({ onAuth, initialNotice }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(initialNotice || null);

  const switchMode = (m) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === "register") {
        // Register directly via Supabase. The DB trigger handle_new_user()
        // auto-creates the matching public.profiles row.
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username } },
        });
        if (signUpErr) { setError(signUpErr.message); setLoading(false); return; }

        if (!data?.session) {
          // Email confirmation required
          setInfo("Account created! Check your email to confirm, then log in.");
          switchMode("login");
        } else {
          // Email confirmation is disabled in Supabase settings → auto-login
          onAuth(data.session, data.user);
        }
      } else {
        // Login: sign in directly with Supabase
        const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
        if (authErr) { setError(authErr.message); setLoading(false); return; }
        if (!data?.session) { setError("Login succeeded but no session was returned."); setLoading(false); return; }
        onAuth(data.session, data.user);
      }
    } catch (err) {
      setError(err?.message || "Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", position: "relative", overflow: "hidden",
      backgroundColor: "#1a2e0a",
    }}>
      <style>{`
        @keyframes scrollBanana {
          0%   { background-position: 0 0; }
          100% { background-position: 160px 160px; }
        }
      `}</style>
      {/* Scrolling banana pixel background */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        backgroundImage: "url('/banana-pix.png')",
        backgroundRepeat: "repeat",
        backgroundSize: "160px 160px",
        opacity: 0.18,
        animation: "scrollBanana 12s linear infinite",
      }} />
      {/* Dark overlay for readability */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: "linear-gradient(135deg, rgba(10,22,4,0.7) 0%, rgba(26,46,10,0.5) 100%)",
      }} />
      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 860, display: "flex", alignItems: "center", justifyContent: "center", gap: 48 }}>
        {/* Logo on the left */}
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <img src="/s-aging_logo.png" alt="S-Aging" style={{ width: 200, height: 200, objectFit: "contain", filter: "drop-shadow(0 4px 24px rgba(0,0,0,0.4))" }} />
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 22, letterSpacing: "-0.5px", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>S-Aging</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "center", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>FEU Institute of Technology</div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, textAlign: "center", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>by Nautilizers · 2026</div>
        </div>
        {/* Divider */}
        <div style={{ width: 1, height: 280, background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: "100%", maxWidth: 420,
          background: "#fff", borderRadius: 16,
          border: "1px solid #E8E7E3",
          boxShadow: "0 4px 32px rgba(0,0,0,0.07)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          background: COLORS.green600, padding: "28px 32px 24px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8,
            background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 3, flexShrink: 0,
          }}>
            <img src="/s-aging_logo.png" alt="S-Aging" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 18, letterSpacing: "-0.3px" }}>S-Aging</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>FEU Institute of Technology · 2026</div>
          </div>
        </div>

        <div style={{ padding: "28px 32px 32px" }}>
          {/* Mode toggle */}
          <div style={{
            display: "flex", background: COLORS.gray50,
            borderRadius: 8, padding: 3, marginBottom: 24,
          }}>
            {["login", "register"].map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                style={{
                  flex: 1, padding: "7px 0", border: "none", borderRadius: 6,
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "all 0.2s",
                  background: mode === m ? "#fff" : "transparent",
                  color: mode === m ? COLORS.green600 : COLORS.gray400,
                  boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                }}
              >
                {m === "login" ? "Log in" : "Register"}
              </button>
            ))}
          </div>

          {/* Feedback banners */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{
                  background: COLORS.red50, border: `1px solid #F7C1C1`, borderRadius: 8,
                  padding: "10px 14px", marginBottom: 16, fontSize: 13, color: COLORS.red400
                }}
              >
                {error}
              </motion.div>
            )}
            {info && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{
                  background: COLORS.green50, border: `1px solid #C0DD97`, borderRadius: 8,
                  padding: "10px 14px", marginBottom: 16, fontSize: 13, color: COLORS.green600
                }}
              >
                {info}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />

            <AnimatePresence>
              {mode === "register" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                  style={{ overflow: "hidden" }}
                >
                  <Field label="Username" type="text" value={username} onChange={setUsername} placeholder="e.g. yoel_reyes" />
                </motion.div>
              )}
            </AnimatePresence>

            <Field label="Password" type="password" value={password} onChange={setPassword}
              placeholder={mode === "register" ? "Min 8 chars, 1 uppercase, 1 number, 1 symbol" : "Your password"} />

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4, padding: "11px 0", borderRadius: 8, border: "none",
                background: loading ? "#a0b880" : COLORS.green400,
                color: "#fff", fontWeight: 600, fontSize: 14,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}
            >
              {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: COLORS.gray400 }}>
            {mode === "login" ? (
              <>No account?{" "}
                <span style={{ color: COLORS.green600, cursor: "pointer", fontWeight: 600 }}
                  onClick={() => switchMode("register")}>Register here</span></>
            ) : (
              <>Already have an account?{" "}
                <span style={{ color: COLORS.green600, cursor: "pointer", fontWeight: 600 }}
                  onClick={() => switchMode("login")}>Log in</span></>
            )}
          </div>
        </div>
      </motion.div>
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.gray600 }}>{label}</label>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          type={isPassword && show ? "text" : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required
          style={{
            width: "100%",
            padding: isPassword ? "9px 40px 9px 12px" : "9px 12px",
            borderRadius: 8, border: "1px solid #DDDBD5",
            fontSize: 14, outline: "none", background: "#fff", color: "#2A2A28",
            transition: "border-color 0.15s", boxSizing: "border-box",
          }}
          onFocus={e => e.target.style.borderColor = COLORS.green400}
          onBlur={e => e.target.style.borderColor = "#DDDBD5"}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            tabIndex={-1}
            aria-label={show ? "Hide password" : "Show password"}
            style={{
              position: "absolute", right: 10, background: "none", border: "none",
              cursor: "pointer", color: COLORS.gray400, display: "flex",
              alignItems: "center", padding: 4, borderRadius: 4,
            }}
          >
            {show ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

