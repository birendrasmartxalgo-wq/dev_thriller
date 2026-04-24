// Password-reset request. Always shows success copy — don't leak email existence.

import { useState, type FormEvent } from "react";
import { Link } from "@/router";
import { passwordResetApi } from "@/api/adminApi";
import { toast } from "@/store/toast";

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await passwordResetApi.request(email);
      setSent(true);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ height: "100vh", display: "grid", placeItems: "center", background: "var(--bg)" }}>
      <div style={{ width: 360 }}>
        <img src="/assets/logo-monogram.svg" height={32} alt="" />
        <div className="caseno" style={{ marginTop: 16 }}>
          CASE · RESET
        </div>
        <h1 style={{ font: "400 36px/1.1 var(--font-display)", margin: "6px 0 8px", letterSpacing: "-.01em" }}>
          Forgot the <span style={{ fontStyle: "italic" }}>password</span>?
        </h1>

        {sent ? (
          <>
            <p style={{ color: "var(--fg2)" }}>
              If that email has an account, we just sent a reset link. It expires in one hour.
            </p>
            <Link to="/login" className="btn btn-secondary" style={{ marginTop: 12 }}>
              Back to sign in
            </Link>
          </>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 12 }}>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ justifyContent: "center" }} disabled={busy}>
              {busy ? <span className="spinner" /> : "Send reset link"}
            </button>
            <div style={{ textAlign: "center", font: "400 12px/1.4 var(--font-sans)", color: "var(--fg3)" }}>
              <Link to="/login">Back to sign in</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
