// Global ⌘K palette.
// Sections: Chats, People, Files, Settings actions, Saved searches, Recent.
// Search fans out to /v1/search (debounced 200ms) and merges with in-memory
// chats/members/saved-searches lists. Recent items are tracked LRU in localStorage.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Virtuoso } from "react-virtuoso";
import { chatApi, searchApi, workspaceApi, authApi } from "@/api/endpoints";
import { savedSearchApi } from "@/api/adminApi";
import { useSession } from "@/store/session";
import { Icon } from "@/components/Icons";
import { navigate } from "@/router";
import { pushRecent, getRecents, type RecentEntry } from "@/lib/recents";

type Group = "Chats" | "People" | "Files" | "Settings actions" | "Saved searches" | "Recent" | "Workspaces" | "Messages";

type Item = {
  id: string;
  icon: keyof typeof Icon;
  name: string;
  sub: string;
  snippet?: string;
  run: () => void;
  group: Group;
};

const GROUP_ORDER: Group[] = ["Recent", "Chats", "People", "Files", "Saved searches", "Settings actions", "Workspaces", "Messages"];

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sel, setSel] = useState(0);
  const [filterGroup, setFilterGroup] = useState<Group | null>(null);
  const [recents, setRecents] = useState<RecentEntry[]>(() => getRecents());

  const workspaces = useSession((s) => s.workspaces);
  const activeWs = useSession((s) => s.activeWorkspaceId);
  const user = useSession((s) => s.user);
  const setActiveWorkspace = useSession((s) => s.setActiveWorkspace);

  const activeRole = useMemo(() => workspaces.find((w) => w.id === activeWs)?.role ?? null, [workspaces, activeWs]);

  // Debounce search query at 200ms.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  // Refresh recents when palette opens (already done via useState init, but keep
  // in sync if user runs something then reopens without remount).
  useEffect(() => {
    setRecents(getRecents());
  }, []);

  const chatsQuery = useQuery({
    queryKey: ["chats", activeWs],
    queryFn: () => chatApi.list(activeWs!),
    enabled: Boolean(activeWs),
    staleTime: 15_000,
  });

  const membersQuery = useQuery({
    queryKey: ["members", activeWs],
    queryFn: () => workspaceApi.members(activeWs!),
    enabled: Boolean(activeWs),
    staleTime: 30_000,
  });

  const savedQuery = useQuery({
    queryKey: ["savedSearches", activeWs],
    queryFn: () => savedSearchApi.list(activeWs!),
    enabled: Boolean(activeWs),
    staleTime: 30_000,
  });

  const searchQuery = useQuery({
    queryKey: ["palette-search", activeWs, debouncedQ],
    queryFn: () => searchApi.query({ q: debouncedQ, workspaceId: activeWs!, type: "all", limit: 12 }),
    enabled: Boolean(activeWs) && debouncedQ.length >= 2,
  });

  function commit(it: Item) {
    pushRecent({
      id: it.id,
      kind: it.group === "Saved searches" ? "search" : it.group === "Files" ? "file" : it.group === "Chats" ? "chat" : "other",
      label: it.name,
      sub: it.sub,
      icon: it.icon,
      runHref: undefined,
    });
    setRecents(getRecents());
    it.run();
    onClose();
  }

  // Build all candidate items per group.
  const groupedItems = useMemo(() => {
    const map = new Map<Group, Item[]>();
    const push = (g: Group, it: Item) => {
      const arr = map.get(g) ?? [];
      arr.push(it);
      map.set(g, arr);
    };

    // Recent (only when no query).
    if (!q.trim()) {
      for (const r of recents.slice(0, 10)) {
        push("Recent", {
          id: `recent:${r.id}`,
          icon: r.icon ?? "search",
          name: r.label,
          sub: r.sub ?? "Recent",
          group: "Recent",
          run: () => {
            // For chats / files / other we re-run their original navigate.
            if (r.kind === "chat") navigate(`/c/${r.id.replace(/^chat:/, "")}`);
            else if (r.kind === "file") navigate(`/files`);
            else if (r.kind === "search") {
              // Saved search — open inbox; saved-search id is in r.id after "saved:".
              navigate(`/inbox`);
            } else if (r.id.startsWith("nav:")) {
              navigate(r.id.slice(4));
            }
          },
        });
      }
    }

    // Workspaces.
    for (const w of workspaces) {
      push("Workspaces", {
        id: `ws:${w.id}`,
        icon: "folder",
        name: w.name,
        sub: `Workspace · ${w.role}`,
        group: "Workspaces",
        run: () => setActiveWorkspace(w.id),
      });
    }

    // Chats.
    for (const c of chatsQuery.data?.items ?? []) {
      push("Chats", {
        id: `chat:${c.id}`,
        icon: c.type === "dm" ? "user" : "hash",
        name: c.name,
        sub: `${c.type.toUpperCase()}${c.topic ? ` · ${c.topic}` : ""}`,
        group: "Chats",
        run: () => navigate(`/c/${c.id}`),
      });
    }

    // People.
    for (const m of membersQuery.data?.items ?? []) {
      const label = m.name ?? m.email ?? m.userId;
      push("People", {
        id: `person:${m.userId}`,
        icon: "user",
        name: label,
        sub: `${m.role.toUpperCase()} · ${m.email ?? "—"}`,
        group: "People",
        run: () => navigate(`/settings`),
      });
    }

    // Saved searches.
    for (const s of savedQuery.data?.items ?? []) {
      push("Saved searches", {
        id: `saved:${s.id}`,
        icon: "search",
        name: s.name,
        sub: `Saved · ${s.query}`,
        group: "Saved searches",
        run: () => navigate(`/inbox`),
      });
    }

    // Settings actions.
    push("Settings actions", {
      id: "act:theme",
      icon: "settings",
      name: "Toggle theme",
      sub: "Light / dark",
      group: "Settings actions",
      run: () => {
        const html = document.documentElement;
        const next = html.dataset.theme === "dark" ? "light" : "dark";
        html.dataset.theme = next;
        try {
          localStorage.setItem("dt.theme", next);
        } catch {
          /* ignore */
        }
      },
    });
    push("Settings actions", {
      id: "act:profile",
      icon: "user",
      name: "Open profile",
      sub: user?.email ?? "Account",
      group: "Settings actions",
      run: () => navigate(`/settings`),
    });
    if (activeRole === "admin" || activeRole === "owner") {
      push("Settings actions", {
        id: "act:admin",
        icon: "shield",
        name: "Open admin",
        sub: "Workspace admin",
        group: "Settings actions",
        run: () => navigate(`/admin`),
      });
    }
    push("Settings actions", {
      id: "act:copy-url",
      icon: "copy",
      name: "Copy current URL",
      sub: window.location.pathname,
      group: "Settings actions",
      run: () => {
        void navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
      },
    });
    push("Settings actions", {
      id: "act:signout",
      icon: "logout",
      name: "Sign out",
      sub: "End session",
      group: "Settings actions",
      run: () => {
        void authApi.logout().finally(() => navigate("/login"));
      },
    });

    // From server search.
    for (const m of searchQuery.data?.messages ?? []) {
      push("Messages", {
        id: `m:${m.id}`,
        icon: "chat",
        name: m.body.slice(0, 80) || "(empty message)",
        sub: `Message · ${new Date(m.createdAt).toLocaleString()}`,
        snippet: m.body,
        group: "Messages",
        run: () => navigate(`/c/${m.chatId}`),
      });
    }
    for (const f of searchQuery.data?.files ?? []) {
      push("Files", {
        id: `f:${f.id}`,
        icon: "file",
        name: f.name,
        sub: `File · ${f.mime}`,
        snippet: f.name,
        group: "Files",
        run: () => navigate(`/files`),
      });
    }

    return map;
  }, [
    workspaces,
    chatsQuery.data,
    membersQuery.data,
    savedQuery.data,
    searchQuery.data,
    setActiveWorkspace,
    user,
    activeRole,
    recents,
    q,
  ]);

  // Flatten ranked + filtered.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out: Item[] = [];
    for (const g of GROUP_ORDER) {
      if (filterGroup && filterGroup !== g) continue;
      const items = groupedItems.get(g) ?? [];
      if (!needle) {
        out.push(...items);
        continue;
      }
      const ranked: { it: Item; score: number }[] = [];
      for (const it of items) {
        const s = matchScore(needle, it.name.toLowerCase()) + matchScore(needle, it.sub.toLowerCase()) * 0.4;
        if (s > 0) ranked.push({ it, score: s });
      }
      ranked.sort((a, b) => b.score - a.score);
      out.push(...ranked.map((r) => r.it));
    }
    return out;
  }, [groupedItems, q, filterGroup]);

  useEffect(() => setSel(0), [q, filterGroup]);

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Keyboard handlers.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((s) => Math.min(s + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter") {
        const pick = filtered[sel];
        if (pick) {
          e.preventDefault();
          commit(pick);
        }
      } else if (e.key === "Tab") {
        // Cycle category filter.
        e.preventDefault();
        const present = GROUP_ORDER.filter((g) => (groupedItems.get(g) ?? []).length > 0);
        if (present.length === 0) return;
        const cur = filterGroup ? present.indexOf(filterGroup) : -1;
        const next = e.shiftKey ? cur - 1 : cur + 1;
        if (next < 0) setFilterGroup(present[present.length - 1]!);
        else if (next >= present.length) setFilterGroup(null);
        else setFilterGroup(present[next]!);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sel, onClose, filterGroup, groupedItems]);

  // Focus trap (basic): keep focus within the dialog. Phase 9 added a generic
  // pattern, but this palette pre-dates it and re-implements minimally.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Group items for sectioned rendering.
  const sections = useMemo(() => {
    const m = new Map<Group, Item[]>();
    for (const it of filtered) {
      const arr = m.get(it.group) ?? [];
      arr.push(it);
      m.set(it.group, arr);
    }
    return Array.from(m);
  }, [filtered]);

  const useVirtual = filtered.length > 50;

  // Track flat index for selection highlighting in non-virtual mode.
  let flatIdx = -1;

  return (
    <div
      className="modal-backdrop dt-modal-bd"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="modal dt-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 640, marginTop: "-10vh" }}
      >
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 10 }}>
          <Icon.search size={16} />
          <input
            ref={inputRef}
            className="dt-input"
            placeholder="Search chats, people, files, actions…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search"
            style={{ flex: 1, border: 0, outline: 0, background: "transparent", color: "var(--fg1)", font: "400 15px/1 var(--font-sans)" }}
          />
          {filterGroup && (
            <span
              onClick={() => setFilterGroup(null)}
              style={{
                font: "500 10px/1 var(--font-mono)",
                color: "var(--ember-700)",
                background: "var(--ember-50)",
                padding: "4px 8px",
                borderRadius: 4,
                cursor: "pointer",
                textTransform: "uppercase",
              }}
              title="Clear filter (Tab cycles)"
            >
              {filterGroup} ×
            </span>
          )}
          <kbd>esc</kbd>
        </div>

        {/* Results region — aria-live for SRs */}
        <div
          aria-live="polite"
          aria-atomic="false"
          style={{ maxHeight: 440, overflow: "auto", padding: 6 }}
        >
          {useVirtual ? (
            <Virtuoso
              style={{ height: 440 }}
              data={filtered}
              itemContent={(idx, it) => (
                <PaletteRow
                  key={it.id}
                  item={it}
                  active={idx === sel}
                  onMouseEnter={() => setSel(idx)}
                  onClick={() => commit(it)}
                />
              )}
            />
          ) : (
            sections.map(([g, list]) => (
              <div key={g}>
                <div style={{ padding: "10px 12px 4px" }} className="caseno">
                  {g.toUpperCase()}
                </div>
                {list.map((it) => {
                  flatIdx++;
                  const active = flatIdx === sel;
                  return (
                    <PaletteRow
                      key={it.id}
                      item={it}
                      active={active}
                      onMouseEnter={() => setSel(filtered.indexOf(it))}
                      onClick={() => commit(it)}
                    />
                  );
                })}
              </div>
            ))
          )}
          {filtered.length === 0 && (
            <div className="empty" style={{ padding: "40px 20px", minHeight: 0 }}>
              <div className="title">No trail yet.</div>
              <div className="sub">Try a chat name, person, or message keyword.</div>
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
            <kbd>tab</kbd> cycle
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

function PaletteRow({
  item,
  active,
  onMouseEnter,
  onClick,
}: {
  item: Item;
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  const C = Icon[item.icon];
  return (
    <div
      className="dt-row"
      role="option"
      aria-selected={active}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
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
        <C size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "500 13px/1.2 var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
        <div style={{ font: "400 11px/1.2 var(--font-mono)", color: active ? "var(--ember-700)" : "var(--fg3)", marginTop: 3 }}>
          {item.sub}
          {item.snippet && (
            <span style={{ marginLeft: 6, color: "var(--fg3)" }}>
              {" ··· "}
              {item.snippet.slice(0, 60)}
            </span>
          )}
        </div>
      </div>
      {active && <span style={{ font: "500 10px/1 var(--font-mono)", color: "var(--fg3)" }}>↵ open</span>}
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
  if (hay.startsWith(needle)) score += 3;
  return score;
}
