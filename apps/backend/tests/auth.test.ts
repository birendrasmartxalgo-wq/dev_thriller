import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { getApp, request, resetDb } from "./_setup";
import type { Elysia } from "elysia";

let app: Elysia;

beforeAll(async () => {
  app = await getApp();
});

beforeEach(async () => {
  await resetDb();
});

describe("auth", () => {
  it("signs up, logs in, reads /me, refreshes, and logs out", async () => {
    const email = `alice-${Date.now()}@test.local`;
    const password = "correct-horse-battery-staple";

    const signup = await request(app, "/v1/auth/signup", {
      method: "POST",
      body: { email, password, name: "Alice" },
    });
    expect(signup.status).toBe(200);
    expect(signup.json.user.email).toBe(email);
    expect(signup.json.user.name).toBe("Alice");
    expect(typeof signup.json.access).toBe("string");
    expect(typeof signup.json.refresh).toBe("string");

    const login = await request(app, "/v1/auth/login", {
      method: "POST",
      body: { email, password },
    });
    expect(login.status).toBe(200);
    expect(login.json.user.email).toBe(email);
    expect(typeof login.json.access).toBe("string");

    const access: string = login.json.access;
    const refresh: string = login.json.refresh;

    // Protected endpoint: note the project's current prefix is /v1/auth/me.
    const meUnauthed = await request(app, "/v1/auth/me");
    expect(meUnauthed.status).toBe(401);

    const me = await request(app, "/v1/auth/me", { token: access });
    expect(me.status).toBe(200);
    expect(me.json.email).toBe(email);
    expect(me.json.name).toBe("Alice");
    expect(typeof me.json.id).toBe("string");

    const refreshed = await request(app, "/v1/auth/refresh", {
      method: "POST",
      body: { refreshToken: refresh },
    });
    expect(refreshed.status).toBe(200);
    expect(typeof refreshed.json.access).toBe("string");
    expect(typeof refreshed.json.refresh).toBe("string");
    // Old refresh token must no longer work (rotation).
    const reuse = await request(app, "/v1/auth/refresh", {
      method: "POST",
      body: { refreshToken: refresh },
    });
    expect(reuse.status).toBe(401);

    const logout = await request(app, "/v1/auth/logout", {
      method: "POST",
      token: refreshed.json.access,
      body: { refreshToken: refreshed.json.refresh },
    });
    expect(logout.status).toBe(200);
    expect(logout.json).toEqual({ ok: true });
  });

  it("rejects signup for duplicate email", async () => {
    const email = `dup-${Date.now()}@test.local`;
    const first = await request(app, "/v1/auth/signup", {
      method: "POST",
      body: { email, password: "password1234", name: "First" },
    });
    expect(first.status).toBe(200);
    const second = await request(app, "/v1/auth/signup", {
      method: "POST",
      body: { email, password: "password1234", name: "Second" },
    });
    expect(second.status).toBe(409);
  });

  it("rejects login with a wrong password", async () => {
    const email = `bad-${Date.now()}@test.local`;
    await request(app, "/v1/auth/signup", {
      method: "POST",
      body: { email, password: "password1234", name: "Bob" },
    });
    const bad = await request(app, "/v1/auth/login", {
      method: "POST",
      body: { email, password: "wrong-password" },
    });
    expect(bad.status).toBe(401);
  });
});
