// Notifications module.
// GET    /v1/notifications          — list current user's notifications (newest first)
// PATCH  /v1/notifications/:id/read — mark a single notification read
// POST   /v1/notifications/read-all — mark everything in an optional workspace read
// Server-side creators live in `@/lib/notify` and fire from messages/routes.ts.

import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { col } from "@/db/mongo";
import { authPlugin, requireAuth } from "@/middleware/auth";
import { Errors } from "@/lib/errors";

function oid(s: string) {
  if (!ObjectId.isValid(s)) throw Errors.badRequest("bad_id", "Invalid id");
  return new ObjectId(s);
}

export const notificationRoutes = new Elysia({ prefix: "/v1/notifications" })
  .use(authPlugin)

  .get(
    "/",
    async ({ auth, query }) => {
      requireAuth(auth);
      const filter: Record<string, unknown> = { userId: auth.userId };
      if (query.workspaceId) filter.workspaceId = oid(query.workspaceId);
      if (query.unread) filter.readAt = { $exists: false };
      if (query.kind) filter.kind = query.kind;
      const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 200);
      const items = await col
        .notifications()
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      return {
        items: items.map((n) => ({
          id: n._id.toHexString(),
          kind: n.kind,
          payload: n.payload,
          workspaceId: n.workspaceId?.toHexString() ?? null,
          readAt: n.readAt ?? null,
          createdAt: n.createdAt,
        })),
      };
    },
    {
      query: t.Object({
        workspaceId: t.Optional(t.String()),
        kind: t.Optional(t.String()),
        unread: t.Optional(t.Boolean()),
        limit: t.Optional(t.Numeric()),
      }),
    }
  )

  .patch(
    "/:id/read",
    async ({ auth, params }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const r = await col
        .notifications()
        .updateOne({ _id: id, userId: auth.userId }, { $set: { readAt: new Date() } });
      if (r.matchedCount === 0) throw Errors.notFound("Notification");
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) }
  )

  .post(
    "/read-all",
    async ({ auth, body }) => {
      requireAuth(auth);
      const filter: Record<string, unknown> = { userId: auth.userId, readAt: { $exists: false } };
      if (body?.workspaceId) filter.workspaceId = oid(body.workspaceId);
      const r = await col.notifications().updateMany(filter, { $set: { readAt: new Date() } });
      return { ok: true, count: r.modifiedCount };
    },
    { body: t.Optional(t.Object({ workspaceId: t.Optional(t.String()) })) }
  );
