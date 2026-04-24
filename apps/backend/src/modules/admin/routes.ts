import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { col } from "@/db/mongo";
import { authPlugin, requireAuth } from "@/middleware/auth";
import { Errors } from "@/lib/errors";
import { assertRoleAtLeast, getMembership } from "@/lib/acl";
import { sha256Hex } from "@/lib/hash";
import { writeAudit } from "@/lib/audit";

function oid(s: string) {
  if (!ObjectId.isValid(s)) throw Errors.badRequest("bad_id", "Invalid id");
  return new ObjectId(s);
}

async function requireAdmin(userId: ObjectId, workspaceId: ObjectId) {
  const mem = await getMembership(workspaceId, userId);
  if (!mem) throw Errors.forbidden();
  assertRoleAtLeast(mem.role, "admin");
  return mem;
}

export const adminRoutes = new Elysia({ prefix: "/v1/admin" })
  .use(authPlugin)

  .get(
    "/audit",
    async ({ auth, query }) => {
      requireAuth(auth);
      const wsId = oid(query.workspaceId);
      await requireAdmin(auth.userId, wsId);
      const filter: Record<string, any> = { workspaceId: wsId };
      if (query.actor) filter.actorId = oid(query.actor);
      if (query.verb) filter.verb = query.verb;
      if (query.from || query.to) {
        filter.createdAt = {};
        if (query.from) filter.createdAt.$gte = new Date(query.from);
        if (query.to) filter.createdAt.$lte = new Date(query.to);
      }
      const items = await col.activityLog().find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(query.limit ?? 100), 500)).toArray();
      return {
        items: items.map((a) => ({
          id: a._id.toHexString(),
          actorId: a.actorId.toHexString(),
          verb: a.verb,
          objectType: a.objectType,
          objectId: a.objectId?.toHexString() ?? null,
          metadata: a.metadata ?? null,
          hash: a.hash,
          prevHash: a.prevHash,
          createdAt: a.createdAt,
        })),
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        actor: t.Optional(t.String()),
        verb: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
      }),
    }
  )

  .get(
    "/audit/verify",
    async ({ auth, query }) => {
      requireAuth(auth);
      const wsId = oid(query.workspaceId);
      await requireAdmin(auth.userId, wsId);
      const cursor = col.activityLog().find({ workspaceId: wsId }).sort({ createdAt: 1 });
      let prevHash = "genesis";
      let ok = true;
      let brokenAt: string | null = null;
      while (await cursor.hasNext()) {
        const a = (await cursor.next())!;
        const payload = JSON.stringify({
          workspaceId: a.workspaceId.toHexString(),
          actorId: a.actorId.toHexString(),
          verb: a.verb,
          objectType: a.objectType,
          objectId: a.objectId?.toHexString() ?? null,
          metadata: a.metadata ?? null,
          createdAt: a.createdAt.toISOString(),
          prevHash,
        });
        const expected = await sha256Hex(payload);
        if (expected !== a.hash || a.prevHash !== prevHash) {
          ok = false;
          brokenAt = a._id.toHexString();
          break;
        }
        prevHash = a.hash;
      }
      return { ok, brokenAt };
    },
    { query: t.Object({ workspaceId: t.String() }) }
  )

  .get(
    "/storage",
    async ({ auth, query }) => {
      requireAuth(auth);
      const wsId = oid(query.workspaceId);
      await requireAdmin(auth.userId, wsId);
      const [agg] = await col
        .files()
        .aggregate([
          { $match: { workspaceId: wsId, deletedAt: { $exists: false } } },
          { $group: { _id: null, total: { $sum: "$sizeBytes" }, count: { $sum: 1 } } },
        ])
        .toArray();
      const byMime = await col
        .files()
        .aggregate([
          { $match: { workspaceId: wsId, deletedAt: { $exists: false } } },
          { $group: { _id: "$mime", size: { $sum: "$sizeBytes" }, count: { $sum: 1 } } },
          { $sort: { size: -1 } },
          { $limit: 20 },
        ])
        .toArray();
      return {
        totalBytes: agg?.total ?? 0,
        totalFiles: agg?.count ?? 0,
        byMime: byMime.map((r: any) => ({ mime: r._id, size: r.size, count: r.count })),
      };
    },
    { query: t.Object({ workspaceId: t.String() }) }
  )

  .get(
    "/users",
    async ({ auth, query }) => {
      requireAuth(auth);
      const wsId = oid(query.workspaceId);
      await requireAdmin(auth.userId, wsId);
      const mems = await col.memberships().find({ workspaceId: wsId }).toArray();
      const users = await col.users().find({ _id: { $in: mems.map((m) => m.userId) } }).toArray();
      const byId = new Map(users.map((u) => [u._id.toHexString(), u]));
      return {
        items: mems.map((m) => {
          const u = byId.get(m.userId.toHexString());
          return {
            userId: m.userId.toHexString(),
            email: u?.email ?? null,
            name: u?.name ?? null,
            role: m.role,
            status: m.status,
            lastSeenAt: u?.lastSeenAt ?? null,
          };
        }),
      };
    },
    { query: t.Object({ workspaceId: t.String() }) }
  )

  .patch(
    "/users/:uid/suspend",
    async ({ auth, params, body }) => {
      requireAuth(auth);
      const wsId = oid(body.workspaceId);
      await requireAdmin(auth.userId, wsId);
      const uid = oid(params.uid);
      await col.memberships().updateOne({ workspaceId: wsId, userId: uid }, { $set: { status: body.suspend ? "suspended" : "active" } });
      await writeAudit({
        workspaceId: wsId,
        actorId: auth.userId,
        verb: body.suspend ? "user.suspend" : "user.unsuspend",
        objectType: "user",
        objectId: uid,
      });
      return { ok: true };
    },
    {
      params: t.Object({ uid: t.String() }),
      body: t.Object({ workspaceId: t.String(), suspend: t.Boolean() }),
    }
  );
