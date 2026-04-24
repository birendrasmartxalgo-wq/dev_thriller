// Migrated shell: topbar + sidebar, derived from app/shell.jsx + app/web_kit_shell.jsx.
// Minimal v1 — renders live workspaces, live chats of the active workspace, and a content slot.

import { useEffect, useMemo, type ReactNode } from "react";
import { Search, Bell, Settings, Hash, Plus, Folder, MessageSquare, Users, LogOut, Shield, Inbox, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { chatApi, projectApi, workspaceApi, authApi } from "@/api/endpoints";
import { notificationApi } from "@/api/adminApi";
import { useSession } from "@/store/session";
import { Link, navigate, useLocation } from "@/router";
import { toast } from "@/store/toast";

export function Shell({ children }: { children: ReactNode }) {
  const user = useSession((s) => s.user);
  const workspaces = useSession((s) => s.workspaces);
  const activeWorkspaceId = useSession((s) => s.activeWorkspaceId);
  const setWorkspaces = useSession((s) => s.setWorkspaces);
  const setActiveWorkspace = useSession((s) => s.setActiveWorkspace);
  const loc = useLocation();

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

  async function newWorkspace() {
    const name = window.prompt("Workspace name")?.trim();
    if (!name) return;
    try {
      const r = await workspaceApi.create({ name });
      await wsQuery.refetch();
      setActiveWorkspace(r.id);
      toast(`Case “${r.name}” opened`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
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
      <div className="topbar">
        <div className="tb-logo">
          <img src="/assets/logo-monogram.svg" alt="" />
          <span>Dev Thriller</span>
        </div>

        <div className="tb-case" onClick={() => {}}>
          <div className="dot">{activeWs?.name?.[0]?.toUpperCase() ?? "?"}</div>
          <span>{activeWs?.name ?? "Choose a case"}</span>
          {activeWs && <span className="caseno">CASE · {activeWs.caseNumber}</span>}
        </div>

        <div className="tb-search">
          <Search className="search-ico" size={14} />
          <button
            className="trigger"
            type="button"
            onClick={() => {
              // Dispatch synthetic ⌘K so the palette toggles via the same path.
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
            }}
          >
            Search messages, files, people…
          </button>
          <span className="kbd">⌘K</span>
        </div>

        <div className="tb-right">
          <Link to="/inbox" className="tb-btn" title="Notifications">
            <Bell className="icon" size={16} />
            {unreadQuery.data && unreadQuery.data.items.length > 0 && <span className="dot" />}
          </Link>
          <Link to="/settings" className="tb-btn" title="Settings">
            <Settings className="icon" size={16} />
          </Link>
          {(activeWs?.role === "owner" || activeWs?.role === "admin") && (
            <Link to="/admin" className="tb-btn" title="Admin">
              <Shield className="icon" size={16} />
            </Link>
          )}
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 6 }}>
              <div className="av" title={user.name}>
                {user.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() ?? "")
                  .join("")}
              </div>
              <button className="tb-btn" onClick={doLogout} title="Sign out">
                <LogOut className="icon" size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <aside className="sidebar">
        {/* Workspace switcher */}
        <div className="sb-section">
          Workspaces
          <span className="plus" onClick={newWorkspace} title="New workspace">
            <Plus size={14} />
          </span>
        </div>
        {workspaces.map((w) => (
          <div
            key={w.id}
            className={`sb-item${w.id === activeWorkspaceId ? " active" : ""}`}
            onClick={() => setActiveWorkspace(w.id)}
          >
            <div className="av" style={{ background: "var(--ember-500)" }}>
              {w.name[0]?.toUpperCase() ?? "?"}
            </div>
            <span>{w.name}</span>
            <span className="count">{w.role}</span>
          </div>
        ))}

        <div style={{ height: 8 }} />

        {/* Projects */}
        <div className="sb-section">
          Projects
          <span className="plus" title="New project">
            <Plus size={14} />
          </span>
        </div>
        {projectsQuery.data?.items.map((p) => (
          <Link to={`/p/${p.id}`} key={p.id} className={`sb-item${loc.startsWith(`/p/${p.id}`) ? " active" : ""}`}>
            <Folder className="icon" size={16} />
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
          <span className="plus" onClick={newChannel} title="New channel">
            <Plus size={14} />
          </span>
        </div>
        {chatsQuery.data?.items
          .filter((c) => c.type === "channel")
          .map((c) => (
            <Link to={`/c/${c.id}`} key={c.id} className={`sb-item${loc.startsWith(`/c/${c.id}`) ? " active" : ""}`}>
              <Hash className="icon" size={16} />
              <span>{c.name}</span>
            </Link>
          ))}

        <div style={{ height: 8 }} />

        <div className="sb-section">Direct messages</div>
        {chatsQuery.data?.items
          .filter((c) => c.type === "dm")
          .map((c) => (
            <Link to={`/c/${c.id}`} key={c.id} className={`sb-item${loc.startsWith(`/c/${c.id}`) ? " active" : ""}`}>
              <Users className="icon" size={16} />
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
          <MessageSquare className="icon" size={16} />
          <span>Dashboard</span>
        </Link>
        <Link to="/files" className={`sb-item${loc.startsWith("/files") ? " active" : ""}`}>
          <FileText className="icon" size={16} />
          <span>Files</span>
        </Link>
        <Link to="/inbox" className={`sb-item${loc.startsWith("/inbox") ? " active" : ""}`}>
          <Inbox className="icon" size={16} />
          <span>Inbox</span>
          {unreadQuery.data && unreadQuery.data.items.length > 0 && (
            <span className="count" style={{ background: "var(--ember-500)", color: "#fff" }}>
              {unreadQuery.data.items.length}
            </span>
          )}
        </Link>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
