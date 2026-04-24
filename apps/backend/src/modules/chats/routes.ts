import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { col } from "@/db/mongo";
import { authPlugin, requireAuth } from "@/middleware/auth";
import { Errors } from "@/lib/errors";
import { getMembership } from "@/lib/acl";
import { writeAudit } from "@/lib/audit";

function oid(s: string) {
  if (!ObjectId.isValid(s)) throw Errors.badRequest("bad_id", "Invalid id");
  return new ObjectId(s);
}

export const chatRoutes = new Elysia({ prefix: "/v1/chats" })
  .use(authPlugin)

  .get(
    "/",
    async ({ auth, query }) => {
      requireAuth(auth);
      const wsId = oid(query.workspaceId);
      const mem = await getMembership(wsId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const filter: Record<string, unknown> = { workspaceId: wsId };
      if (query.projectId) filter.projectId = oid(query.projectId);
      const chats = await col.chats().find(filter).sort({ lastMessageAt: -1, createdAt: -1 }).toArray();
      return {
        items: chats.map((c) => ({
          id: c._id.toHexString(),
          name: c.name,
          type: c.type,
          projectId: c.projectId?.toHexString() ?? null,
          topic: c.topic ?? null,
          lastMessageAt: c.lastMessageAt ?? null,
          members: c.members?.map((m) => m.toHexString()) ?? null,
        })),
      };
    },
    { query: t.Object({ workspaceId: t.String(), projectId: t.Optional(t.String()) }) }
  )

  .post(
    "/",
    async ({ auth, body }) => {
      requireAuth(auth);
      const wsId = oid(body.workspaceId);
      const mem = await getMembership(wsId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const id = new ObjectId();
      const members = body.type === "dm" ? (body.members ?? []).map(oid) : undefined;
      if (body.type === "dm" && members && !members.some((m) => m.equals(auth.userId))) members.push(auth.userId);
      await col.chats().insertOne({
        _id: id,
        workspaceId: wsId,
        projectId: body.projectId ? oid(body.projectId) : undefined,
        type: body.type,
        name: body.name.trim(),
        topic: body.topic,
        members,
        createdBy: auth.userId,
        createdAt: new Date(),
      });
      await writeAudit({ workspaceId: wsId, actorId: auth.userId, verb: "chat.create", objectType: "chat", objectId: id });
      return { id: id.toHexString() };
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        projectId: t.Optional(t.String()),
        type: t.Union([t.Literal("channel"), t.Literal("dm"), t.Literal("thread")]),
        name: t.String({ minLength: 1, maxLength: 80 }),
        topic: t.Optional(t.String({ maxLength: 250 })),
        members: t.Optional(t.Array(t.String())),
      }),
    }
  )

  .get(
    "/:id",
    async ({ auth, params }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const chat = await col.chats().findOne({ _id: id });
      if (!chat) throw Errors.notFound("Chat");
      const mem = await getMembership(chat.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      if (chat.type === "dm" && !chat.members?.some((m) => m.equals(auth.userId))) throw Errors.forbidden();
      return {
        id: chat._id.toHexString(),
        workspaceId: chat.workspaceId.toHexString(),
        projectId: chat.projectId?.toHexString() ?? null,
        type: chat.type,
        name: chat.name,
        topic: chat.topic ?? null,
        members: chat.members?.map((m) => m.toHexString()) ?? null,
      };
    },
    { params: t.Object({ id: t.String() }) }
  )

  .get(
    "/:id/jump",
    async ({ auth, params, query }) => {
      requireAuth(auth);
      const chatId = oid(params.id);
      const chat = await col.chats().findOne({ _id: chatId });
      if (!chat) throw Errors.notFound("Chat");
      const mem = await getMembership(chat.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const at = new Date(query.at);
      if (isNaN(at.getTime())) throw Errors.badRequest("bad_date", "Invalid date");
      const m = await col.messages().find({ chatId, createdAt: { $gte: at } }).sort({ createdAt: 1 }).limit(1).next();
      if (!m) return { cursor: null };
      return { cursor: encodeCursor(m.createdAt, m._id) };
    },
    { params: t.Object({ id: t.String() }), query: t.Object({ at: t.String() }) }
  );

export function encodeCursor(createdAt: Date, id: ObjectId): string {
  return Buffer.from(JSON.stringify({ t: createdAt.toISOString(), i: id.toHexString() })).toString("base64url");
}

export function decodeCursor(cursor: string): { t: Date; i: ObjectId } | null {
  try {
    const { t, i } = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return { t: new Date(t), i: new ObjectId(i) };
  } catch {
    return null;
  }
}
