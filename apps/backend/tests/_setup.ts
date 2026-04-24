/**
 * Shared test harness.
 *
 * Usage:
 *   import { getApp, resetDb, request } from "./_setup";
 *
 * - `getApp()` returns a memoized Elysia app handle built via `buildApp()`.
 * - `resetDb()` drops all application collections (but keeps indexes on the next boot).
 * - `request(app, ...)` wraps `app.handle(new Request(...))`.
 *
 * Boot order: this module sets NODE_ENV=test and forces a local Mongo + Dragonfly
 * target BEFORE importing anything that touches env.ts. It then connects Mongo +
 * Dragonfly once per process. Each test file should call `resetDb()` in a
 * `beforeEach` to start from a clean slate.
 */

import "./_env";
import { mock } from "bun:test";

// Mock R2 module before any route imports it. All calls return deterministic stubs.
mock.module("@/lib/r2", () => ({
  r2: () => {
    throw new Error("r2() should not be called in tests");
  },
  createMultipart: async (_key: string, _mime: string) => "test-upload-id",
  signPartUrl: async (_key: string, _uploadId: string, n: number) =>
    `https://r2.test.local/part/${n}?sig=stub`,
  completeMultipart: async () => {},
  abortMultipart: async () => {},
  signDownloadUrl: async (_key: string) => "https://r2.test.local/download?sig=stub",
  deleteObject: async () => {},
  statObject: async () => ({}),
  fileKey: (workspaceId: string, fileId: string, version: number, filename: string) => {
    const safe = filename.replace(/[^\w.\- ]/g, "_");
    return `workspaces/${workspaceId}/files/${fileId}/v${version}/${safe}`;
  },
  putObject: async () => {},
  uploadAvatar: async (key: string) => `https://r2.test.local/${key}?sig=stub`,
}));

// Mock the notify fan-out — it writes notifications but we don't want the
// auxiliary publish-to-redis latency fighting us in CI.
mock.module("@/lib/notify", () => ({
  notify: async () => {},
}));

// Mock the ws bus so message publish is a no-op in tests.
mock.module("@/ws/bus", () => ({
  localSubscribe: () => {},
  localUnsubscribe: () => {},
  cleanupSocket: () => {},
  startPubSub: async () => {},
  publishChat: async () => {},
  publishUser: async () => {},
  publishWorkspace: async () => {},
}));

import { client, connectMongo, db } from "@/db/mongo";
import { connectDragonfly, redis } from "@/db/dragonfly";
import { ensureIndexes } from "@/db/indexes";
import type { Elysia } from "elysia";

let _app: any | null = null;
let _booted = false;

async function bootOnce() {
  if (_booted) return;
  await connectMongo();
  await ensureIndexes();
  try {
    await connectDragonfly();
  } catch (err) {
    // Some environments don't have Dragonfly/Redis; rate-limit and acl tests will skip.
    console.warn("[tests] dragonfly connect failed:", (err as Error).message);
  }
  _booted = true;
}

export async function getApp() {
  await bootOnce();
  if (!_app) {
    const { buildApp } = await import("@/index");
    _app = buildApp();
  }
  return _app as Elysia;
}

export async function resetDb(): Promise<void> {
  await bootOnce();
  const collections = await db().listCollections().toArray();
  await Promise.all(
    collections.map((c) => db().collection(c.name).deleteMany({}))
  );
  // Clear redis keys the tests might touch (rate limits, acl cache).
  try {
    await redis.flushdb();
  } catch {
    // ignore if redis isn't available
  }
}

export async function closeAll(): Promise<void> {
  try {
    await client.close();
  } catch {}
  try {
    redis.disconnect();
  } catch {}
}

export interface RequestOpts {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
}

export async function request(
  app: Elysia,
  path: string,
  opts: RequestOpts = {}
): Promise<{ status: number; json: any; headers: Headers }> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
  if (opts.body !== undefined && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }
  const init: RequestInit = { method, headers };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }
  const res: Response = await app.handle(new Request(`http://test.local${path}`, init));
  let json: any = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  return { status: res.status, json, headers: res.headers };
}

/** Convenience: signup a fresh user and return { token, refresh, userId, email }. */
export async function signupUser(
  app: Elysia,
  overrides: { email?: string; password?: string; name?: string } = {}
) {
  const email = overrides.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`;
  const password = overrides.password ?? "password1234";
  const name = overrides.name ?? "Test User";
  const { status, json } = await request(app, "/v1/auth/signup", {
    method: "POST",
    body: { email, password, name },
  });
  if (status !== 200) throw new Error(`signup failed ${status}: ${JSON.stringify(json)}`);
  return {
    email,
    password,
    name,
    userId: json.user.id as string,
    token: json.access as string,
    refresh: json.refresh as string,
  };
}
