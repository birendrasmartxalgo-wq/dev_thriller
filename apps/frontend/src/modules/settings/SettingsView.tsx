// Full settings panel — Profile, Notifications (prefs PATCH), Security (password + sessions),
// Workspace (name + retention), Billing/Integrations placeholders.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/Icons";
import { useSession } from "@/store/session";
import { workspaceApi, authApi } from "@/api/endpoints";
import { userApi, workspaceAdminApi } from "@/api/adminApi";
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

const IconOf = ({ name, size = 16 }: { name: keyof typeof Icon; size?: number }) => {
  const C = Icon[name];
  return <C size={size} />;
};

export function SettingsView() {
  const [tab, setTab] = useState<Tab>("profile");
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const activeWs = useSession((s) => s.activeWorkspaceId);
  const workspaces = useSession((s) => s.workspaces);
  const activeWsData = workspaces.find((w) => w.id === activeWs);

  return (
    <div className="page">
      <div className="page-head">
        <div className="title-block">
          <div className="caseno">CASE · SETTINGS</div>
          <h1>Settings</h1>
          <div className="sub">Workspace admins see all tabs. You're {activeWsData?.role ?? "a member"}.</div>
        </div>
      </div>
      <div className="dt-rail-body" style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 0, padding: "16px 0 0" }}>
        <aside
          className="dt-settings-rail"
          style={{ padding: "0 12px 16px 24px", display: "grid", gap: 2, alignContent: "start" }}
          aria-label="Settings sections"
          role="tablist"
        >
          {TABS.map((t) => (
            <button
              key={t.k}
              type="button"
              role="tab"
              aria-selected={tab === t.k}
              className={`sb-item${tab === t.k ? " active" : ""}`}
              onClick={() => setTab(t.k)}
              style={{ border: 0, background: "transparent", textAlign: "left", width: "100%" }}
            >
              <IconOf name={t.ic} />
              <span>{t.l}</span>
            </button>
          ))}
        </aside>

        <div style={{ padding: "0 24px 32px", maxWidth: 720 }}>
          {tab === "profile" && user && <ProfileTab user={user} onUpdated={(u) => setUser(u)} />}
          {tab === "notifications" && user && <NotificationsTab />}
          {tab === "security" && <SecurityTab />}
          {tab === "workspace" && activeWsData && <WorkspaceTab />}

          {tab === "billing" && (
            <div className="card">
              <div className="card-hd">
                <h3>Plan</h3>
                <span className="chip">
                  <span className="dot" />
                  {activeWsData?.plan.toUpperCase() ?? "FREE"}
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

function ProfileTab({ user, onUpdated }: { user: { id: string; email: string; name: string; avatarUrl?: string | null }; onUpdated: (u: any) => void }) {
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await userApi.patchMe({ name: name.trim() });
      const me = await authApi.me();
      onUpdated(me);
      toast("Profile updated");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card">
      <div className="card-hd">
        <h3>Photo & name</h3>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div className="av av-xl" style={{ background: "var(--ember-500)" }}>
          {user.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")}
        </div>
        <div style={{ flex: 1 }}>
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const fd = new FormData();
                fd.append("file", f);
                const res = await fetch("/v1/users/me/avatar", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${localStorage.getItem("dt.access") ?? ""}` },
                  body: fd,
                });
                if (!res.ok) throw new Error("upload failed");
                toast("Avatar updated");
                onUpdated(await authApi.me());
              } catch (err) {
                toast((err as Error).message, "error");
              }
            }}
          />
          <div className="hint">SVG, PNG, JPG · 1 MB max.</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div className="field">
          <label>Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input className="input" defaultValue={user.email} disabled />
        </div>
      </div>
      <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? <span className="spinner" /> : "Save"}
        </button>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [notif, setNotif] = useState({ mentions: true, all: false, dm: true, digest: true, push: false });
  async function save(next: typeof notif) {
    setNotif(next);
    try {
      await userApi.patchMe({ notifPrefs: next });
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  return (
    <div className="card">
      <div className="card-hd">
        <h3>What wakes the dogs</h3>
        <span className="caseno">SAVED SERVER-SIDE</span>
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
            onClick={() => save({ ...notif, [k]: !notif[k] })}
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
  );
}

function SecurityTab() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [conf, setConf] = useState("");
  const [busy, setBusy] = useState(false);
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: userApi.sessions });
  const qc = useQueryClient();
  const revoke = useMutation({
    mutationFn: (id: string) => userApi.revokeSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
  const revokeAll = useMutation({
    mutationFn: () => userApi.revokeAllSessions(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });

  async function change() {
    if (next !== conf) {
      toast("Passwords do not match", "error");
      return;
    }
    if (next.length < 8) {
      toast("New password must be ≥ 8 chars", "error");
      return;
    }
    setBusy(true);
    try {
      await userApi.changePassword({ currentPassword: cur, newPassword: next });
      toast("Password changed. Other sessions signed out.");
      setCur("");
      setNext("");
      setConf("");
      qc.invalidateQueries({ queryKey: ["sessions"] });
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div className="card">
        <div className="card-hd">
          <h3>Password</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          <div className="field">
            <label>Current</label>
            <input className="input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
          </div>
          <div className="field">
            <label>New</label>
            <input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="field">
            <label>Confirm</label>
            <input className="input" type="password" value={conf} onChange={(e) => setConf(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={change} disabled={busy || !cur || !next || !conf}>
            {busy ? <span className="spinner" /> : "Update password"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <h3>Active sessions</h3>
          <span className="caseno">{sessions.data?.items.length ?? 0} DEVICES</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" style={{ color: "var(--blood-700)" }} onClick={() => revokeAll.mutate()} disabled={revokeAll.isPending}>
            Revoke all
          </button>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          {sessions.data?.items.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i === 0 ? 0 : "1px solid var(--border-soft)" }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--ink-700)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon.shield size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ font: "500 13px/1.2 var(--font-sans)" }}>{s.userAgent ?? "Unknown device"}</div>
                <div className="caseno" style={{ marginTop: 3, textTransform: "none", letterSpacing: 0 }}>
                  {s.ip ?? "—"} · Expires {new Date(s.expiresAt).toLocaleDateString()}
                </div>
              </div>
              <button className="btn btn-ghost" style={{ color: "var(--blood-700)" }} onClick={() => revoke.mutate(s.id)}>
                Revoke
              </button>
            </div>
          ))}
          {!sessions.data?.items.length && <div className="hint">No other active sessions.</div>}
        </div>
      </div>
    </div>
  );
}

function WorkspaceTab() {
  const activeWs = useSession((s) => s.activeWorkspaceId)!;
  const wsDetail = useQuery({
    queryKey: ["ws-detail", activeWs],
    // workspaceApi.get returns the canonical WorkspaceDetail; the extra `retention`
    // field is added by the backend GET /v1/workspaces/:id route. Cast once here.
    queryFn: async () =>
      (await workspaceApi.get(activeWs)) as unknown as {
        id: string;
        name: string;
        slug: string;
        caseNumber: string;
        plan: string;
        role: Role;
        retention: { messagesDays?: number; filesDays?: number } | null;
      },
  });
  const [name, setName] = useState("");
  const [msgDays, setMsgDays] = useState(365);
  const [fileDays, setFileDays] = useState(0);
  useEffect(() => {
    if (wsDetail.data) {
      setName(wsDetail.data.name);
      setMsgDays(wsDetail.data.retention?.messagesDays ?? 365);
      setFileDays(wsDetail.data.retention?.filesDays ?? 0);
    }
  }, [wsDetail.data]);

  const members = useQuery({ queryKey: ["members", activeWs], queryFn: () => workspaceApi.members(activeWs), enabled: Boolean(activeWs) });
  const qc = useQueryClient();

  const patch = useMutation({
    mutationFn: () => workspaceAdminApi.patch(activeWs, { name: name.trim(), retention: { messagesDays: msgDays, filesDays: fileDays } }),
    onSuccess: () => {
      toast("Workspace updated");
      qc.invalidateQueries({ queryKey: ["ws-detail", activeWs] });
      qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (e) => toast((e as Error).message, "error"),
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("member");
  const invite = useMutation({
    mutationFn: (body: { emails: string[]; role: InviteRole }) => workspaceApi.invite(activeWs, body),
    onSuccess: (r) => {
      toast(`Sent ${r.invites.length} invite${r.invites.length === 1 ? "" : "s"}`);
      setInviteEmail("");
    },
    onError: (e) => toast((e as Error).message, "error"),
  });

  const changeRole = useMutation({
    mutationFn: ({ uid, role }: { uid: string; role: Role }) =>
      // Owner role can't be assigned via this endpoint; backend validates and
      // rejects. Narrow the type to satisfy the typed wrapper signature.
      workspaceAdminApi.changeMemberRole(activeWs, uid, role as "admin" | "member" | "guest"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", activeWs] }),
    onError: (e) => toast((e as Error).message, "error"),
  });

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div className="card">
        <div className="card-hd">
          <h3>Workspace</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label>Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Slug</label>
            <input className="input" defaultValue={wsDetail.data?.slug ?? ""} disabled />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <h3>Retention</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label>Chat messages</label>
            <select className="input" value={msgDays} onChange={(e) => setMsgDays(Number(e.target.value))}>
              <option value={0}>Forever</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
              <option value={365}>365 days</option>
              <option value={730}>2 years</option>
            </select>
          </div>
          <div className="field">
            <label>Deleted files (hard-delete)</label>
            <select className="input" value={fileDays} onChange={(e) => setFileDays(Number(e.target.value))}>
              <option value={0}>Keep soft-deleted forever</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>365 days</option>
            </select>
          </div>
        </div>
        <div className="hint" style={{ marginTop: 10 }}>
          The retention worker enforces these. Run <code>bun run --cwd apps/workers retention -- --apply</code> to sweep now.
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={() => patch.mutate()} disabled={patch.isPending}>
          {patch.isPending ? <span className="spinner" /> : "Save workspace"}
        </button>
      </div>

      <div className="card">
        <div className="card-hd">
          <h3>Members</h3>
          <span className="caseno">{members.data?.items.length ?? 0} ACTIVE</span>
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
            {members.data?.items.map((m) => (
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
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="guest">Guest</option>
                  </select>
                </td>
                <td style={{ padding: "8px 0", borderTop: "1px solid var(--border-soft)", color: "var(--fg3)" }}>{m.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
