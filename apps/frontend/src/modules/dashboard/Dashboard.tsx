import { useState } from "react";
import { useSession } from "@/store/session";
import { useQuery } from "@tanstack/react-query";
import { chatApi, workspaceApi } from "@/api/endpoints";
import { Link } from "@/router";
import { PresenceDot } from "@/components/PresenceDot";
import { Icon } from "@/components/Icons";

export function Dashboard() {
  const user = useSession((s) => s.user);
  const active = useSession((s) => s.activeWorkspaceId);
  const [showArchived, setShowArchived] = useState(false);

  const membersQuery = useQuery({
    queryKey: ["members", active],
    queryFn: () => workspaceApi.members(active!),
    enabled: Boolean(active),
  });

  const presenceQuery = useQuery({
    queryKey: ["presence", active],
    queryFn: () => workspaceApi.presence(active!),
    enabled: Boolean(active),
    refetchInterval: 30_000,
  });

  const archivedQuery = useQuery({
    queryKey: ["chats-archived", active],
    queryFn: () => chatApi.list(active!, undefined, { includeArchived: true }),
    enabled: Boolean(active) && showArchived,
  });

  const archivedChats = (archivedQuery.data?.items ?? []).filter((c) => c.archivedAt);

  return (
    <div className="page">
      <div className="page-head">
        <div className="title-block">
          <div className="caseno">CASE · DASHBOARD</div>
          <h1>Good morning, {user?.name ?? "detective"}.</h1>
          <div className="sub">Welcome back. The chain is intact.</div>
        </div>
      </div>
      <div className="page-body" style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <div className="card-hd">
            <h3>Your case file</h3>
            <div className="caseno">/ME</div>
          </div>
          <div style={{ display: "grid", gap: 6, font: "400 13px/1.5 var(--font-sans)" }}>
            <div>
              <span style={{ color: "var(--fg3)" }}>email · </span>
              {user?.email}
            </div>
            <div>
              <span style={{ color: "var(--fg3)" }}>since · </span>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-hd">
            <h3>Members in this workspace</h3>
            <div className="caseno">/WORKSPACE</div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {membersQuery.data?.items.map((m) => (
              <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ position: "relative" }}>
                  <div className="av">{m.name?.[0]?.toUpperCase() ?? "?"}</div>
                  <div style={{ position: "absolute", right: -1, bottom: -1 }}>
                    <PresenceDot status={presenceQuery.data?.[m.userId]} size={8} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: "600 13px/1.2 var(--font-sans)" }}>{m.name ?? m.email}</div>
                  <div className="caseno" style={{ marginTop: 2 }}>
                    {m.role.toUpperCase()} · {m.status.toUpperCase()}
                  </div>
                </div>
              </div>
            ))}
            {!membersQuery.data?.items.length && !membersQuery.isLoading && (
              <div style={{ color: "var(--fg3)" }}>No members yet.</div>
            )}
          </div>
        </div>

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-hd">
            <h3>Archived chats</h3>
            <div className="caseno">/ARCHIVE</div>
            <div style={{ flex: 1 }} />
            <button
              className={`btn btn-ghost${showArchived ? " on" : ""}`}
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? "Hide" : "View archived"}
            </button>
          </div>
          {showArchived && (
            <div style={{ display: "grid", gap: 6 }}>
              {archivedChats.length === 0 && !archivedQuery.isLoading && (
                <div style={{ color: "var(--fg3)", font: "400 13px/1.5 var(--font-sans)" }}>
                  No archived chats. Clean chain.
                </div>
              )}
              {archivedChats.map((c) => (
                <Link
                  key={c.id}
                  to={`/c/${c.id}`}
                  className="sb-item"
                  style={{ padding: "6px 10px", borderRadius: 8 }}
                >
                  <Icon.hash size={14} />
                  <span style={{ flex: 1 }}>{c.name}</span>
                  <span className="caseno">
                    ARCHIVED · {c.archivedAt ? new Date(c.archivedAt).toLocaleDateString() : "—"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
