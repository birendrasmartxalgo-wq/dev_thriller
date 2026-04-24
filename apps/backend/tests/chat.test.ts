import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { ObjectId } from "mongodb";
import { getApp, request, resetDb, signupUser } from "./_setup";
import { col } from "@/db/mongo";
import type { Elysia } from "elysia";

let app: Elysia;

beforeAll(async () => {
  app = await getApp();
});

beforeEach(async () => {
  await resetDb();
});

describe("chat", () => {
  it("runs a full create/send/list/edit/delete lifecycle", async () => {
    const alice = await signupUser(app);

    // Create workspace.
    const ws = await request(app, "/v1/workspaces", {
      method: "POST",
      token: alice.token,
      body: { name: "Acme", slug: `acme-${Date.now()}` },
    });
    expect(ws.status).toBe(200);
    const workspaceId: string = ws.json.id;

    // Create chat.
    const chat = await request(app, "/v1/chats", {
      method: "POST",
      token: alice.token,
      body: {
        workspaceId,
        type: "channel",
        name: "general",
      },
    });
    expect(chat.status).toBe(200);
    const chatId: string = chat.json.id;
    expect(typeof chatId).toBe("string");

    // Send several messages so cursor pagination has something to walk.
    const sent: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await request(app, `/v1/chats/${chatId}/messages`, {
        method: "POST",
        token: alice.token,
        body: { body: `hello #${i}` },
      });
      expect(r.status).toBe(200);
      expect(r.json.body).toBe(`hello #${i}`);
      sent.push(r.json.id);
    }

    // List messages, small limit to force pagination.
    const page1 = await request(app, `/v1/chats/${chatId}/messages?limit=3`, {
      token: alice.token,
    });
    expect(page1.status).toBe(200);
    expect(page1.json.items.length).toBe(3);
    expect(page1.json.hasMore).toBe(true);
    expect(typeof page1.json.nextCursor).toBe("string");

    const page2 = await request(
      app,
      `/v1/chats/${chatId}/messages?limit=3&cursor=${encodeURIComponent(page1.json.nextCursor)}`,
      { token: alice.token }
    );
    expect(page2.status).toBe(200);
    expect(page2.json.items.length).toBeGreaterThan(0);

    // Edit the first message.
    const firstId = sent[0]!;
    const edit = await request(app, `/v1/messages/${firstId}`, {
      method: "PATCH",
      token: alice.token,
      body: { body: "edited!" },
    });
    expect(edit.status).toBe(200);
    expect(edit.json.body).toBe("edited!");
    expect(edit.json.editedAt).toBeTruthy();

    // Delete it (soft delete).
    const del = await request(app, `/v1/messages/${firstId}`, {
      method: "DELETE",
      token: alice.token,
    });
    expect(del.status).toBe(200);
    expect(del.json.ok).toBe(true);

    // Mongo row must retain the doc with deletedAt set.
    const doc = await col.messages().findOne({ _id: new ObjectId(firstId) });
    expect(doc).not.toBeNull();
    expect(doc!.deletedAt).toBeTruthy();

    // Default listing hides deleted messages.
    const afterDelete = await request(app, `/v1/chats/${chatId}/messages?limit=50`, {
      token: alice.token,
    });
    expect(afterDelete.status).toBe(200);
    const ids: string[] = afterDelete.json.items.map((m: any) => m.id);
    expect(ids).not.toContain(firstId);

    // includeDeleted=true surfaces them again (body blanked).
    const withDeleted = await request(
      app,
      `/v1/chats/${chatId}/messages?limit=50&includeDeleted=true`,
      { token: alice.token }
    );
    expect(withDeleted.status).toBe(200);
    const deletedEntry = withDeleted.json.items.find((m: any) => m.id === firstId);
    expect(deletedEntry).toBeTruthy();
    expect(deletedEntry.body).toBe("");
    expect(deletedEntry.deletedAt).toBeTruthy();
  });
});
