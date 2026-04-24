// Migrated from app/auth.jsx — Signup.

import { useState, type FormEvent } from "react";
import { authApi } from "@/api/endpoints";
import { ApiError } from "@/api/client";
import { useSession } from "@/store/session";
import { Link, navigate } from "@/router";
import { toast } from "@/store/toast";

export function SignupScreen() {
  const [form, setForm] = useState({ email: "", name: "", pw: "" });
  const [busy, setBusy] = useState(false);
  const setUser = useSession((s) => s.setUser);
  const up = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await authApi.signup({ email: form.email, password: form.pw, name: form.name });
      setUser(r.user);
      navigate("/onboarding");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Signup failed";
      toast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dt-auth-split" style={{ height: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr", background: "var(--bg)" }}>
      <div
        style={{
          padding: 60,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "var(--paper-50)",
          borderRight: "1px solid var(--border-soft)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/assets/logo-monogram.svg" height={32} alt="Dev Thriller" />
          <span style={{ font: "700 16px/1 var(--font-sans)" }}>Dev Thriller</span>
        </div>

        <form onSubmit={onSubmit} style={{ maxWidth: 360, width: "100%", display: "grid", gap: 14 }}>
          <div>
            <div className="caseno" style={{ marginBottom: 6 }}>
              CASE · 0000 · NEW FILE
            </div>
            <h1 style={{ font: "400 40px/1.1 var(--font-display)", margin: 0, letterSpacing: "-.01em" }}>
              Open a <span style={{ fontStyle: "italic" }}>new case</span>.
            </h1>
            <div style={{ color: "var(--fg2)", marginTop: 6 }}>30-day free trial. No card required.</div>
          </div>
          <div className="field">
            <label>Work email</label>
            <input
              className="input"
              type="email"
              placeholder="you@studio.dev"
              value={form.email}
              onChange={(e) => up("email", e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label>Full name</label>
            <input
              className="input"
              type="text"
              placeholder="Jane Director"
              value={form.name}
              onChange={(e) => up("name", e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              className="input"
              type="password"
              placeholder="8+ chars"
              value={form.pw}
              onChange={(e) => up("pw", e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <div className="hint">
              Argon2id hashed. mTLS on the wire. Read the{" "}
              <a href="#" onClick={(e) => e.preventDefault()}>
                security docs
              </a>
              .
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ justifyContent: "center" }} disabled={busy}>
            {busy ? <span className="spinner" /> : "Create account →"}
          </button>
          <div style={{ textAlign: "center", font: "400 12px/1.4 var(--font-sans)", color: "var(--fg3)" }}>
            Already a detective? <Link to="/login">Sign in</Link>
          </div>
        </form>

        <div style={{ font: "400 11px/1.4 var(--font-mono)", color: "var(--fg3)", maxWidth: 360 }}>
          By continuing you accept the Terms and Privacy Policy. SOC 2 Type II. GDPR compliant.
        </div>
      </div>

      <div
        className="dt-auth-side"
        style={{
          background: "var(--ink-900)",
          color: "#FFFDF8",
          padding: 60,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 18,
        }}
      >
        <div className="caseno" style={{ color: "#7B80B0" }}>
          EVIDENCE · 01 · 02 · 03
        </div>
        <div style={{ display: "grid", gap: 20, marginTop: 8 }}>
          {[
            ["Every upload is a case file.", "Chunked, resumable, sha256 verified. Your 4 GB render won't die on a reconnect."],
            ["Every message has a chain.", "Thread replies pin to timestamps. Finalized versions lock. Everything is traceable."],
            ["Every case is encrypted.", "AES-256 at rest, mTLS in flight, zero-knowledge option for legal workspaces."],
          ].map(([t, s], i) => (
            <div key={i} style={{ display: "flex", gap: 14 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: "var(--ember-500)",
                  color: "#0E1130",
                  font: "700 14px/32px var(--font-mono)",
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                0{i + 1}
              </div>
              <div>
                <div style={{ font: "600 15px/1.3 var(--font-sans)" }}>{t}</div>
                <div style={{ color: "#C8CCE8", fontSize: 13, marginTop: 3 }}>{s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
