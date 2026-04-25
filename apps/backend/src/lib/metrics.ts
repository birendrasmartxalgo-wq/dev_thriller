// In-memory metrics. Hand-rolled — no prom-client, no histogram library.
//
// Per route key (e.g. "GET /v1/projects/:id") we keep a fixed-size ring buffer
// of the last N samples. Append is O(1). Summarize sorts a copy of the buffer
// once per route (O(N log N)) which is fine for an admin endpoint.
//
// Hot path cost per request: one map lookup + one array assignment + one
// counter increment. No allocations beyond the sample object itself.

import { redis } from "@/db/dragonfly";

export interface Sample {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ts: number;
}

export interface RouteSummary {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
}

export interface MetricsSummary {
  routes: Record<string, RouteSummary>;
  queues: Record<string, number>;
  uptimeSec: number;
  totalRequests: number;
  generatedAt: string;
}

const RING_SIZE = Number(process.env.METRICS_RING_SIZE ?? 1024);
const startedAt = Date.now();

interface Ring {
  buf: Sample[];
  next: number; // next write index
  filled: boolean; // true once we've wrapped at least once
  count: number; // total samples observed for this route key (since process boot)
  errors: number; // total 5xx (and 4xx still count as success for SLO)
}

const rings = new Map<string, Ring>();
let totalRequests = 0;

function getRing(key: string): Ring {
  let r = rings.get(key);
  if (!r) {
    r = { buf: new Array<Sample>(RING_SIZE), next: 0, filled: false, count: 0, errors: 0 };
    rings.set(key, r);
  }
  return r;
}

// Collapse path params and query strings to a stable, low-cardinality key.
// If `route` is provided (Elysia's static template like "/v1/projects/:id"),
// trust it. Otherwise normalize the URL pathname.
const ID_RE = /\/(?:[0-9a-fA-F]{24}|[0-9a-fA-F-]{32,36})(?=\/|$)/g;
const NUM_RE = /\/\d+(?=\/|$)/g;
export function normalizePath(routeOrPath: string): string {
  // Strip query string defensively
  const q = routeOrPath.indexOf("?");
  let p = q >= 0 ? routeOrPath.slice(0, q) : routeOrPath;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  // ObjectId / UUID / numeric id segments → :id
  p = p.replace(ID_RE, "/:id").replace(NUM_RE, "/:id");
  return p || "/";
}

export function recordSample(method: string, path: string, status: number, durationMs: number): void {
  const key = `${method} ${path}`;
  const r = getRing(key);
  const sample: Sample = { method, path, status, durationMs, ts: Date.now() };
  r.buf[r.next] = sample;
  r.next = (r.next + 1) % RING_SIZE;
  if (r.next === 0) r.filled = true;
  r.count++;
  if (status >= 500) r.errors++;
  totalRequests++;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lo = sorted[base]!;
  const hi = sorted[base + 1] ?? lo;
  return lo + (hi - lo) * rest;
}

const QUEUE_KEYS = ["thumb:jobs"] as const;

async function readQueueDepths(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const k of QUEUE_KEYS) {
    try {
      out[k] = await redis.llen(k);
    } catch {
      out[k] = -1; // signal unreachable, don't crash the metrics endpoint
    }
  }
  return out;
}

export async function summarize(): Promise<MetricsSummary> {
  const routes: Record<string, RouteSummary> = {};
  for (const [key, r] of rings) {
    const live = r.filled ? r.buf : r.buf.slice(0, r.next);
    if (live.length === 0) continue;
    const durations = live.map((s) => s.durationMs).sort((a, b) => a - b);
    const errs = live.reduce((acc, s) => acc + (s.status >= 500 ? 1 : 0), 0);
    routes[key] = {
      count: r.count,
      p50: Math.round(quantile(durations, 0.5)),
      p95: Math.round(quantile(durations, 0.95)),
      p99: Math.round(quantile(durations, 0.99)),
      errorRate: live.length > 0 ? +(errs / live.length).toFixed(4) : 0,
    };
  }
  const queues = await readQueueDepths();
  return {
    routes,
    queues,
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    totalRequests,
    generatedAt: new Date().toISOString(),
  };
}

// FUTURE: Prometheus text-format exposition. Hand-rolled, no library.
// Emits one HELP/TYPE block per route metric plus queue gauges. Not wired by
// default — `/v1/admin/metrics` JSON is the canonical endpoint.
export async function summarizeProm(): Promise<string> {
  const s = await summarize();
  const lines: string[] = [];
  lines.push(`# HELP dt_http_requests_total Total HTTP requests by route key (since process boot).`);
  lines.push(`# TYPE dt_http_requests_total counter`);
  for (const [key, r] of Object.entries(s.routes)) {
    const safe = key.replace(/"/g, '\\"');
    lines.push(`dt_http_requests_total{route="${safe}"} ${r.count}`);
  }
  lines.push(`# HELP dt_http_request_duration_ms_p95 95th percentile request duration in ms.`);
  lines.push(`# TYPE dt_http_request_duration_ms_p95 gauge`);
  for (const [key, r] of Object.entries(s.routes)) {
    const safe = key.replace(/"/g, '\\"');
    lines.push(`dt_http_request_duration_ms_p95{route="${safe}"} ${r.p95}`);
  }
  lines.push(`# HELP dt_queue_depth Pending job count by queue key.`);
  lines.push(`# TYPE dt_queue_depth gauge`);
  for (const [k, v] of Object.entries(s.queues)) {
    lines.push(`dt_queue_depth{queue="${k}"} ${v}`);
  }
  lines.push(``);
  return lines.join("\n");
}

// Test-only / ops helper: clear all sampled state. Not exposed via HTTP.
export function _resetMetrics(): void {
  rings.clear();
  totalRequests = 0;
}
