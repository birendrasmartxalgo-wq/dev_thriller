// Migrated shell: topbar + sidebar, derived from app/shell.jsx + app/web_kit_shell.jsx.
// Minimal v1 — renders live workspaces, live chats of the active workspace, and a content slot.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, Bell, Settings, Hash, Plus, Folder, MessageSquare, Users, LogOut, Shield, Inbox, FileText, Menu } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { chatApi, projectApi, workspaceApi, authApi } from "@/api/endpoints";
import { notificationApi } from "@/api/adminApi";
import { useSession } from "@/store/session";
import { Link, navigate, useLocation } from "@/router";
import { toast } from "@/store/toast";
import { WorkspaceCreateDialog } from "./WorkspaceCreateDialog";

export function Shell({ children }: { children: ReactNode }) {
  const user = useSession((s) => s.user);
  const workspaces = useSession((s) => s.workspaces);
  const activeWorkspaceId = useSession((s) => s.activeWorkspaceId);
  const setWorkspaces = useSession((s) => s.setWorkspaces);
  const setActiveWorkspace = useSession((s) => s.setActiveWorkspace);
  const loc = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wsCreateOpen, setWsCreateOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Close drawer on route change.
  useEffect(() => {
    setDrawerOpen(false);
  }, [loc]);

  // Esc to close + focus trap while drawer open.
  useEffect(() => {
    if (!drawerOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => el.offsetParent !== null);

    const first = focusables()[0];
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) return;
      const firstEl = list[0]!;
      const lastEl = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [drawerOpen]);

  // Fetch workspaces once user is known.
  const wsQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: workspaceApi.list,
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (wsQuery.data) setWorkspaces(wsQuery.data.items);
  }, [wsQuery.data, setWorkspaces]);

  const activeWs = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId]
  );

  const chatsQuery = useQuery({
    queryKey: ["chats", activeWorkspaceId],
    queryFn: () => chatApi.list(activeWorkspaceId!),
    enabled: Boolean(activeWorkspaceId),
    staleTime: 15_000,
  });

  const projectsQuery = useQuery({
    queryKey: ["projects", activeWorkspaceId],
    queryFn: () => projectApi.list(activeWorkspaceId!),
    enabled: Boolean(activeWorkspaceId),
    staleTime: 30_000,
  });

  const unreadQuery = useQuery({
    queryKey: ["notifications-unread", activeWorkspaceId],
    queryFn: () => notificationApi.list({ workspaceId: activeWorkspaceId ?? undefined, unread: true, limit: 1 }),
    enabled: Boolean(user),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  async function doLogout() {
    try {
      await authApi.logout();
    } catch {
      /* empty */
    }
    useSession.getState().reset();
    navigate("/login");
  }

  // Workspace creation now happens in <WorkspaceCreateDialog/>; the trigger
  // below opens it. Kept the helper signature unused-removed to flag stale callers.
  async function onWorkspaceCreated(r: { id: string; slug: string; name: string }) {
    await wsQuery.refetch();
    setActiveWorkspace(r.id);
    setWsCreateOpen(false);
    navigate("/");
  }

  async function newChannel() {
    if (!activeWorkspaceId) return;
    const name = window.prompt("Channel name")?.trim();
    if (!name) return;
    try {
      await chatApi.create({ workspaceId: activeWorkspaceId, type: "channel", name });
      await chatsQuery.refetch();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="app">
      {/* Skip-to-content link for keyboard users. */}
      <a href="#dt-main" className="dt-skip-link">
        Skip to content
      </a>

      <div className="topbar" role="banner">
        <button
          ref={hamburgerRef}
          type="button"
          className="dt-hamburger"
          aria-label={drawerOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={drawerOpen}
          aria-controls="dt-sidebar"
          onClick={() => setDrawerOpen((v) => !v)}
        >
          <Menu size={18} aria-hidden="true" />
        </button>

        <div className="tb-logo">
          <img src="/assets/logo-monogram.svg" alt="" />
          <span>Dev Thriller</span>
        </div>

        <button
          type="button"
          className="tb-case"
          aria-label={activeWs ? `Active case ${activeWs.name}` : "Choose a case"}
          style={{ border: 0, background: "transparent" }}
        >
          <div className="dot" aria-hidden="true">{activeWs?.name?.[0]?.toUpperCase() ?? "?"}</div>
          <span data-testid="workspace-title">{activeWs?.name ?? "Choose a case"}</span>
          {activeWs && <span className="caseno">CASE · {activeWs.caseNumber}</span>}
        </button>

        <div className="tb-search" role="search">
          <Search className="search-ico" size={14} aria-hidden="true" />
          <button
            className="trigger"
            type="button"
            aria-label="Open global search"
            onClick={() => {
              // Dispatch synthetic ⌘K so the palette toggles via the same path.
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
            }}
          >
            Search messages, files, people…
          </button>
          <span className="kbd" aria-hidden="true">⌘K</span>
        </div>

        <div className="tb-right">
          <Link to="/inbox" className="tb-btn" title="Notifications" aria-label="Notifications">
            <Bell className="icon" size={16} aria-hidden="true" />
            {unreadQuery.data && unreadQuery.data.items.length > 0 && <span className="dot" aria-hidden="true" />}
          </Link>
          <Link to="/settings" className="tb-btn" title="Settings" aria-label="Settings">
            <Settings className="icon" size={16} aria-hidden="true" />
          </Link>
          {(activeWs?.role === "owner" || activeWs?.role === "admin") && (
            <Link to="/admin" className="tb-btn" title="Admin" aria-label="Admin">
              <Shield className="icon" size={16} aria-hidden="true" />
            </Link>
          )}
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 6 }}>
              <div className="av" title={user.name} aria-label={`Signed in as ${user.name}`}>
                {user.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() ?? "")
                  .join("")}
              </div>
              <button className="tb-btn" onClick={doLogout} title="Sign out" aria-label="Sign out">
                <LogOut className="icon" size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      {drawerOpen && (
        <div
          className="dt-drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="dt-sidebar"
        ref={sidebarRef}
        className="sidebar"
        data-open={drawerOpen ? "true" : "false"}
        aria-label="Primary navigation"
        role={drawerOpen ? "dialog" : undefined}
        aria-modal={drawerOpen ? "true" : undefined}
      >
        {/* Workspace switcher */}
        <div className="sb-section">
          Workspaces
          <button
            className="plus"
            type="button"
            onClick={() => setWsCreateOpen(true)}
            aria-label="New workspace"
            title="New workspace"
            data-testid="create-workspace"
            style={{ border: 0, background: "transparent" }}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
        {workspaces.map((w) => (
          <button
            key={w.id}
            type="button"
            className={`sb-item${w.id === activeWorkspaceId ? " active" : ""}`}
            onClick={() => setActiveWorkspace(w.id)}
            aria-current={w.id === activeWorkspaceId ? "true" : undefined}
            style={{ border: 0, background: "transparent", textAlign: "left", width: "100%" }}
          >
            <div className="av" style={{ background: "var(--ember-500)" }} aria-hidden="true">
              {w.name[0]?.toUpperCase() ?? "?"}
            </div>
            <span>{w.name}</span>
            <span className="count">{w.role}</span>
          </button>
        ))}

        <div style={{ height: 8 }} />

        {/* Projects */}
        <div className="sb-section">
          Projects
          <button
            className="plus"
            type="button"
            aria-label="New project"
            title="New project"
            style={{ border: 0, background: "transparent" }}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
        {projectsQuery.data?.items.map((p) => (
          <Link to={`/p/${p.id}`} key={p.id} className={`sb-item${loc.startsWith(`/p/${p.id}`) ? " active" : ""}`}>
            <Folder className="icon" size={16} aria-hidden="true" />
            <span>{p.name}</span>
          </Link>
        ))}
        {!projectsQuery.data?.items?.length && (
          <div style={{ padding: "4px 10px", color: "var(--fg3)", font: "400 12px/1.4 var(--font-sans)" }}>
            No projects yet.
          </div>
        )}

        <div style={{ height: 8 }} />

        {/* Chats */}
        <div className="sb-section">
          Channels
          <button
            className="plus"
            type="button"
            onClick={newChannel}
            aria-label="New channel"
            title="New channel"
            style={{ border: 0, background: "transparent" }}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
        {chatsQuery.data?.items
          .filter((c) => c.type === "channel")
          .map((c) => (
            <Link
              to={`/c/${c.id}`}
              key={c.id}
              className={`sb-item${loc.startsWith(`/c/${c.id}`) ? " active" : ""}`}
              data-testid={`chat-link-${c.name}`}
            >
              <Hash className="icon" size={16} aria-hidden="true" />
              <span>{c.name}</span>
            </Link>
          ))}

        <div style={{ height: 8 }} />

        <div className="sb-section">Direct messages</div>
        {chatsQuery.data?.items
          .filter((c) => c.type === "dm")
          .map((c) => (
            <Link to={`/c/${c.id}`} key={c.id} className={`sb-item${loc.startsWith(`/c/${c.id}`) ? " active" : ""}`}>
              <Users className="icon" size={16} aria-hidden="true" />
              <span>{c.name}</span>
            </Link>
          ))}
        {!chatsQuery.data?.items.some((c) => c.type === "dm") && (
          <div style={{ padding: "4px 10px", color: "var(--fg3)", font: "400 12px/1.4 var(--font-sans)" }}>
            No DMs yet.
          </div>
        )}

        <div style={{ flex: 1 }} />

        <Link to="/" className={`sb-item${loc === "/" ? " active" : ""}`}>
          <MessageSquare className="icon" size={16} aria-hidden="true" />
          <span>Dashboard</span>
        </Link>
        <Link to="/files" className={`sb-item${loc.startsWith("/files") ? " active" : ""}`}>
          <FileText className="icon" size={16} aria-hidden="true" />
          <span>Files</span>
        </Link>
        <Link to="/inbox" className={`sb-item${loc.startsWith("/inbox") ? " active" : ""}`}>
          <Inbox className="icon" size={16} aria-hidden="true" />
          <span>Inbox</span>
          {unreadQuery.data && unreadQuery.data.items.length > 0 && (
            <span className="count" style={{ background: "var(--ember-500)", color: "#fff" }}>
              {unreadQuery.data.items.length}
            </span>
          )}
        </Link>
      </aside>

      <main id="dt-main" className="main" tabIndex={-1}>{children}</main>

      {wsCreateOpen && (
        <WorkspaceCreateDialog
          onClose={() => setWsCreateOpen(false)}
          onCreated={onWorkspaceCreated}
        />
      )}
    </div>
  );
}
