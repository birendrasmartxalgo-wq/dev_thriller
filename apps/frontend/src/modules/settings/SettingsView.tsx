// Migrated from app/extras.jsx — Settings tabs.
// Live-wired: Profile (from /me), Workspace (members + role PATCH).
// UI-only for now: Notifications (local toggles), Security (password form is stub),
// Billing, Integrations — backend endpoints for these are not in PRD v1 scope.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/Icons";
import { useSession } from "@/store/session";
import { api } from "@/api/client";
import { workspaceApi } from "@/api/endpoints";
import { toast } from "@/store/toast";

type Tab = "profile" | "notifications" | "security" | "workspace" | "billing" | "integrations";
type Role = "owner" | "admin" | "member" | "guest";
type InviteRole = "admin" | "member" | "guest";

const TABS: { k: Tab; l: string; ic: keyof typeof Icon }[] = [
  { k: "profile", l: "Profile", ic: "user" },
  { k: "notifications", l: "Notifications", ic: "bell" },
  { k: "security", l: "Security", ic: "shield" },
  { k: "workspace", l: "Workspace", ic: "globe" },
  { k: "billing", l: "Billing", ic: "tag" },
  { k: "integrations", l: "Integrations", ic: "link" },
];

export function SettingsView() {
  const [tab, setTab] = useState<Tab>("profile");
  const user = useSession((s) => s.user);
  const activeWs = useSession((s) => s.activeWorkspaceId);
  const workspaces = useSession((s) => s.workspaces);
  const activeWsData = workspaces.find((w) => w.id === activeWs);
  const [notif, setNotif] = useState({ mentions: true, all: false, dm: true, digest: true, push: false });
  const qc = useQueryClient();

  const membersQuery = useQuery({
    queryKey: ["members", activeWs],
    queryFn: () => workspaceApi.members(activeWs!),
    enabled: Boolean(activeWs),
  });

  const changeRole = useMutation({
    mutationFn: ({ uid, role }: { uid: string; role: Role }) =>
      api.patch(`/v1/workspaces/${activeWs}/members/${uid}`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", activeWs] });
      toast("Role updated");
    },
    onError: (e) => toast((e as Error).message, "error"),
  });

  const invite = useMutation({
    mutationFn: (body: { emails: string[]; role: InviteRole }) => workspaceApi.invite(activeWs!, body),
    onSuccess: (r) => {
      toast(`Sent ${r.invites.length} invite${r.invites.length === 1 ? "" : "s"}`);
      setInviteEmail("");
    },
    onError: (e) => toast((e as Error).message, "error"),
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("member");

  const IconAt = ({ name }: { name: keyof typeof Icon }) => {
    const C = Icon[name];
    return <C size={16} />;
  };

  return (
    <div className="page">
      <div className="page-head">
        <div className="title-block">
          <div className="caseno">CASE · SETTINGS</div>
          <h1>Settings</h1>
          <div className="sub">
            Workspace admins see all tabs. You're {activeWsData?.role ?? "a member"}.
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 0, padding: "16px 0 0" }}>
        <aside style={{ padding: "0 12px 16px 24px", display: "grid", gap: 2, alignContent: "start" }}>
          {TABS.map((t) => (
            <div key={t.k} className={`sb-item${tab === t.k ? " active" : ""}`} onClick={() => setTab(t.k)}>
              <IconAt name={t.ic} />
              <span>{t.l}</span>
            </div>
          ))}
        </aside>

        <div style={{ padding: "0 24px 32px", maxWidth: 720 }}>
          {tab === "profile" && user && (
            <div style={{ display: "grid", gap: 22 }}>
              <div className="card">
                <div className="card-hd">
                  <h3>Photo & name</h3>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div className="av av-xl" style={{ background: "var(--ember-500)" }}>
                    {user.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase() ?? "")
                      .join("")}
                  </div>
                  <div style={{ flex: 1, display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-secondary" disabled>
                        Upload
                      </button>
                    </div>
                    <div className="hint">Avatar upload ships with the files module.</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                  <div className="field">
                    <label>Name</label>
                    <input className="input" defaultValue={user.name} disabled />
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input className="input" defaultValue={user.email} disabled />
                  </div>
                </div>
                <div className="hint" style={{ marginTop: 10 }}>
                  Profile edits wire up in the next round.
                </div>
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div className="card">
              <div className="card-hd">
                <h3>What wakes the dogs</h3>
                <span className="caseno">LOCAL PREVIEW</span>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {(
                  [
                    ["mentions", "Direct mentions & replies", "@you, replies to your messages"],
                    ["all", "All new messages", "Every chat you're in. Loud."],
                    ["dm", "Direct messages", "Always notify, even on Do Not Disturb"],
                    ["digest", "Daily digest email", "08:30 local, summary only"],
                    ["push", "Mobile push", "Via APNS / FCM"],
                  ] as [keyof typeof notif, string, string][]
                ).map(([k, t, s]) => (
                  <label
                    key={k}
                    className={`toggle${notif[k] ? " on" : ""}`}
                    onClick={() => setNotif((n) => ({ ...n, [k]: !n[k] }))}
                    style={{ justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--border-soft)" }}
                  >
                    <div>
                      <div style={{ font: "500 13px/1.2 var(--font-sans)" }}>{t}</div>
                      <div className="hint">{s}</div>
                    </div>
                    <div className="toggle-sw" />
                  </label>
                ))}
              </div>
            </div>
          )}

          {tab === "security" && (
            <div className="card">
              <div className="card-hd">
                <h3>Password</h3>
                <span className="chip">
                  <span className="dot" />
                  COMING SOON
                </span>
              </div>
              <div className="hint">The password-change endpoint lands with the full security module.</div>
            </div>
          )}

          {tab === "workspace" && activeWsData && (
            <div style={{ display: "grid", gap: 22 }}>
              <div className="card">
                <div className="card-hd">
                  <h3>Workspace</h3>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="field">
                    <label>Name</label>
                    <input className="input" defaultValue={activeWsData.name} disabled />
                  </div>
                  <div className="field">
                    <label>Slug</label>
                    <input className="input" defaultValue={activeWsData.slug} disabled />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-hd">
                  <h3>Members</h3>
                  <span className="caseno">
                    {membersQuery.data?.items.length ?? 0} ACTIVE
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <input className="input" placeholder="Invite by email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} style={{ flex: 1 }} />
                  <select className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as InviteRole)} style={{ width: 120 }}>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="guest">Guest</option>
                  </select>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      if (!inviteEmail.trim()) return;
                      invite.mutate({ emails: [inviteEmail.trim()], role: inviteRole });
                    }}
                    disabled={invite.isPending}
                  >
                    <Icon.plus size={14} /> Invite
                  </button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <tbody>
                    {membersQuery.data?.items.map((m) => (
                      <tr key={m.userId}>
                        <td style={{ padding: "8px 0", borderTop: "1px solid var(--border-soft)", width: "40%" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="av">{m.name?.[0]?.toUpperCase() ?? "?"}</div>
                            <strong>{m.name ?? m.email}</strong>
                          </div>
                        </td>
                        <td style={{ padding: "8px 0", borderTop: "1px solid var(--border-soft)" }}>
                          <select
                            className="input"
                            style={{ padding: "3px 8px", width: 100 }}
                            defaultValue={m.role}
                            onChange={(e) => changeRole.mutate({ uid: m.userId, role: e.target.value as Role })}
                            disabled={m.role === "owner" && activeWsData.role !== "owner"}
                          >
                            <option value="owner">Owner</option>
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="guest">Guest</option>
                          </select>
                        </td>
                        <td style={{ padding: "8px 0", borderTop: "1px solid var(--border-soft)", color: "var(--fg3)" }}>{m.status}</td>
                        <td style={{ padding: "8px 0", borderTop: "1px solid var(--border-soft)", textAlign: "right" }}>
                          <button className="tb-btn">
                            <Icon.moreH size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "billing" && (
            <div className="card">
              <div className="card-hd">
                <h3>Plan</h3>
                <span className="chip">
                  <span className="dot" />
                  FREE
                </span>
              </div>
              <div className="hint">Billing wires up post-PRD-v1.</div>
            </div>
          )}

          {tab === "integrations" && (
            <div className="card">
              <div className="card-hd">
                <h3>Integrations</h3>
                <span className="chip">
                  <span className="dot" />
                  DEFERRED
                </span>
              </div>
              <div className="hint">Slack / GitHub / Figma / Drive are explicitly out of scope for v1.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
