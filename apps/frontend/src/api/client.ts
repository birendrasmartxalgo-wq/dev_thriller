// Typed API client for the Dev Thriller backend — Eden Treaty on top of fetch.
//
// The `eden` treaty client is built from the backend's `App` type (re-exported
// via @dt/shared), giving the frontend end-to-end type inference for path,
// query, body and response shapes. Runtime validation happens server-side
// against the Elysia `t.Object(...)` schemas.
//
// Behaviors:
//   - Bearer access token from localStorage (tokenStore)
//   - Single-flight refresh on 401 via POST /v1/auth/refresh
//   - ApiError shape so existing error handlers keep working
//   - X-Request-Id propagation into a small per-request debug context
//
// All HTTP traffic flows through `eden`; the typed helpers in endpoints.ts and
// adminApi.ts are thin wrappers that call `eden.*` and unwrap the result.

import { treaty } from "@elysiajs/eden";
import type { App } from "@dt/shared";

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

// Lightweight per-response debug context. Populated from `X-Request-Id` if the
// server emitted one so unhandled errors/toasts can quote it.
export const debugContext: { lastRequestId: string | null } = { lastRequestId: null };

let refreshing: Promise<boolean> | null = null;

function deriveBaseUrl(): string {
  // Same-origin in the browser (Vite dev proxy forwards /v1 + /docs).
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

async function refreshAccess(): Promise<boolean> {
  if (refreshing) return refreshing;
  const rt = tokenStore.refresh;
  if (!rt) return false;
  refreshing = (async () => {
    try {
      const r = await fetch(`${deriveBaseUrl()}/v1/auth/refresh`, {
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

// Custom fetcher used by both the treaty client and the verb shim. Attaches the
// bearer token, retries once on 401 after a successful refresh, and scrapes any
// `X-Request-Id` header into the debug context.
const authedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const headers = new Headers(init?.headers ?? {});
  const access = tokenStore.access;
  if (access && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${access}`);
  }

  let res = await fetch(input, { ...init, headers });

  if (res.status === 401 && tokenStore.refresh) {
    const ok = await refreshAccess();
    if (ok) {
      const retryHeaders = new Headers(init?.headers ?? {});
      const newAccess = tokenStore.access;
      if (newAccess) retryHeaders.set("Authorization", `Bearer ${newAccess}`);
      res = await fetch(input, { ...init, headers: retryHeaders });
    } else {
      tokenStore.clear();
    }
  }

  const reqId = res.headers.get("X-Request-Id");
  if (reqId) debugContext.lastRequestId = reqId;

  return res;
};

// The typed treaty client. Route paths are inferred from the backend `App` type.
// Usage: `await eden.v1.auth.login.post({ email, password })`.
export const eden = treaty<App>(deriveBaseUrl(), {
  // `typeof fetch` in lib.dom carries a `preconnect` static method that our
  // authedFetch wrapper doesn't implement. Treaty only calls the function
  // signature, so this cast is safe.
  fetcher: authedFetch as unknown as typeof fetch,
});

// Maps Eden's `{ status, value }` error to our ApiError shape. The server error
// plugin emits RFC7807-ish objects with `code`, `detail`, `title`, `errors` —
// preserve them when present, fall back to generic messages otherwise.
export function toError(err: unknown): ApiError {
  if (err && typeof err === "object") {
    const anyErr = err as {
      status?: number;
      value?: unknown;
      message?: string;
    };
    const status = typeof anyErr.status === "number" ? anyErr.status : 0;
    const v = anyErr.value;
    if (v && typeof v === "object") {
      const p = v as {
        code?: string;
        detail?: string;
        title?: string;
        errors?: unknown;
      };
      return new ApiError(
        status,
        p.code ?? String(status || "error"),
        p.detail ?? p.title ?? anyErr.message ?? "Request failed",
        p.errors
      );
    }
    if (typeof v === "string") {
      return new ApiError(status, String(status || "error"), v);
    }
    if (typeof anyErr.message === "string") {
      return new ApiError(status, String(status || "error"), anyErr.message);
    }
  }
  return new ApiError(0, "network_error", "Network error");
}

// Unwrap a treaty response: throw ApiError on error, return typed data on success.
// Endpoint modules wrap every call with this so callers continue to see their
// previous promise shape.
//
// The return is typed as `unknown` so that endpoint wrappers can narrow with a
// single `as ViewModel` assertion without needing the `as unknown as` two-step.
// Eden's inferred response shape uses `Date` for timestamp fields (it reflects
// what the handler returns) but JSON-on-the-wire is `string` — the hand-written
// view models in `./types` reflect that runtime truth, hence the narrowing cast.
export function unwrap<E>(resp: { data: unknown; error: E | null }): unknown {
  if (resp.error) throw toError(resp.error);
  return resp.data;
}
