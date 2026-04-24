// ⌘K command palette.
// Fuzzy-matches against cached sidebar items (workspaces, chats, static actions);
// debounced backend search for messages + files when query length ≥ 2.

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { chatApi, searchApi } from "@/api/endpoints";
import { useSession } from "@/store/session";
import { Icon } from "@/components/Icons";
import { navigate } from "@/router";

type Item = {
  id: string;
  icon: keyof typeof Icon;
  name: string;
  sub: string;
  run: () => void;
  group: string;
};

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const workspaces = useSession((s) => s.workspaces);
  const activeWs = useSession((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useSession((s) => s.setActiveWorkspace);

  const chatsQuery = useQuery({
    queryKey: ["chats", activeWs],
    queryFn: () => chatApi.list(activeWs!),
    enabled: Boolean(activeWs),
    staleTime: 15_000,
  });

  const searchQuery = useQuery({
    queryKey: ["palette-search", activeWs, q],
    queryFn: () => searchApi.query({ q, workspaceId: activeWs!, limit: 12 }),
    enabled: Boolean(activeWs) && q.trim().length >= 2,
  });

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    for (const w of workspaces) {
      out.push({
        id: `ws:${w.id}`,
        icon: "folder",
        name: w.name,
        sub: `Workspace · ${w.role}`,
        group: "Workspaces",
        run: () => setActiveWorkspace(w.id),
      });
    }
    for (const c of chatsQuery.data?.items ?? []) {
      out.push({
        id: `chat:${c.id}`,
        icon: c.type === "dm" ? "user" : "hash",
        name: c.name,
        sub: `${c.type.toUpperCase()}${c.topic ? ` · ${c.topic}` : ""}`,
        group: c.type === "dm" ? "Direct messages" : "Channels",
        run: () => navigate(`/c/${c.id}`),
      });
    }
    for (const m of searchQuery.data?.messages ?? []) {
      out.push({
        id: `m:${m.id}`,
        icon: "chat",
        name: m.body.slice(0, 80),
        sub: `Message · ${new Date(m.createdAt).toLocaleString()}`,
        group: "Messages",
        run: () => navigate(`/c/${m.chatId}`),
      });
    }
    for (const f of searchQuery.data?.files ?? []) {
      out.push({
        id: `f:${f.id}`,
        icon: "file",
        name: f.name,
        sub: `File · ${f.mime}`,
        group: "Files",
        run: () => navigate(`/files`),
      });
    }
    out.push(
      {
        id: "nav:dashboard",
        icon: "chat",
        name: "Go to dashboard",
        sub: "G then H",
        group: "Actions",
        run: () => navigate("/"),
      },
      { id: "nav:files", icon: "file", name: "Go to files", sub: "G then F", group: "Actions", run: () => navigate("/files") },
      { id: "nav:inbox", icon: "inbox", name: "Go to inbox", sub: "G then I", group: "Actions", run: () => navigate("/inbox") },
      { id: "nav:search", icon: "search", name: "Open search", sub: "/", group: "Actions", run: () => navigate("/search") },
      { id: "nav:settings", icon: "settings", name: "Open settings", sub: "⌘ ,", group: "Actions", run: () => navigate("/settings") }
    );
    return out;
  }, [workspaces, chatsQuery.data, searchQuery.data, setActiveWorkspace]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items.slice(0, 10);
    return items
      .map((it) => ({ it, score: matchScore(needle, it.name.toLowerCase()) + matchScore(needle, it.sub.toLowerCase()) * 0.4 }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((r) => r.it);
  }, [items, q]);

  useEffect(() => setSel(0), [q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((s) => Math.min(s + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter") {
        const pick = filtered[sel];
        if (pick) {
          pick.run();
          onClose();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, sel, onClose]);

  // Group for display.
  const grouped = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of filtered) {
      const g = m.get(it.group) ?? [];
      g.push(it);
      m.set(it.group, g);
    }
    return Array.from(m);
  }, [filtered]);

  let flatIdx = -1;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 640, marginTop: "-10vh" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 10 }}>
          <Icon.search size={16} />
          <input
            autoFocus
            placeholder="Search files, chats, people, actions…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, border: 0, outline: 0, background: "transparent", color: "var(--fg1)", font: "400 15px/1 var(--font-sans)" }}
          />
          <kbd>esc</kbd>
        </div>
        <div style={{ maxHeight: 440, overflow: "auto", padding: 6 }}>
          {grouped.map(([g, list]) => (
            <div key={g}>
              <div style={{ padding: "10px 12px 4px" }} className="caseno">
                {g.toUpperCase()}
              </div>
              {list.map((it) => {
                flatIdx++;
                const active = flatIdx === sel;
                return (
                  <div
                    key={it.id}
                    onClick={() => {
                      it.run();
                      onClose();
                    }}
                    onMouseEnter={() => setSel(filtered.indexOf(it))}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: active ? "var(--ember-50)" : "transparent",
                      color: active ? "var(--ember-700)" : "var(--fg1)",
                    }}
                  >
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 5,
                        background: active ? "var(--ember-500)" : "var(--paper-100)",
                        color: active ? "#fff" : "var(--fg2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {(() => {
                        const C = Icon[it.icon];
                        return <C size={14} />;
                      })()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: "500 13px/1.2 var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</div>
                      <div style={{ font: "400 11px/1 var(--font-mono)", color: active ? "var(--ember-700)" : "var(--fg3)", marginTop: 3 }}>{it.sub}</div>
                    </div>
                    {active && <span style={{ font: "500 10px/1 var(--font-mono)", color: "var(--fg3)" }}>↵ open</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="empty" style={{ padding: "40px 20px", minHeight: 0 }}>
              <div className="title">No trail yet.</div>
              <div className="sub">Try a chat name or message keyword.</div>
            </div>
          )}
        </div>
        <div
          style={{
            padding: "10px 14px",
            borderTop: "1px solid var(--border-soft)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            font: "500 11px/1 var(--font-mono)",
            color: "var(--fg3)",
          }}
        >
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
          <div style={{ flex: 1 }} />
          <span>{filtered.length} results</span>
        </div>
      </div>
    </div>
  );
}

// Dead-simple subsequence score — prefers matches earlier and tighter.
function matchScore(needle: string, hay: string): number {
  if (!needle) return 0;
  let i = 0;
  let score = 0;
  let lastIdx = -1;
  for (const ch of needle) {
    const idx = hay.indexOf(ch, i);
    if (idx < 0) return 0;
    score += 1 / (idx - lastIdx);
    i = idx + 1;
    lastIdx = idx;
  }
  // Prefer prefix match.
  if (hay.startsWith(needle)) score += 3;
  return score;
}
