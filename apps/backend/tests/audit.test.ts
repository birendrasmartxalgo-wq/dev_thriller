import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { ObjectId } from "mongodb";
import { getApp, request, resetDb, signupUser } from "./_setup";
import { col } from "@/db/mongo";
import { sha256Hex } from "@/lib/hash";
import type { Elysia } from "elysia";

let app: Elysia;

beforeAll(async () => {
  app = await getApp();
});

beforeEach(async () => {
  await resetDb();
});

describe("audit log hash chain", () => {
  it("produces a verifiable prev/hash chain across several audited actions", async () => {
    const alice = await signupUser(app, { name: "Alice" });
    const bob = await signupUser(app, { name: "Bob" });

    // 1. Create workspace (writes one audit entry).
    const ws = await request(app, "/v1/workspaces", {
      method: "POST",
      token: alice.token,
      body: { name: "Audit Co", slug: `audit-${Date.now()}` },
    });
    expect(ws.status).toBe(200);
    const workspaceId: string = ws.json.id;

    // 2. Invite Bob (writes one audit entry).
    const invite = await request(app, `/v1/workspaces/${workspaceId}/invites`, {
      method: "POST",
      token: alice.token,
      body: { emails: [bob.email], role: "member" },
    });
    expect(invite.status).toBe(200);
    const inviteToken: string = invite.json.invites[0].token;

    // Bob accepts (workspace.join audit entry).
    const accept = await request(app, `/v1/auth/invites/${inviteToken}/accept`, {
      method: "POST",
      token: bob.token,
    });
    expect(accept.status).toBe(200);

    // 3. Change Bob's role (member.role_change audit entry).
    const roleChange = await request(
      app,
      `/v1/workspaces/${workspaceId}/members/${bob.userId}`,
      {
        method: "PATCH",
        token: alice.token,
        body: { role: "admin" },
      }
    );
    expect(roleChange.status).toBe(200);

    // 4. Delete a file — insert a file doc directly so we don't need R2 for the
    //    upload flow. The delete route only needs membership + ownership checks.
    const fileId = new ObjectId();
    await col.files().insertOne({
      _id: fileId,
      workspaceId: new ObjectId(workspaceId),
      uploaderId: new ObjectId(alice.userId),
      name: "notes.txt",
      mime: "text/plain",
      sizeBytes: 42,
      checksum: "deadbeef",
      r2Key: "test/key",
      version: 1,
      createdAt: new Date(),
    });
    const del = await request(app, `/v1/files/${fileId.toHexString()}`, {
      method: "DELETE",
      token: alice.token,
    });
    expect(del.status).toBe(200);

    // Read all audit entries in insertion order.
    const entries = await col
      .activityLog()
      .find({ workspaceId: new ObjectId(workspaceId) })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();

    // We expect at least the four above + the role_change + join.
    const verbs = entries.map((e) => e.verb);
    expect(verbs).toContain("workspace.create");
    expect(verbs).toContain("workspace.invite");
    expect(verbs).toContain("workspace.join");
    expect(verbs).toContain("member.role_change");
    expect(verbs).toContain("file.delete");

    // Recompute the chain and verify every entry's hash.
    let prevHash = "genesis";
    for (const e of entries) {
      expect(e.prevHash).toBe(prevHash);
      const payload = JSON.stringify({
        workspaceId: e.workspaceId.toHexString(),
        actorId: e.actorId.toHexString(),
        verb: e.verb,
        objectType: e.objectType,
        objectId: e.objectId?.toHexString() ?? null,
        metadata: e.metadata ?? null,
        createdAt: e.createdAt.toISOString(),
        prevHash: e.prevHash,
      });
      const expected = await sha256Hex(payload);
      expect(e.hash).toBe(expected);
      prevHash = e.hash;
    }

    // Tampering with one entry's metadata should break the recomputed chain.
    if (entries.length > 1) {
      const victim = entries[1]!;
      const tamperedPayload = JSON.stringify({
        workspaceId: victim.workspaceId.toHexString(),
        actorId: victim.actorId.toHexString(),
        verb: "evil.tampered",
        objectType: victim.objectType,
        objectId: victim.objectId?.toHexString() ?? null,
        metadata: victim.metadata ?? null,
        createdAt: victim.createdAt.toISOString(),
        prevHash: victim.prevHash,
      });
      const tamperedHash = await sha256Hex(tamperedPayload);
      expect(tamperedHash).not.toBe(victim.hash);
    }
  });
});
