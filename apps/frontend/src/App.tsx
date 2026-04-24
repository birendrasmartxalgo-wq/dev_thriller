import { useEffect } from "react";
import { Routes, navigate, useGlobalLinkIntercept, useLocation } from "@/router";
import { LoginScreen } from "@/modules/auth/LoginScreen";
import { SignupScreen } from "@/modules/auth/SignupScreen";
import { Shell } from "@/modules/shell/Shell";
import { Dashboard } from "@/modules/dashboard/Dashboard";
import { ChatView } from "@/modules/chat/ChatView";
import { FilesView } from "@/modules/files/FilesView";
import { SearchView } from "@/modules/search/SearchView";
import { InboxView } from "@/modules/inbox/InboxView";
import { SettingsView } from "@/modules/settings/SettingsView";
import { AdminView } from "@/modules/admin/AdminView";
import { Onboarding } from "@/modules/onboarding/Onboarding";
import { ToastRegion } from "@/components/Toasts";
import { GlobalOverlays } from "@/components/GlobalOverlays";
import { useSession } from "@/store/session";
import { authApi } from "@/api/endpoints";
import { tokenStore } from "@/api/client";

function Booting() {
  return (
    <div style={{ height: "100vh", display: "grid", placeItems: "center", color: "var(--fg3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="spinner" /> Unlocking the case file…
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useSession((s) => s.user);
  const booted = useSession((s) => s.booted);
  const loc = useLocation();
  useEffect(() => {
    if (booted && !user && !loc.startsWith("/login") && !loc.startsWith("/signup")) {
      navigate("/login", true);
    }
  }, [user, booted, loc]);
  if (!booted) return <Booting />;
  if (!user) return null;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const user = useSession((s) => s.user);
  const booted = useSession((s) => s.booted);
  useEffect(() => {
    if (booted && user) navigate("/", true);
  }, [user, booted]);
  if (!booted) return <Booting />;
  return <>{children}</>;
}

export function App() {
  useGlobalLinkIntercept();
  const setUser = useSession((s) => s.setUser);
  const setBooted = useSession((s) => s.setBooted);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tokenStore.access) {
        if (!cancelled) setBooted(true);
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) setUser(me);
      } catch {
        tokenStore.clear();
      } finally {
        if (!cancelled) setBooted(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser, setBooted]);

  const inShell = (el: React.ReactNode) => (
    <RequireAuth>
      <Shell>{el}</Shell>
    </RequireAuth>
  );

  return (
    <>
      <Routes
        fallback={inShell(
          <div className="empty">
            <div className="title">404 — case not found.</div>
            <div className="sub">The trail goes cold here. Try the sidebar.</div>
          </div>
        )}
        routes={[
          {
            path: "/login",
            element: () => (
              <RedirectIfAuthed>
                <LoginScreen />
              </RedirectIfAuthed>
            ),
          },
          {
            path: "/signup",
            element: () => (
              <RedirectIfAuthed>
                <SignupScreen />
              </RedirectIfAuthed>
            ),
          },
          {
            path: "/onboarding",
            element: () => (
              <RequireAuth>
                <Onboarding />
              </RequireAuth>
            ),
          },
          { path: "/", element: () => inShell(<Dashboard />) },
          { path: "/c/:id", element: () => inShell(<ChatView />) },
          { path: "/files", element: () => inShell(<FilesView />) },
          { path: "/search", element: () => inShell(<SearchView />) },
          { path: "/inbox", element: () => inShell(<InboxView />) },
          { path: "/settings", element: () => inShell(<SettingsView />) },
          { path: "/admin", element: () => inShell(<AdminView />) },
        ]}
      />
      <GlobalOverlays />
      <ToastRegion />
    </>
  );
}
