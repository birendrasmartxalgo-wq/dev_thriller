// Admin page: audit log + verify + storage + users. All live from /v1/admin/*.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/store/session";
import { adminApi } from "@/api/adminApi";
import { Icon } from "@/components/Icons";
import { formatBytes } from "@/lib/upload";
import { toast } from "@/store/toast";

type Tab = "audit" | "storage" | "users";
const TABS: { k: Tab; l: string }[] = [
  { k: "audit", l: "Audit" },
  { k: "storage", l: "Storage" },
  { k: "users", l: "Users" },
];

export function AdminView() {
  const [tab, setTab] = useState<Tab>("audit");
  const activeWs = useSession((s) => s.activeWorkspaceId)!;
  const qc = useQueryClient();

  const audit = useQuery({
    queryKey: ["audit", activeWs],
    queryFn: () => adminApi.audit({ workspaceId: activeWs, limit: 200 }),
    enabled: Boolean(activeWs) && tab === "audit",
  });
  const verify = useMutation({
    mutationFn: () => adminApi.auditVerify(activeWs),
    onSuccess: (r) => {
      toast(r.ok ? "Chain verified ✓" : `Chain broken at ${r.brokenAt}`, r.ok ? "info" : "error");
    },
  });

  const storage = useQuery({
    queryKey: ["admin-storage", activeWs],
    queryFn: () => adminApi.storage(activeWs),
    enabled: Boolean(activeWs) && tab === "storage",
  });

  const users = useQuery({
    queryKey: ["admin-users", activeWs],
    queryFn: () => adminApi.users(activeWs),
    enabled: Boolean(activeWs) && tab === "users",
  });
  const suspend = useMutation({
    mutationFn: ({ uid, on }: { uid: string; on: boolean }) => adminApi.suspend(uid, activeWs, on),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users", activeWs] }),
  });

  return (
    <div className="page">
      <div className="page-head">
        <div className="title-block">
          <div className="caseno">CASE · ADMIN</div>
          <h1>Admin</h1>
          <div className="sub">Audit chain, storage, and user controls. Admin-only.</div>
        </div>
        <div className="seg">
          {TABS.map((t) => (
            <button key={t.k} className={tab === t.k ? "on" : ""} onClick={() => setTab(t.k)}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {tab === "audit" && (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <button className="btn btn-primary" onClick={() => verify.mutate()} disabled={verify.isPending}>
                <Icon.shield size={14} /> {verify.isPending ? "Walking…" : "Verify chain"}
              </button>
              <div className="caseno">HASH CHAIN · SHA256</div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["When", "Actor", "Verb", "Object", "Hash"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "0 10px 8px",
                        borderBottom: "1px solid var(--border-soft)",
                        font: "500 10px/1 var(--font-mono)",
                        letterSpacing: ".14em",
                        textTransform: "uppercase",
                        color: "var(--fg3)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.data?.items.map((a) => (
                  <tr key={a.id}>
                    <td style={{ padding: "8px 10px", borderTop: "1px solid var(--border-soft)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "8px 10px", borderTop: "1px solid var(--border-soft)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                      {a.actorId.slice(-6)}
                    </td>
                    <td style={{ padding: "8px 10px", borderTop: "1px solid var(--border-soft)" }}>
                      <span className="chip">
                        <span className="dot" />
                        {a.verb.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", borderTop: "1px solid var(--border-soft)", color: "var(--fg2)" }}>
                      {a.objectType}
                      {a.objectId ? ` · ${a.objectId.slice(-6)}` : ""}
                    </td>
                    <td
                      style={{
                        padding: "8px 10px",
                        borderTop: "1px solid var(--border-soft)",
                        color: "var(--fg3)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                      }}
                    >
                      {a.hash.slice(0, 12)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {tab === "storage" && storage.data && (
          <div style={{ display: "grid", gap: 14 }}>
            <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              <div>
                <div className="caseno">TOTAL BYTES</div>
                <div style={{ font: "700 28px/1.1 var(--font-sans)", marginTop: 8 }}>{formatBytes(storage.data.totalBytes)}</div>
              </div>
              <div>
                <div className="caseno">TOTAL FILES</div>
                <div style={{ font: "700 28px/1.1 var(--font-sans)", marginTop: 8 }}>{storage.data.totalFiles}</div>
              </div>
            </div>

            <div className="card">
              <div className="card-hd">
                <h3>By mime</h3>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <tbody>
                  {storage.data.byMime.map((r) => (
                    <tr key={r.mime}>
                      <td style={{ padding: "6px 10px", borderTop: "1px solid var(--border-soft)", fontFamily: "var(--font-mono)" }}>{r.mime ?? "—"}</td>
                      <td style={{ padding: "6px 10px", borderTop: "1px solid var(--border-soft)", fontFamily: "var(--font-mono)" }}>{r.count}</td>
                      <td
                        style={{
                          padding: "6px 10px",
                          borderTop: "1px solid var(--border-soft)",
                          fontFamily: "var(--font-mono)",
                          textAlign: "right",
                        }}
                      >
                        {formatBytes(r.size)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "users" && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["User", "Email", "Role", "Status", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "0 10px 8px",
                      borderBottom: "1px solid var(--border-soft)",
                      font: "500 10px/1 var(--font-mono)",
                      letterSpacing: ".14em",
                      textTransform: "uppercase",
                      color: "var(--fg3)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.data?.items.map((u) => {
                const suspended = u.status === "suspended";
                return (
                  <tr key={u.userId}>
                    <td style={{ padding: "8px 10px", borderTop: "1px solid var(--border-soft)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="av">{u.name?.[0]?.toUpperCase() ?? "?"}</div>
                        <strong>{u.name ?? u.email}</strong>
                      </div>
                    </td>
                    <td style={{ padding: "8px 10px", borderTop: "1px solid var(--border-soft)", fontFamily: "var(--font-mono)", color: "var(--fg2)" }}>
                      {u.email}
                    </td>
                    <td style={{ padding: "8px 10px", borderTop: "1px solid var(--border-soft)" }}>{u.role}</td>
                    <td style={{ padding: "8px 10px", borderTop: "1px solid var(--border-soft)" }}>
                      <span className={`chip${suspended ? " danger" : " success"}`}>
                        <span className="dot" />
                        {u.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", borderTop: "1px solid var(--border-soft)", textAlign: "right" }}>
                      <button
                        className="btn btn-ghost"
                        style={{ color: suspended ? "var(--fg-success)" : "var(--blood-700)" }}
                        onClick={() => suspend.mutate({ uid: u.userId, on: !suspended })}
                      >
                        {suspended ? "Unsuspend" : "Suspend"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
