// Combined access log + metrics recorder.
//
// One JSON line per response at info level. Skips /health and /metrics.
// We piggyback on the same hook to call `metrics.recordSample`, so the hot
// path is one logger call + one ring-buffer push.

import { Elysia } from "elysia";
import { logger } from "@/lib/logger";
import { recordSample, normalizePath } from "@/lib/metrics";

const SKIP = new Set(["/health", "/metrics"]);

// Module-scoped WeakMap of request → start time. We can't always rely on
// Elysia's `set.startedAt` across versions, and onRequest fires before
// onAfterResponse so this is the simplest cross-version approach.
const starts = new WeakMap<Request, number>();

export const accessLogPlugin = new Elysia({ name: "accessLog" })
  .onRequest(({ request }) => {
    starts.set(request, performance.now());
  })
  .onAfterResponse((ctx: any) => {
    try {
      const { request, set } = ctx;
      const auth = ctx.auth as { userId?: { toHexString(): string } } | null | undefined;
      const start = starts.get(request) ?? performance.now();
      const durationMs = Math.round(performance.now() - start);

      // Prefer Elysia's static route template (e.g. "/v1/projects/:id").
      // Fall back to URL pathname normalized for unknown routes (404s, etc).
      let path: string;
      if (typeof ctx.route === "string" && ctx.route.length > 0) {
        path = ctx.route;
      } else {
        try {
          path = normalizePath(new URL(request.url).pathname);
        } catch {
          path = "/";
        }
      }

      const status = typeof set?.status === "number" ? set.status : 200;
      const method = request.method;

      // Always feed metrics — even for /health and /metrics, so ops can see them.
      recordSample(method, path, status, durationMs);

      if (SKIP.has(path)) return;

      const requestId = (set?.headers?.["x-request-id"] as string | undefined) ?? "-";
      const ip = request.headers.get("x-forwarded-for") ?? "-";
      const contentLength = Number(set?.headers?.["content-length"] ?? request.headers.get("content-length") ?? 0);
      const userId = auth?.userId?.toHexString?.() ?? "-";

      logger.info(
        {
          method,
          path,
          status,
          durationMs,
          userId,
          requestId,
          contentLength: Number.isFinite(contentLength) ? contentLength : 0,
          ip,
        },
        "http"
      );
    } catch (err) {
      // Never let logging break a response.
      logger.warn({ err }, "accessLog hook failure");
    }
  });

export function applyAccessLog<T extends Elysia<any, any, any, any, any, any, any>>(app: T): T {
  return app.use(accessLogPlugin) as unknown as T;
}
