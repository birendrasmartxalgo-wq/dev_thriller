// Migrated from app/auth.jsx — Login. Same markup + CSS variables, live API wiring.

import { useState, type FormEvent } from "react";
import { authApi } from "@/api/endpoints";
import { ApiError } from "@/api/client";
import { useSession } from "@/store/session";
import { Link, navigate } from "@/router";
import { toast } from "@/store/toast";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const setUser = useSession((s) => s.setUser);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await authApi.login({ email, password: pw });
      setUser(r.user);
      navigate("/");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Login failed";
      toast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ height: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr", background: "var(--bg)" }}>
      <div
        style={{
          padding: "60px 60px",
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
              CASE · 0001 · LOGIN
            </div>
            <h1 style={{ font: "400 40px/1.1 var(--font-display)", margin: 0, letterSpacing: "-.01em" }}>
              Welcome back,
              <br />
              detective.
            </h1>
          </div>
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@studio.dev"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              autoComplete="current-password"
              minLength={8}
            />
            <div className="hint">
              <a href="#" onClick={(e) => e.preventDefault()}>
                Forgot password?
              </a>
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ justifyContent: "center" }}
            disabled={busy}
          >
            {busy ? <span className="spinner" /> : "Sign in"}
          </button>
          <div
            style={{
              textAlign: "center",
              font: "400 12px/1.4 var(--font-sans)",
              color: "var(--fg3)",
              marginTop: 4,
            }}
          >
            New here? <Link to="/signup">Create an account</Link>
          </div>
        </form>

        <div style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg3)" }}>© 2026 Dev Thriller · v1.4.2</div>
      </div>

      <div
        style={{
          background: "var(--ink-900)",
          color: "#FFFDF8",
          padding: 60,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ font: "400 52px/1.1 var(--font-display)", letterSpacing: "-.01em", zIndex: 1 }}>
          The suspense of a <span style={{ fontStyle: "italic" }}>thriller</span>.
          <br />
          The{" "}
          <span
            style={{
              background:
                "linear-gradient(180deg, transparent 60%, rgba(255,203,61,.7) 60%, rgba(255,203,61,.7) 92%, transparent 92%)",
              padding: "0 4px",
            }}
          >
            precision
          </span>{" "}
          of a dev tool.
        </div>
        <div style={{ font: "400 15px/1.5 var(--font-sans)", color: "#C8CCE8", maxWidth: 440, zIndex: 1 }}>
          A team chat where every file is versioned, every upload resumable, every plot point traceable.
        </div>
        <div
          style={{
            position: "absolute",
            width: "140%",
            height: 44,
            left: "-20%",
            transform: "rotate(-8deg)",
            background: "var(--ember-500)",
            top: "62%",
            zIndex: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            font: "700 12px/1 var(--font-mono)",
            letterSpacing: ".3em",
            color: "var(--ink-900)",
          }}
        >
          <span>CASE · 0001</span>
          <span>DO NOT CROSS</span>
          <span>CASE · 0001</span>
          <span>DO NOT CROSS</span>
          <span>CASE · 0001</span>
        </div>
      </div>
    </div>
  );
}
