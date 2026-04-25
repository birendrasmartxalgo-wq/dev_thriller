// Notifications inbox + saved-search "smart folders".
// Live notification updates via the user topic on the shared WebSocket.
// Default saved searches are seeded once per user/workspace (tracked in localStorage).

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationApi, savedSearchApi, type NotificationItem, type SavedSearch } from "@/api/adminApi";
import { searchApi } from "@/api/endpoints";
import { Icon } from "@/components/Icons";
import { useSession } from "@/store/session";
import { tokenStore } from "@/api/client";
import { navigate } from "@/router";

const NOTIF_FILTERS: [string, string][] = [
  ["all", "All"],
  ["mention", "Mentions"],
  ["reply", "Replies"],
  ["dm", "DMs"],
  ["file", "Files"],
  ["admin", "Admin"],
];

type RailItem = { kind: "notifications"; key: string; name: string } | { kind: "saved"; key: string; saved: SavedSearch };

export function InboxView() {
  const activeWs = useSession((s) => s.activeWorkspaceId);
  const user = useSession((s) => s.user);
  const qc = useQueryClient();

  // Active rail item ("notifications" or `saved:<id>`).
  const [active, setActive] = useState<string>("notifications");
  // Notification kind sub-filter (only used when active === "notifications").
  const [notifKind, setNotifKind] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);

  // ---- Saved searches ----
  const savedQuery = useQuery({
    queryKey: ["savedSearches", activeWs],
    queryFn: () => savedSearchApi.list(activeWs!),
    enabled: Boolean(activeWs),
  });

  const createSaved = useMutation({
    mutationFn: (body: { name: string; query: string }) =>
      savedSearchApi.create({ workspaceId: activeWs!, name: body.name, query: body.query }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["savedSearches", activeWs] }),
  });

  const removeSaved = useMutation({
    mutationFn: (id: string) => savedSearchApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["savedSearches", activeWs] }),
  });

  // Seed defaults once per user+workspace. Idempotent via localStorage flag.
  useEffect(() => {
    if (!activeWs || !user || !savedQuery.data) return;
    const flagKey = `dt.savedDefaults.${activeWs}.${user.id}`;
    if (localStorage.getItem(flagKey) === "1") return;
    if (savedQuery.data.items.length > 0) {
      // User already has at least one — don't seed.
      localStorage.setItem(flagKey, "1");
      return;
    }
    localStorage.setItem(flagKey, "1");
    const handle = user.email.split("@")[0] || user.name || "you";
    const defaults: { name: string; query: string }[] = [
      { name: "My @mentions", query: `@${handle}` },
      { name: "Files I uploaded", query: `from:@${handle} has:file` },
      { name: "Unanswered DMs", query: `to:@${handle} has:dm` },
    ];
    void Promise.all(defaults.map((d) => savedSearchApi.create({ workspaceId: activeWs, ...d })))
      .then(() => qc.invalidateQueries({ queryKey: ["savedSearches", activeWs] }))
      .catch(() => {
        /* swallow — user can still create them manually */
      });
  }, [activeWs, user, savedQuery.data, qc]);

  // ---- Notifications ----
  const list = useQuery({
    queryKey: ["notifications", activeWs, notifKind],
    queryFn: () =>
      notificationApi.list({
        workspaceId: activeWs ?? undefined,
        kind: notifKind === "all" ? undefined : notifKind,
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

  // Build rail.
  const rail: RailItem[] = useMemo(() => {
    const r: RailItem[] = [{ kind: "notifications", key: "notifications", name: "Notifications" }];
    for (const s of savedQuery.data?.items ?? []) {
      r.push({ kind: "saved", key: `saved:${s.id}`, saved: s });
    }
    return r;
  }, [savedQuery.data]);

  const activeSaved = useMemo(() => {
    if (!active.startsWith("saved:")) return null;
    const id = active.slice(6);
    return savedQuery.data?.items.find((s) => s.id === id) ?? null;
  }, [active, savedQuery.data]);

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
        {active === "notifications" && (
          <button className="btn btn-secondary" onClick={() => readAll.mutate()} disabled={readAll.isPending || unreadCount === 0}>
            Mark all read
          </button>
        )}
      </div>

      <div className="page-body" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}>
        <aside style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <div style={{ display: "grid", gap: 2 }}>
            <div className="caseno" style={{ padding: "4px 8px", color: "var(--fg3)" }}>SMART FOLDERS</div>
            {rail.map((it) => {
              const isActive = active === it.key;
              const name = it.kind === "notifications" ? it.name : it.saved.name;
              const badge = it.kind === "notifications" ? unreadCount : null;
              return (
                <div
                  key={it.key}
                  className={`sb-item${isActive ? " active" : ""}`}
                  onClick={() => setActive(it.key)}
                  style={{ position: "relative" }}
                >
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                  {badge !== null && badge > 0 && (
                    <span className="count" style={{ fontFamily: "var(--font-mono)" }}>{badge}</span>
                  )}
                  {it.kind === "saved" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete saved search "${it.saved.name}"?`)) {
                          if (active === it.key) setActive("notifications");
                          removeSaved.mutate(it.saved.id);
                        }
                      }}
                      title="Delete saved search"
                      style={{
                        background: "transparent",
                        border: 0,
                        color: "var(--fg3)",
                        cursor: "pointer",
                        padding: 2,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <Icon.trash size={12} />
                    </button>
                  )}
                </div>
              );
            })}
            <button
              className="btn btn-ghost"
              onClick={() => setShowNew(true)}
              style={{ marginTop: 6, justifyContent: "flex-start", gap: 6, fontSize: 12 }}
            >
              <Icon.plus size={12} /> New saved search
            </button>
          </div>

          {active === "notifications" && (
            <div style={{ display: "grid", gap: 2 }}>
              <div className="caseno" style={{ padding: "4px 8px", color: "var(--fg3)" }}>FILTER</div>
              {NOTIF_FILTERS.map(([k, l]) => (
                <div key={k} className={`sb-item${notifKind === k ? " active" : ""}`} onClick={() => setNotifKind(k)}>
                  <span style={{ flex: 1 }}>{l}</span>
                  <span className="count" style={{ fontFamily: "var(--font-mono)" }}>
                    {filterCounts[k] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </aside>

        {active === "notifications" ? (
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((n) => {
              const seen = Boolean(n.readAt);
              const snippet = (n.payload.snippet as string | undefined) ?? "";
              const chatName = (n.payload.chatName as string | undefined) ?? "";
              return (
                <div
                  key={n.id}
                  onClick={() => openNotif(n)}
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
                    {!seen && <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--ember-500)" }} />}
                  </div>
                </div>
              );
            })}

            {items.length === 0 && !list.isLoading && (
              <div className="empty">
                <div className="title">All clear.</div>
                <div className="sub">No mentions, replies, or DMs waiting.</div>
              </div>
            )}
          </div>
        ) : activeSaved ? (
          <SavedSearchPanel saved={activeSaved} workspaceId={activeWs!} />
        ) : (
          <div className="empty">
            <div className="title">No folder.</div>
            <div className="sub">Pick a smart folder from the left.</div>
          </div>
        )}
      </div>

      {showNew && (
        <NewSavedSearchModal
          onClose={() => setShowNew(false)}
          onSave={(name, query) => {
            createSaved.mutate({ name, query });
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
}

// ---- Saved search results panel ----

function SavedSearchPanel({ saved, workspaceId }: { saved: SavedSearch; workspaceId: string }) {
  const result = useQuery({
    queryKey: ["search", workspaceId, saved.query],
    queryFn: () => searchApi.query({ q: saved.query, workspaceId, type: "all", limit: 50 }),
    staleTime: 30_000, // 30s cache (covers the unread-count caching requirement).
  });

  const messages = result.data?.messages ?? [];
  const files = result.data?.files ?? [];
  const empty = messages.length + files.length === 0;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px solid var(--border-soft)", borderRadius: 10 }}>
        <Icon.search size={14} />
        <div>
          <div style={{ font: "500 13px/1.2 var(--font-sans)" }}>{saved.name}</div>
          <div style={{ font: "400 11px/1.2 var(--font-mono)", color: "var(--fg3)", marginTop: 3 }}>{saved.query || "(empty query)"}</div>
        </div>
        <div style={{ flex: 1 }} />
        <span className="caseno" style={{ color: "var(--fg3)" }}>
          {messages.length} MSG · {files.length} FILE
        </span>
      </div>

      {result.isLoading && <div style={{ font: "400 12px/1 var(--font-mono)", color: "var(--fg3)" }}>Running search…</div>}

      {messages.map((m) => (
        <div
          key={m.id}
          onClick={() => navigate(`/c/${m.chatId}`)}
          style={{
            display: "grid",
            gridTemplateColumns: "36px 1fr auto",
            gap: 12,
            padding: 14,
            border: "1px solid var(--border-soft)",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          <div className="av av-lg" style={{ background: "var(--ink-700)" }}>
            <Icon.chat size={14} />
          </div>
          <div>
            <div style={{ font: "400 13px/1.5 var(--font-sans)" }}>{m.body}</div>
          </div>
          <span className="caseno">{new Date(m.createdAt).toLocaleString().toUpperCase()}</span>
        </div>
      ))}

      {files.map((f) => (
        <div
          key={f.id}
          onClick={() => navigate(`/files`)}
          style={{
            display: "grid",
            gridTemplateColumns: "36px 1fr auto",
            gap: 12,
            padding: 14,
            border: "1px solid var(--border-soft)",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          <div className="av av-lg" style={{ background: "var(--mint-500)" }}>
            <Icon.file size={14} />
          </div>
          <div>
            <div style={{ font: "500 13px/1.3 var(--font-sans)" }}>{f.name}</div>
            <div style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg3)", marginTop: 3 }}>{f.mime}</div>
          </div>
          <span className="caseno">{new Date(f.createdAt).toLocaleString().toUpperCase()}</span>
        </div>
      ))}

      {empty && !result.isLoading && (
        <div className="empty">
          <div className="title">No matches.</div>
          <div className="sub">Tweak the query or save a new one.</div>
        </div>
      )}
    </div>
  );
}

// ---- New saved-search modal ----

function NewSavedSearchModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string, query: string) => void }) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit() {
    if (!name.trim() || !query.trim()) return;
    onSave(name.trim(), query.trim());
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="New saved search">
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-soft)" }}>
          <div className="caseno">NEW · SAVED SEARCH</div>
          <div style={{ font: "500 16px/1.2 var(--font-sans)", marginTop: 6 }}>Lock a search to your inbox.</div>
        </div>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="caseno">NAME</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Open threads"
              className="input"
              style={{
                padding: "8px 10px",
                border: "1px solid var(--border-soft)",
                borderRadius: 6,
                font: "400 14px/1 var(--font-sans)",
                background: "var(--paper-0)",
                color: "var(--fg1)",
              }}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="caseno">QUERY</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g. from:@you has:file after:2026-01-01'
              className="input"
              style={{
                padding: "8px 10px",
                border: "1px solid var(--border-soft)",
                borderRadius: 6,
                font: "400 14px/1 var(--font-mono)",
                background: "var(--paper-0)",
                color: "var(--fg1)",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            <span style={{ font: "400 11px/1.4 var(--font-mono)", color: "var(--fg3)" }}>
              DSL: from:@user · has:file|image|video|doc · before:YYYY-MM-DD · after:YYYY-MM-DD · in:chatId
            </span>
          </label>
        </div>
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border-soft)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!name.trim() || !query.trim()}>Save</button>
        </div>
      </div>
    </div>
  );
}
