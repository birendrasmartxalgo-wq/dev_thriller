// Security headers + request-id. Applied as a top-level Elysia via `.use(applySecurity)`.
// Using `Elysia.onAfterHandle` at the root scope so it runs for every route.

import { Elysia } from "elysia";
import { randomBytes } from "node:crypto";
import { isProd } from "@/config/env";

const baseHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const prodHeaders: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https: wss:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'",
};

function genRequestId(incoming: string | null): string {
  return incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomBytes(8).toString("hex");
}

// Mount via: app.use(applySecurity)
export function applySecurity(app: Elysia) {
  return app
    .onRequest(({ request, set }) => {
      const rid = genRequestId(request.headers.get("x-request-id"));
      for (const [k, v] of Object.entries(baseHeaders)) set.headers[k] = v;
      if (isProd) for (const [k, v] of Object.entries(prodHeaders)) set.headers[k] = v;
      set.headers["X-Request-Id"] = rid;
    });
}
