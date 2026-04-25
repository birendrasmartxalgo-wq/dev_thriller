import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { col } from "@/db/mongo";
import { authPlugin, requireAuth } from "@/middleware/auth";
import { Errors } from "@/lib/errors";
import { getMembership } from "@/lib/acl";
import { writeAudit } from "@/lib/audit";
import { publishChat, publishWorkspace } from "@/ws/bus";

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
      // Hide archived unless explicitly requested.
      if (!query.includeArchived) filter.archivedAt = { $exists: false };
      filter.deletedAt = { $exists: false };
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
          archivedAt: c.archivedAt ?? null,
        })),
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        projectId: t.Optional(t.String()),
        includeArchived: t.Optional(t.Boolean()),
      }),
    }
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
        createdBy: chat.createdBy.toHexString(),
        archivedAt: chat.archivedAt ?? null,
      };
    },
    { params: t.Object({ id: t.String() }) }
  )

  // PATCH /v1/chats/:id — rename, set topic, archive/unarchive.
  // ACL: owner/admin of workspace OR original chat creator.
  .patch(
    "/:id",
    async ({ auth, params, body }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const chat = await col.chats().findOne({ _id: id });
      if (!chat) throw Errors.notFound("Chat");
      const mem = await getMembership(chat.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const isAdmin = mem.role === "owner" || mem.role === "admin";
      const isCreator = chat.createdBy.equals(auth.userId);
      if (!isAdmin && !isCreator) throw Errors.forbidden();

      const set: Record<string, unknown> = {};
      const unset: Record<string, "" | 1> = {};
      if (body.name !== undefined) set.name = body.name.trim();
      if (body.topic !== undefined) {
        if (body.topic === null || body.topic === "") unset.topic = "";
        else set.topic = body.topic;
      }
      if (body.archivedAt !== undefined) {
        if (body.archivedAt === null || body.archivedAt === false) unset.archivedAt = "";
        else set.archivedAt = new Date();
      }
      const update: Record<string, unknown> = {};
      if (Object.keys(set).length) update.$set = set;
      if (Object.keys(unset).length) update.$unset = unset;
      if (Object.keys(update).length) await col.chats().updateOne({ _id: id }, update);

      await writeAudit({
        workspaceId: chat.workspaceId,
        actorId: auth.userId,
        verb: "chat.update",
        objectType: "chat",
        objectId: id,
        metadata: { fields: Object.keys({ ...set, ...unset }) },
      });
      await publishWorkspace(chat.workspaceId.toHexString(), { type: "chat.updated", id: id.toHexString() });
      await publishChat(id.toHexString(), { type: "chat.updated", id: id.toHexString() });
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 80 })),
        topic: t.Optional(t.Union([t.String({ maxLength: 250 }), t.Null()])),
        archivedAt: t.Optional(t.Union([t.Null(), t.Boolean()])),
      }),
    }
  )

  // Soft-delete a chat. ACL: owner/admin or creator.
  .delete(
    "/:id",
    async ({ auth, params }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const chat = await col.chats().findOne({ _id: id });
      if (!chat) throw Errors.notFound("Chat");
      const mem = await getMembership(chat.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const isAdmin = mem.role === "owner" || mem.role === "admin";
      const isCreator = chat.createdBy.equals(auth.userId);
      if (!isAdmin && !isCreator) throw Errors.forbidden();
      await col.chats().updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
      await writeAudit({
        workspaceId: chat.workspaceId,
        actorId: auth.userId,
        verb: "chat.delete",
        objectType: "chat",
        objectId: id,
      });
      await publishWorkspace(chat.workspaceId.toHexString(), { type: "chat.deleted", id: id.toHexString() });
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) }
  )

  // GET /v1/chats/:id/pinned — up to 50 pinned messages, newest pin first.
  .get(
    "/:id/pinned",
    async ({ auth, params }) => {
      requireAuth(auth);
      const chatId = oid(params.id);
      const chat = await col.chats().findOne({ _id: chatId });
      if (!chat) throw Errors.notFound("Chat");
      const mem = await getMembership(chat.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const items = await col
        .messages()
        .find({ chatId, pinnedAt: { $exists: true }, deletedAt: { $exists: false } })
        .sort({ pinnedAt: -1 })
        .limit(50)
        .toArray();
      return {
        items: items.map((m) => ({
          id: m._id.toHexString(),
          chatId: m.chatId.toHexString(),
          authorId: m.authorId.toHexString(),
          body: m.body,
          createdAt: m.createdAt,
          pinnedAt: m.pinnedAt ?? null,
          pinnedBy: m.pinnedBy?.toHexString() ?? null,
        })),
      };
    },
    { params: t.Object({ id: t.String() }) }
  )

  // Jump: accept either at=<iso> or messageId=<id>. Returns the canonical cursor.
  .get(
    "/:id/jump",
    async ({ auth, params, query }) => {
      requireAuth(auth);
      const chatId = oid(params.id);
      const chat = await col.chats().findOne({ _id: chatId });
      if (!chat) throw Errors.notFound("Chat");
      const mem = await getMembership(chat.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();

      if (query.messageId) {
        const mid = oid(query.messageId);
        const m = await col.messages().findOne({ _id: mid, chatId });
        if (!m) return { cursor: null };
        return { cursor: encodeCursor(m.createdAt, m._id) };
      }
      if (!query.at) throw Errors.badRequest("bad_query", "Provide at or messageId");
      const at = new Date(query.at);
      if (isNaN(at.getTime())) throw Errors.badRequest("bad_date", "Invalid date");
      const m = await col.messages().find({ chatId, createdAt: { $gte: at } }).sort({ createdAt: 1 }).limit(1).next();
      if (!m) return { cursor: null };
      return { cursor: encodeCursor(m.createdAt, m._id) };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ at: t.Optional(t.String()), messageId: t.Optional(t.String()) }),
    }
  )

  .post(
    "/:id/read",
    async ({ auth, params, body }) => {
      requireAuth(auth);
      const chatId = oid(params.id);
      const chat = await col.chats().findOne({ _id: chatId });
      if (!chat) throw Errors.notFound("Chat");
      const mem = await getMembership(chat.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const messageId = oid(body.messageId);
      const m = await col.messages().findOne({ _id: messageId, chatId });
      if (!m) throw Errors.notFound("Message");
      await col.userChatState().updateOne(
        { userId: auth.userId, chatId },
        {
          $set: {
            workspaceId: chat.workspaceId,
            lastReadAt: m.createdAt,
            lastReadMessageId: messageId,
          },
          $setOnInsert: { mentionCount: 0 },
        },
        { upsert: true }
      );
      // Fan out a lightweight event so peers can update their "Seen by" footers
      // without polling. No DB writes per peer.
      await publishChat(chatId.toHexString(), {
        type: "read.update",
        chatId: chatId.toHexString(),
        userId: auth.userId.toHexString(),
        lastReadMessageId: messageId.toHexString(),
        lastReadAt: m.createdAt,
      });
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ messageId: t.String() }),
    }
  )

  .get(
    "/:id/read-state",
    async ({ auth, params }) => {
      requireAuth(auth);
      const chatId = oid(params.id);
      const chat = await col.chats().findOne({ _id: chatId });
      if (!chat) throw Errors.notFound("Chat");
      const mem = await getMembership(chat.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const rows = await col.userChatState().find({ chatId }).toArray();
      const items: Record<string, { lastReadMessageId: string | null; lastReadAt: string }> = {};
      for (const r of rows) {
        items[r.userId.toHexString()] = {
          lastReadMessageId: r.lastReadMessageId?.toHexString() ?? null,
          lastReadAt: r.lastReadAt.toISOString(),
        };
      }
      return { items };
    },
    { params: t.Object({ id: t.String() }) }
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
