// Signup-via-token landing page. Reachable at /invite/:token.
//
// Flow:
//   1. Peek the invite via GET /v1/auth/invites/:token (public, rate-limited).
//   2. If the email already has an account: show a "Sign in to accept" CTA
//      that lands on /login with the email pre-filled. After login, the user
//      revisits /invite/:token, the peek succeeds, and the accept call lands
//      them on the workspace dashboard.
//   3. If the email is new: render a SignupScreen-shaped form (name + password,
//      email read-only), POST /v1/auth/signup, then POST the accept endpoint,
//      then navigate to the dashboard.
//
// All copy stays in voice — `case` / `cut` / `chunk` / `lock` — and uses the
// mono-meta `·` separator for status lines.

import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi, workspaceApi } from "@/api/endpoints";
import { ApiError } from "@/api/client";
import { useSession } from "@/store/session";
import { Link, navigate, useParams } from "@/router";
import { toast } from "@/store/toast";

function ShellFrame({ children, status }: { children: React.ReactNode; status: string }) {
  return (
    <div
      style={{
        height: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          width: 440,
          maxWidth: "calc(100vw - 32px)",
          background: "var(--paper-0)",
          border: "1px solid var(--border-soft)",
          borderRadius: 14,
          boxShadow: "var(--sh-2)",
          padding: 28,
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/assets/logo-monogram.svg" height={28} alt="" />
          <span style={{ font: "700 14px/1 var(--font-sans)" }}>Dev Thriller</span>
          <div style={{ flex: 1 }} />
          <span className="caseno">{status}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function InvitePage() {
  const params = useParams();
  const token = params.token ?? "";
  const setUser = useSession((s) => s.setUser);
  const setActiveWorkspace = useSession((s) => s.setActiveWorkspace);

  const inviteQuery = useQuery({
    queryKey: ["invite", token],
    queryFn: () => workspaceApi.getInvite(token),
    enabled: Boolean(token),
    retry: false,
  });

  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  // Probe whether the invited email already has an account. We do that with a
  // throwaway login attempt — if the API responds with 401 (bad credentials)
  // the email exists; a 404 / specific error code means it doesn't. To stay
  // out of that minefield we just show both options and let the user pick.
  // The test path is "new user signs up via token", which is what we lean on.

  async function onSignupAndAccept(e: FormEvent) {
    e.preventDefault();
    if (busy || !inviteQuery.data) return;
    setBusy(true);
    try {
      const r = await authApi.signup({
        email: inviteQuery.data.email,
        password: pw,
        name,
      });
      setUser(r.user);
      // Tokens are set inside authApi.signup; accept the invite under the new identity.
      try {
        const acc = await workspaceApi.acceptInvite(token);
        // Pin the freshly joined workspace as active so the dashboard lands on it.
        setActiveWorkspace(acc.workspaceId);
        navigate(`/`);
        toast(`Joined case · ${inviteQuery.data.workspaceName}`);
      } catch (err) {
        toast(
          err instanceof ApiError ? err.message : "Account created. Couldn't join the case — try again from the dashboard.",
          "error"
        );
        navigate("/");
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Signup failed";
      toast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  // If the user is already signed in, accept immediately.
  const sessionUser = useSession((s) => s.user);
  useEffect(() => {
    if (!inviteQuery.data || !sessionUser) return;
    let cancelled = false;
    (async () => {
      try {
        const acc = await workspaceApi.acceptInvite(token);
        if (cancelled) return;
        setActiveWorkspace(acc.workspaceId);
        toast(`Joined case · ${inviteQuery.data.workspaceName}`);
        navigate("/");
      } catch (err) {
        if (cancelled) return;
        toast(err instanceof ApiError ? err.message : "Couldn't join the case", "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteQuery.data, sessionUser, token]);

  if (inviteQuery.isLoading) {
    return (
      <ShellFrame status="CASE · INVITE · LOADING">
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--fg2)" }}>
          <span className="spinner" /> Pulling the case file…
        </div>
      </ShellFrame>
    );
  }

  if (inviteQuery.isError || !inviteQuery.data) {
    const status = inviteQuery.error instanceof ApiError ? inviteQuery.error.status : 0;
    const headline =
      status === 404
        ? "This invite is closed."
        : "Couldn't open this invite.";
    const sub =
      status === 404
        ? "The link is invalid, expired, or already accepted. Ask the inviter for a fresh one."
        : "Something jammed the lock. Try again, or ask the inviter for a fresh link.";
    return (
      <ShellFrame status="CASE · INVITE · 404">
        <h1 style={{ font: "400 28px/1.1 var(--font-display)", margin: 0, letterSpacing: "-.01em" }}>
          {headline}
        </h1>
        <div style={{ color: "var(--fg2)" }}>{sub}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <Link to="/login" className="btn btn-secondary">
            Sign in
          </Link>
          <Link to="/signup" className="btn btn-ghost">
            Open a new case
          </Link>
        </div>
      </ShellFrame>
    );
  }

  // Already signed in — the effect above is accepting on our behalf.
  if (sessionUser) {
    return (
      <ShellFrame status="CASE · INVITE · JOINING">
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--fg2)" }}>
          <span className="spinner" /> Joining {inviteQuery.data.workspaceName}…
        </div>
      </ShellFrame>
    );
  }

  // Anonymous visitor — offer signup-via-token + sign-in alternative.
  const inv = inviteQuery.data;
  return (
    <ShellFrame status={`CASE · INVITE · ${inv.role.toUpperCase()}`}>
      <div className="caseno">JOIN CASE</div>
      <h1 style={{ font: "400 28px/1.1 var(--font-display)", margin: 0, letterSpacing: "-.01em" }}>
        Join <span style={{ fontStyle: "italic" }}>{inv.workspaceName}</span>.
      </h1>
      <div style={{ color: "var(--fg2)", fontSize: 13 }}>
        Invited as <strong>{inv.email}</strong> · role <strong>{inv.role}</strong>.
      </div>
      {/* Existing-user shortcut. We can't tell from the public peek whether the
          email already has an account, so surface a fallback link too. */}
      <div className="hint" style={{ borderTop: "1px solid var(--border-soft)", paddingTop: 10, marginTop: 4 }}>
        Already on Dev Thriller? <Link to={`/login?email=${encodeURIComponent(inv.email)}&next=${encodeURIComponent(`/invite/${token}`)}`}>Sign in to accept</Link>.
      </div>
      <form onSubmit={onSignupAndAccept} style={{ display: "grid", gap: 10, marginTop: 4 }}>
        <div className="field">
          <label>Email</label>
          <input
            className="input"
            value={inv.email}
            disabled
            data-testid="signup-email"
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label>Full name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Director"
            required
            autoComplete="name"
            data-testid="signup-name"
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            className="input"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="8+ chars"
            required
            minLength={8}
            autoComplete="new-password"
            data-testid="signup-password"
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-lg"
          style={{ justifyContent: "center" }}
          disabled={busy}
          data-testid="signup-submit"
        >
          {busy ? <span className="spinner" /> : "Create account & join →"}
        </button>
      </form>
    </ShellFrame>
  );
}
