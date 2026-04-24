// Password-reset confirm. Reads ?token=… from the URL.

import { useState, type FormEvent } from "react";
import { Link, navigate, useLocation } from "@/router";
import { passwordResetApi } from "@/api/adminApi";
import { toast } from "@/store/toast";

export function ResetPasswordScreen() {
  const loc = useLocation();
  const token = new URLSearchParams(loc.split("?")[1] ?? "").get("token") ?? "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (pw !== pw2) {
      toast("Passwords do not match", "error");
      return;
    }
    if (!token) {
      toast("Reset token missing from link", "error");
      return;
    }
    setBusy(true);
    try {
      await passwordResetApi.confirm({ token, newPassword: pw });
      toast("Password reset. Sign in with the new password.");
      navigate("/login");
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
          Set a new <span style={{ fontStyle: "italic" }}>password</span>.
        </h1>

        <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 12 }}>
          <div className="field">
            <label>New password</label>
            <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} autoFocus />
          </div>
          <div className="field">
            <label>Confirm</label>
            <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={8} />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ justifyContent: "center" }} disabled={busy || !token}>
            {busy ? <span className="spinner" /> : "Reset password"}
          </button>
          <div style={{ textAlign: "center", font: "400 12px/1.4 var(--font-sans)", color: "var(--fg3)" }}>
            <Link to="/login">Back to sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
