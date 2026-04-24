// Thin API client for the Dev Thriller backend.
// Uses fetch + Bearer token from localStorage. Refreshes access token on 401.
// Eden Treaty can be layered on later once types resolve cleanly across the workspace.

const TOKEN_KEY = "dt.access";
const REFRESH_KEY = "dt.refresh";

export const tokenStore = {
  get access(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";

let refreshing: Promise<boolean> | null = null;

async function refreshAccess(): Promise<boolean> {
  if (refreshing) return refreshing;
  const rt = tokenStore.refresh;
  if (!rt) return false;
  refreshing = (async () => {
    try {
      const r = await fetch("/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!r.ok) return false;
      const data = (await r.json()) as { access: string; refresh: string };
      tokenStore.set(data.access, data.refresh);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function request<T>(method: Method, path: string, body?: unknown, tries = 1): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const access = tokenStore.access;
  if (access) headers["Authorization"] = `Bearer ${access}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && tries > 0 && tokenStore.refresh) {
    const ok = await refreshAccess();
    if (ok) return request<T>(method, path, body, 0);
    tokenStore.clear();
  }

  if (!res.ok) {
    let payload: { type?: string; title?: string; detail?: string; code?: string; errors?: unknown } = {};
    try {
      payload = await res.json();
    } catch {
      /* empty */
    }
    throw new ApiError(
      res.status,
      payload.code ?? String(res.status),
      payload.detail ?? payload.title ?? res.statusText,
      payload.errors
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};
