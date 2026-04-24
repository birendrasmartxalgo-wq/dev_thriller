// Notifications inbox. Driven by /v1/notifications; live updates via the user
// topic on the shared WebSocket.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationApi, type NotificationItem } from "@/api/adminApi";
import { useSession } from "@/store/session";
import { RowSkeleton } from "@/components/Skeletons";
import { tokenStore } from "@/api/client";
import { navigate } from "@/router";

const FILTERS: [string, string][] = [
  ["all", "All"],
  ["mention", "Mentions"],
  ["reply", "Replies"],
  ["dm", "DMs"],
  ["file", "Files"],
  ["admin", "Admin"],
];

export function InboxView() {
  const activeWs = useSession((s) => s.activeWorkspaceId);
  const [filter, setFilter] = useState<string>("all");
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["notifications", activeWs, filter],
    queryFn: () =>
      notificationApi.list({
        workspaceId: activeWs ?? undefined,
        kind: filter === "all" ? undefined : filter,
        limit: 200,
      }),
  });

  const read = useMutation({
    mutationFn: (id: string) => notificationApi.read(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const readAll = useMutation({
    mutationFn: () => notificationApi.readAll(activeWs ?? undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Live updates: open a WS and invalidate on push.
  useEffect(() => {
    const access = tokenStore.access;
    if (!access) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/v1/ws?token=${encodeURIComponent(access)}`);
    ws.addEventListener("message", (ev) => {
      try {
        const p = JSON.parse(String(ev.data));
        if (p?.type === "notification.created") qc.invalidateQueries({ queryKey: ["notifications"] });
      } catch {
        /* ignore */
      }
    });
    return () => ws.close();
  }, [qc]);

  const items = list.data?.items ?? [];
  const unreadCount = useMemo(() => items.filter((i) => !i.readAt).length, [items]);

  function openNotif(n: NotificationItem) {
    void read.mutate(n.id);
    const chatId = n.payload.chatId as string | undefined;
    if (chatId) navigate(`/c/${chatId}`);
  }

  const filterCounts = useMemo(() => {
    const m: Record<string, number> = { all: items.length };
    for (const i of items) m[i.kind] = (m[i.kind] ?? 0) + 1;
    return m;
  }, [items]);

  return (
    <div className="page">
      <div className="page-head">
        <div className="title-block">
          <div className="caseno">CASE · INBOX</div>
          <h1>
            Inbox{" "}
            <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400, color: "var(--fg3)", fontSize: 20, marginLeft: 8 }}>
              {unreadCount} unread
            </span>
          </h1>
        </div>
        <button className="btn btn-secondary" onClick={() => readAll.mutate()} disabled={readAll.isPending || unreadCount === 0}>
          Mark all read
        </button>
      </div>

      <div className="page-body dt-rail-body" style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 20 }}>
        <aside className="dt-settings-rail" style={{ display: "grid", gap: 2, alignContent: "start" }} aria-label="Inbox filters">
          {FILTERS.map(([k, l]) => (
            <button
              key={k}
              type="button"
              className={`sb-item${filter === k ? " active" : ""}`}
              onClick={() => setFilter(k)}
              aria-pressed={filter === k}
              style={{ border: 0, background: "transparent", textAlign: "left", width: "100%" }}
            >
              <span style={{ flex: 1 }}>{l}</span>
              <span className="count" style={{ fontFamily: "var(--font-mono)" }}>
                {filterCounts[k] ?? 0}
              </span>
            </button>
          ))}
        </aside>

        <div style={{ display: "grid", gap: 8 }}>
          {list.isLoading && items.length === 0 && (
            <div style={{ display: "grid", gap: 8 }} aria-hidden="true">
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </div>
          )}
          {items.map((n) => {
            const seen = Boolean(n.readAt);
            const snippet = (n.payload.snippet as string | undefined) ?? "";
            const chatName = (n.payload.chatName as string | undefined) ?? "";
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => openNotif(n)}
                aria-label={`Open ${n.kind} notification${seen ? "" : " (unread)"}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px 1fr auto",
                  gap: 12,
                  padding: "14px",
                  border: "1px solid var(--border-soft)",
                  borderRadius: 10,
                  background: seen ? "var(--paper-0)" : "var(--ember-50)",
                  cursor: "pointer",
                  borderLeft: seen ? "1px solid var(--border-soft)" : "3px solid var(--ember-500)",
                  textAlign: "left",
                  font: "inherit",
                  color: "inherit",
                  width: "100%",
                }}
              >
                <div
                  className="av av-lg"
                  style={{
                    background:
                      n.kind === "mention" ? "var(--ember-500)" : n.kind === "dm" ? "var(--lav-500)" : n.kind === "file" ? "var(--mint-500)" : "var(--ink-700)",
                  }}
                >
                  {n.kind === "mention" ? "@" : n.kind === "reply" ? "↩" : n.kind === "dm" ? "✉" : n.kind === "file" ? "✓" : "·"}
                </div>
                <div>
                  <div style={{ font: "400 13px/1.4 var(--font-sans)" }}>
                    <strong>{n.kind.toUpperCase()}</strong>
                    {chatName && (
                      <>
                        {" "}
                        in <span style={{ color: "var(--ember-700)", fontFamily: "var(--font-mono)", fontSize: 12 }}>#{chatName}</span>
                      </>
                    )}
                  </div>
                  {snippet && <div style={{ font: "400 13px/1.5 var(--font-sans)", color: "var(--fg1)", marginTop: 4 }}>{snippet}</div>}
                </div>
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <span className="caseno">{new Date(n.createdAt).toLocaleString().toUpperCase()}</span>
                  {!seen && <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--ember-500)" }} aria-hidden="true" />}
                </div>
              </button>
            );
          })}

          {items.length === 0 && !list.isLoading && (
            <div className="empty">
              <div className="title">All clear.</div>
              <div className="sub">No mentions, replies, or DMs waiting.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
