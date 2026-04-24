// Minimal pathname-based router. Good enough for v1 — can swap to TanStack Router later.
// Supports path params like "/chats/:id" and keeps history in sync via pushState.

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(l: Listener) {
  listeners.add(l);
  window.addEventListener("popstate", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("popstate", l);
  };
}
function getSnapshot() {
  return window.location.pathname + window.location.search;
}

export function navigate(to: string, replace = false) {
  if (replace) window.history.replaceState({}, "", to);
  else window.history.pushState({}, "", to);
  listeners.forEach((l) => l());
}

export function useLocation(): string {
  return useSyncExternalStore(subscribe, getSnapshot, () => "/");
}

export function match(pattern: string, path: string): Record<string, string> | null {
  const pat = pattern.split("?")[0]!;
  const [pOnly] = path.split("?");
  const pParts = pat.split("/").filter(Boolean);
  const uParts = (pOnly ?? "").split("/").filter(Boolean);
  if (pParts.length !== uParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pParts.length; i++) {
    const pp = pParts[i]!;
    const up = uParts[i]!;
    if (pp.startsWith(":")) params[pp.slice(1)] = decodeURIComponent(up);
    else if (pp !== up) return null;
  }
  return params;
}

const RouteCtx = createContext<Record<string, string>>({});

interface RouteProps {
  path: string;
  element: (params: Record<string, string>) => ReactNode;
}

export function Routes({ routes, fallback }: { routes: RouteProps[]; fallback?: ReactNode }) {
  const loc = useLocation();
  const pathOnly = loc.split("?")[0] ?? "/";
  const matched = useMemo(() => {
    for (const r of routes) {
      const params = match(r.path, pathOnly);
      if (params) return { r, params };
    }
    return null;
  }, [routes, pathOnly]);
  if (!matched) return <>{fallback ?? null}</>;
  return <RouteCtx.Provider value={matched.params}>{matched.r.element(matched.params)}</RouteCtx.Provider>;
}

export function useParams() {
  return useContext(RouteCtx);
}

export function Link({
  to,
  replace,
  className,
  onClick,
  children,
  ...rest
}: {
  to: string;
  replace?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  children: ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "onClick">) {
  const handle = useCallback(
    (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      onClick?.(e);
      if (!e.defaultPrevented) navigate(to, replace);
    },
    [to, replace, onClick]
  );
  return (
    <a href={to} onClick={handle} className={className} {...rest}>
      {children}
    </a>
  );
}

// Run once on app boot to intercept anchor clicks for same-origin navigation.
export function useGlobalLinkIntercept() {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest?.("a[data-nav]");
      if (!a) return;
      const href = (a as HTMLAnchorElement).getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto:")) return;
      e.preventDefault();
      navigate(href);
    };
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, []);
}
