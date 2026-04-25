// Workspace-invite modal. Sends a single invite via POST /v1/workspaces/:id/invites
// and surfaces the resulting token so the inviter can hand it off out-of-band
// (or copy a /invite/<token> URL). The e2e smoke test reads the token from the
// `invite-token` testid to drive a join flow.

import { useEffect, useState, type FormEvent } from "react";
import { workspaceApi } from "@/api/endpoints";
import { ApiError } from "@/api/client";
import { Icon } from "@/components/Icons";
import { toast } from "@/store/toast";

interface Props {
  workspaceId: string;
  onClose: () => void;
}

type Role = "admin" | "member" | "guest";

export function InviteDialog({ workspaceId, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await workspaceApi.invite(workspaceId, { emails: [trimmed], role });
      const t = r.invites[0]?.token ?? "";
      setToken(t);
      toast("Invite sent");
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Couldn't send the invite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(14, 17, 48, 0.35)",
        zIndex: 120,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        style={{
          width: 460,
          maxWidth: "calc(100vw - 32px)",
          background: "var(--paper-0)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "var(--sh-3)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-soft)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Icon.plus size={16} />
          <strong id="invite-title" style={{ font: "600 14px/1 var(--font-sans)" }}>
            Invite to the case
          </strong>
          <span className="caseno">CASE · INVITE</span>
          <div style={{ flex: 1 }} />
          <button type="button" className="tb-btn" onClick={onClose} aria-label="Close">
            <Icon.x size={14} />
          </button>
        </div>

        {!token ? (
          <form onSubmit={onSubmit}>
            <div style={{ padding: 16, display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span className="caseno">EMAIL</span>
                <input
                  autoFocus
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="teammate@studio.dev"
                  data-testid="invite-email"
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span className="caseno">ROLE</span>
                <select
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="guest">Guest</option>
                </select>
              </label>
              {err && (
                <div role="alert" className="hint" style={{ color: "var(--blood-500)" }}>
                  {err}
                </div>
              )}
            </div>
            <div
              style={{
                padding: "10px 16px",
                borderTop: "1px solid var(--border-soft)",
                background: "var(--bg-sunken)",
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy} data-testid="invite-submit">
                {busy ? <span className="spinner" /> : <><Icon.check size={14} /> Send invite</>}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div style={{ padding: 16, display: "grid", gap: 10 }}>
              <div className="caseno">INVITE · SENT</div>
              <div style={{ font: "400 13px/1.5 var(--font-sans)", color: "var(--fg2)" }}>
                Sent to <strong>{email.trim()}</strong>. The invite link is good for 14 days. If the email
                bounces or SMTP is dark, share the token below directly.
              </div>
              <label style={{ display: "grid", gap: 4 }}>
                <span className="caseno">TOKEN</span>
                <code
                  data-testid="invite-token"
                  style={{
                    font: "400 12px/1.5 var(--font-mono)",
                    background: "var(--paper-50)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    userSelect: "all",
                    wordBreak: "break-all",
                  }}
                >
                  {token}
                </code>
                <span className="hint">Lands them at <code>/invite/{token}</code>.</span>
              </label>
            </div>
            <div
              style={{
                padding: "10px 16px",
                borderTop: "1px solid var(--border-soft)",
                background: "var(--bg-sunken)",
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              <button type="button" className="btn btn-primary" onClick={onClose}>
                <Icon.check size={14} /> Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
