import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { ObjectId } from "mongodb";
import { getApp, request, resetDb, signupUser } from "./_setup";
import { col } from "@/db/mongo";
import { getBit } from "@/lib/bitmap";
import type { Elysia } from "elysia";

let app: Elysia;

beforeAll(async () => {
  app = await getApp();
});

beforeEach(async () => {
  await resetDb();
});

async function setupWorkspace(app: Elysia) {
  const alice = await signupUser(app);
  const ws = await request(app, "/v1/workspaces", {
    method: "POST",
    token: alice.token,
    body: { name: "Uploads Inc", slug: `up-${Date.now()}` },
  });
  expect(ws.status).toBe(200);
  return { alice, workspaceId: ws.json.id as string };
}

describe("uploads", () => {
  it("initiates a multipart upload and returns the right bitmap shape", async () => {
    const { alice, workspaceId } = await setupWorkspace(app);

    const chunkSize = 5 * 1024 * 1024; // 5 MB
    const size = chunkSize * 3 + 1024; // 4 chunks
    const init = await request(app, "/v1/uploads", {
      method: "POST",
      token: alice.token,
      body: {
        workspaceId,
        filename: "big.bin",
        mime: "application/octet-stream",
        size,
        checksum: "deadbeefcafebabe",
        chunkSize,
      },
    });
    expect(init.status).toBe(200);
    expect(init.json.totalChunks).toBe(4);
    expect(init.json.chunkSize).toBe(chunkSize);
    expect(init.json.chunkUrls.length).toBe(4);
    const uploadId: string = init.json.uploadId;

    // Status before any chunk: all 4 bits should be missing.
    const status0 = await request(app, `/v1/uploads/${uploadId}/status`, {
      token: alice.token,
    });
    expect(status0.status).toBe(200);
    expect(status0.json.status).toBe("initiated");
    expect(status0.json.totalChunks).toBe(4);
    expect(status0.json.missing).toEqual([1, 2, 3, 4]);

    // Simulate receiving chunk 2 (skipping 1 for the moment) — resume semantics.
    const ack2 = await request(app, `/v1/uploads/${uploadId}/chunks/2`, {
      method: "POST",
      token: alice.token,
      body: { etag: "etag-2", size: chunkSize },
    });
    expect(ack2.status).toBe(200);

    const status1 = await request(app, `/v1/uploads/${uploadId}/status`, {
      token: alice.token,
    });
    expect(status1.status).toBe(200);
    expect(status1.json.status).toBe("uploading");
    expect(status1.json.missing).toEqual([1, 3, 4]);

    // Verify the stored bitmap directly — bit index 1 should be set (chunk 2 = idx 1).
    const sess = await col
      .uploadSessions()
      .findOne({ _id: new ObjectId(uploadId) });
    expect(sess).not.toBeNull();
    const bitmap = Buffer.from(sess!.receivedBitmap.buffer);
    expect(getBit(bitmap, 0)).toBe(false); // chunk 1 missing
    expect(getBit(bitmap, 1)).toBe(true);  // chunk 2 received
    expect(getBit(bitmap, 2)).toBe(false);
    expect(getBit(bitmap, 3)).toBe(false);

    // Resume: client restarts and sends the rest out of order.
    for (const n of [1, 4, 3]) {
      const ack = await request(app, `/v1/uploads/${uploadId}/chunks/${n}`, {
        method: "POST",
        token: alice.token,
        body: { etag: `etag-${n}`, size: chunkSize },
      });
      expect(ack.status).toBe(200);
    }

    const status2 = await request(app, `/v1/uploads/${uploadId}/status`, {
      token: alice.token,
    });
    expect(status2.json.missing).toEqual([]);

    // Re-acknowledging an already-received chunk should be idempotent.
    const reAck = await request(app, `/v1/uploads/${uploadId}/chunks/2`, {
      method: "POST",
      token: alice.token,
      body: { etag: "etag-2", size: chunkSize },
    });
    expect(reAck.status).toBe(200);
  });

  it("rejects chunk indexes outside the expected range", async () => {
    const { alice, workspaceId } = await setupWorkspace(app);
    const init = await request(app, "/v1/uploads", {
      method: "POST",
      token: alice.token,
      body: {
        workspaceId,
        filename: "small.bin",
        mime: "application/octet-stream",
        size: 10,
        checksum: "deadbeef1234",
        chunkSize: 5 * 1024 * 1024,
      },
    });
    expect(init.status).toBe(200);
    const uploadId: string = init.json.uploadId;

    const bad = await request(app, `/v1/uploads/${uploadId}/chunks/9`, {
      method: "POST",
      token: alice.token,
      body: { etag: "x", size: 1 },
    });
    expect(bad.status).toBe(400);
  });
});
