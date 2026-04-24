import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { col } from "@/db/mongo";
import { authPlugin, requireAuth } from "@/middleware/auth";
import { Errors } from "@/lib/errors";
import { getMembership, assertRoleAtLeast } from "@/lib/acl";
import { writeAudit } from "@/lib/audit";
import { decodeCursor, encodeCursor } from "../chats/routes";
import { publishChat } from "@/ws/bus";
import { notify } from "@/lib/notify";
import { enforceRateLimit } from "@/lib/rate-limit";
import { signDownloadUrl } from "@/lib/r2";
import type { MessageAttachment, MessageDoc } from "@/db/types";

function oid(s: string) {
  if (!ObjectId.isValid(s)) throw Errors.badRequest("bad_id", "Invalid id");
  return new ObjectId(s);
}

function publicMessage(m: MessageDoc) {
  return {
    id: m._id.toHexString(),
    chatId: m.chatId.toHexString(),
    authorId: m.authorId.toHexString(),
    parentId: m.parentId?.toHexString() ?? null,
    body: m.deletedAt ? "" : m.body,
    mentions: m.mentions?.map((x) => x.toHexString()) ?? [],
    attachments: m.attachments ?? [],
    reactions: Object.fromEntries(
      Object.entries(m.reactions ?? {}).map(([k, v]) => [k, (v as ObjectId[]).map((x) => x.toHexString())])
    ),
    pinnedAt: m.pinnedAt ?? null,
    pinnedBy: m.pinnedBy?.toHexString() ?? null,
    createdAt: m.createdAt,
    editedAt: m.editedAt ?? null,
    deletedAt: m.deletedAt ?? null,
  };
}

// Parse @Name tokens in the body. We look up each name (greedy, matches up to 3 words)
// against the chat's workspace members. First exact case-insensitive match wins.
async function resolveBodyMentions(body: string, workspaceId: ObjectId): Promise<ObjectId[]> {
  const re = /@([A-Za-z][A-Za-z0-9._-]*(?:\s+[A-Za-z][A-Za-z0-9._-]*){0,2})/g;
  const raw = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) raw.add(m[1]!.trim());
  if (raw.size === 0) return [];
  const mems = await col.memberships().find({ workspaceId, status: "active" }).toArray();
  const uids = mems.map((x) => x.userId);
  const users = await col.users().find({ _id: { $in: uids } }).toArray();
  const byName = new Map<string, ObjectId>();
  for (const u of users) byName.set(u.name.toLowerCase(), u._id);
  const result: ObjectId[] = [];
  const seen = new Set<string>();
  for (const token of raw) {
    // try longest → shortest prefix so "@Ada Lovelace" matches before "@Ada"
    const parts = token.split(/\s+/);
    for (let n = parts.length; n >= 1; n--) {
      const candidate = parts.slice(0, n).join(" ").toLowerCase();
      const uid = byName.get(candidate);
      if (uid && !seen.has(uid.toHexString())) {
        result.push(uid);
        seen.add(uid.toHexString());
        break;
      }
    }
  }
  return result;
}

// Simple URL + mention extractors for media-tab + notifications.
function extractUrls(body: string): string[] {
  const re = /https?:\/\/[^\s<>"']+/g;
  return (body.match(re) ?? []).slice(0, 10);
}
function classifyUrlKind(url: string): "image" | "video" | "doc" | "audio" | "link" {
  const u = url.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/.test(u)) return "image";
  if (/\.(mp4|webm|mov|mkv|avi)(\?|$)/.test(u)) return "video";
  if (/\.(mp3|wav|m4a|flac|ogg)(\?|$)/.test(u)) return "audio";
  if (/\.(pdf|docx?|xlsx?|pptx?|txt|md|csv)(\?|$)/.test(u)) return "doc";
  return "link";
}

async function addMedia(message: MessageDoc) {
  const rows: Array<any> = [];
  for (const a of message.attachments ?? []) {
    const kind: "image" | "video" | "doc" | "audio" = a.mime.startsWith("image/")
      ? "image"
      : a.mime.startsWith("video/")
      ? "video"
      : a.mime.startsWith("audio/")
      ? "audio"
      : "doc";
    rows.push({
      _id: new ObjectId(),
      chatId: message.chatId,
      workspaceId: message.workspaceId,
      kind,
      fileId: a.fileId,
      senderId: message.authorId,
      sizeBytes: a.sizeBytes,
      metadata: { name: a.name, mime: a.mime, thumbnailKey: a.thumbnailKey },
      createdAt: message.createdAt,
    });
  }
  for (const url of extractUrls(message.body)) {
    rows.push({
      _id: new ObjectId(),
      chatId: message.chatId,
      workspaceId: message.workspaceId,
      kind: classifyUrlKind(url),
      url,
      senderId: message.authorId,
      createdAt: message.createdAt,
    });
  }
  if (rows.length) await col.chatMedia().insertMany(rows);
}

export const messageRoutes = new Elysia({ prefix: "/v1" })
  .use(authPlugin)

  .get(
    "/chats/:id/messages",
    async ({ auth, params, query }) => {
      requireAuth(auth);
      const chatId = oid(params.id);
      const chat = await col.chats().findOne({ _id: chatId });
      if (!chat) throw Errors.notFound("Chat");
      const mem = await getMembership(chat.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();

      const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 100);
      const direction = query.direction ?? "before";
      const filter: Record<string, unknown> = { chatId };
      if (!query.includeDeleted) filter.deletedAt = { $exists: false };
      if (query.cursor) {
        const c = decodeCursor(query.cursor);
        if (!c) throw Errors.badRequest("bad_cursor", "Invalid cursor");
        filter.createdAt = direction === "before" ? { $lt: c.t } : { $gt: c.t };
      }

      const sort: Record<string, 1 | -1> = { createdAt: direction === "before" ? -1 : 1 };
      const items = await col.messages().find(filter).sort(sort).limit(limit + 1).toArray();
      const hasMore = items.length > limit;
      const page = items.slice(0, limit);
      if (direction === "before") page.reverse();
      const nextCursor = hasMore
        ? encodeCursor(
            page[direction === "before" ? 0 : page.length - 1]!.createdAt,
            page[direction === "before" ? 0 : page.length - 1]!._id
          )
        : null;
      return {
        items: page.map(publicMessage),
        nextCursor,
        hasMore,
      };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        cursor: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
        direction: t.Optional(t.Union([t.Literal("before"), t.Literal("after")])),
        includeDeleted: t.Optional(t.Boolean()),
      }),
    }
  )

  .post(
    "/chats/:id/messages",
    async ({ auth, params, body }) => {
      requireAuth(auth);
      await enforceRateLimit(`${auth.userId.toHexString()}:${params.id}`, {
        bucket: "msg:send",
        limit: 120,
        windowSec: 60,
      });
      const chatId = oid(params.id);
      const chat = await col.chats().findOne({ _id: chatId });
      if (!chat) throw Errors.notFound("Chat");
      const mem = await getMembership(chat.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      assertRoleAtLeast(mem.role, "guest");
      // Per-user msg:send rate limiter — 60 messages / 60s.
      await enforceRateLimit(auth.userId.toHexString(), { bucket: "msg:send", limit: 60, windowSec: 60 });

      const now = new Date();
      const id = new ObjectId();
      const attachments: MessageAttachment[] = [];
      for (const a of body.attachments ?? []) {
        const fid = oid(a.fileId);
        const f = await col.files().findOne({ _id: fid, workspaceId: chat.workspaceId, deletedAt: { $exists: false } });
        if (!f) throw Errors.badRequest("bad_attachment", `File ${a.fileId} not found`);
        attachments.push({
          fileId: f._id,
          name: f.name,
          mime: f.mime,
          sizeBytes: f.sizeBytes,
        });
      }

      // Merge client-provided mentions (explicit IDs from autocomplete) with ones
      // we parse from the body. Plain-text "@Name" is the source of truth visually;
      // mentions[] on the doc is the sidecar list used for notifications + filtering.
      const explicitMentions = (body.mentions ?? []).map(oid);
      const parsedMentions = await resolveBodyMentions(body.body, chat.workspaceId);
      const mentionSet = new Map<string, ObjectId>();
      for (const m of [...explicitMentions, ...parsedMentions]) {
        mentionSet.set(m.toHexString(), m);
      }
      const mentions = [...mentionSet.values()];

      const doc: MessageDoc = {
        _id: id,
        chatId,
        workspaceId: chat.workspaceId,
        authorId: auth.userId,
        parentId: body.parentId ? oid(body.parentId) : undefined,
        body: body.body,
        mentions,
        attachments: attachments.length ? attachments : undefined,
        createdAt: now,
      };
      await col.messages().insertOne(doc);
      await col.chats().updateOne({ _id: chatId }, { $set: { lastMessageAt: now } });
      await addMedia(doc);

      const payload = publicMessage(doc);
      await publishChat(chatId.toHexString(), { type: "message.created", message: payload });

      // Fan-out notifications for mentions + DM participants (exclude the author).
      const recipients = new Map<string, "mention" | "dm" | "reply">();
      for (const m of doc.mentions ?? []) {
        if (!m.equals(auth.userId)) recipients.set(m.toHexString(), "mention");
      }
      if (chat.type === "dm" && chat.members) {
        for (const m of chat.members) {
          if (!m.equals(auth.userId) && !recipients.has(m.toHexString())) recipients.set(m.toHexString(), "dm");
        }
      }
      if (doc.parentId) {
        // Notify the author of the parent message as a thread reply.
        const parent = await col.messages().findOne({ _id: doc.parentId });
        if (parent && !parent.authorId.equals(auth.userId) && !recipients.has(parent.authorId.toHexString())) {
          recipients.set(parent.authorId.toHexString(), "reply");
        }
      }
      await Promise.all(
        Array.from(recipients, ([uid, kind]) =>
          notify({
            userId: new ObjectId(uid),
            workspaceId: chat.workspaceId,
            kind,
            payload: {
              chatId: chatId.toHexString(),
              chatName: chat.name,
              messageId: id.toHexString(),
              authorId: auth.userId.toHexString(),
              snippet: doc.body.slice(0, 160),
              hasAttachments: Boolean(doc.attachments?.length),
            },
          })
        )
      );

      return payload;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        body: t.String({ minLength: 1, maxLength: 10_000 }),
        parentId: t.Optional(t.String()),
        mentions: t.Optional(t.Array(t.String())),
        attachments: t.Optional(t.Array(t.Object({ fileId: t.String() }))),
      }),
    }
  )

  .patch(
    "/messages/:id",
    async ({ auth, params, body }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const m = await col.messages().findOne({ _id: id });
      if (!m || m.deletedAt) throw Errors.notFound("Message");
      if (!m.authorId.equals(auth.userId)) throw Errors.forbidden("Only the author can edit");
      await col.messages().updateOne({ _id: id }, { $set: { body: body.body, editedAt: new Date() } });
      const updated = await col.messages().findOne({ _id: id });
      const payload = publicMessage(updated!);
      await publishChat(m.chatId.toHexString(), { type: "message.updated", message: payload });
      return payload;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ body: t.String({ minLength: 1, maxLength: 10_000 }) }),
    }
  )

  .delete(
    "/messages/:id",
    async ({ auth, params }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const m = await col.messages().findOne({ _id: id });
      if (!m || m.deletedAt) throw Errors.notFound("Message");
      const mem = await getMembership(m.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const isAuthor = m.authorId.equals(auth.userId);
      const isAdmin = mem.role === "owner" || mem.role === "admin";
      if (!isAuthor && !isAdmin) throw Errors.forbidden();
      await col.messages().updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
      await publishChat(m.chatId.toHexString(), { type: "message.deleted", id: id.toHexString() });
      await writeAudit({ workspaceId: m.workspaceId, actorId: auth.userId, verb: "message.delete", objectType: "message", objectId: id });
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) }
  )

  .post(
    "/messages/:id/reactions",
    async ({ auth, params, body }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const m = await col.messages().findOne({ _id: id });
      if (!m || m.deletedAt) throw Errors.notFound("Message");
      const mem = await getMembership(m.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const emoji = body.emoji;
      const field = `reactions.${emoji}`;
      if (body.action === "add") {
        await col.messages().updateOne({ _id: id }, { $addToSet: { [field]: auth.userId } as any });
      } else {
        await col.messages().updateOne({ _id: id }, { $pull: { [field]: auth.userId } as any });
      }
      const updated = await col.messages().findOne({ _id: id });
      const payload = publicMessage(updated!);
      await publishChat(m.chatId.toHexString(), { type: "message.reacted", message: payload });
      return payload;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        emoji: t.String({ minLength: 1, maxLength: 24 }),
        action: t.Union([t.Literal("add"), t.Literal("remove")]),
      }),
    }
  )

  .get(
    "/chats/:id/media",
    async ({ auth, params, query }) => {
      requireAuth(auth);
      const chatId = oid(params.id);
      const chat = await col.chats().findOne({ _id: chatId });
      if (!chat) throw Errors.notFound("Chat");
      const mem = await getMembership(chat.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const filter: Record<string, unknown> = { chatId };
      if (query.kind) filter.kind = query.kind;
      if (query.sender) filter.senderId = oid(query.sender);
      if (query.from || query.to) {
        const range: Record<string, Date> = {};
        if (query.from) range.$gte = new Date(query.from);
        if (query.to) range.$lte = new Date(query.to);
        filter.createdAt = range;
      }
      const limit = Math.min(Number(query.limit ?? 50), 200);
      const items = await col.chatMedia().find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
      // Batch-fetch file docs for any media rows that carry a fileId so we can
      // return a thumbnail signed URL if the thumbnailer has produced one.
      const fileIds = items.map((m) => m.fileId).filter((x): x is ObjectId => Boolean(x));
      const files = fileIds.length
        ? await col.files().find({ _id: { $in: fileIds } }).toArray()
        : [];
      const fileById = new Map(files.map((f) => [f._id.toHexString(), f]));
      const outItems = await Promise.all(
        items.map(async (m) => {
          const f = m.fileId ? fileById.get(m.fileId.toHexString()) : undefined;
          const thumbnailUrl = f?.thumbnailKey ? await signDownloadUrl(f.thumbnailKey, 300) : null;
          return {
            id: m._id.toHexString(),
            kind: m.kind,
            fileId: m.fileId?.toHexString() ?? null,
            url: m.url ?? null,
            senderId: m.senderId.toHexString(),
            metadata: m.metadata ?? null,
            sizeBytes: m.sizeBytes ?? null,
            thumbnailUrl,
            createdAt: m.createdAt,
          };
        })
      );
      return { items: outItems };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        kind: t.Optional(
          t.Union([
            t.Literal("image"),
            t.Literal("video"),
            t.Literal("doc"),
            t.Literal("audio"),
            t.Literal("link"),
          ])
        ),
        sender: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
      }),
    }
  )

  // Pin a message. ACL: any active member of the workspace may pin — low-friction
  // parity with Slack default. Unpin mirrors.
  .post(
    "/messages/:id/pin",
    async ({ auth, params }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const m = await col.messages().findOne({ _id: id });
      if (!m || m.deletedAt) throw Errors.notFound("Message");
      const mem = await getMembership(m.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      // Cap pins per chat to keep the pinned strip readable.
      const pinned = await col
        .messages()
        .countDocuments({ chatId: m.chatId, pinnedAt: { $exists: true }, deletedAt: { $exists: false } });
      if (!m.pinnedAt && pinned >= 50) {
        throw Errors.badRequest("pin_cap", "This chat already has 50 pinned messages");
      }
      await col
        .messages()
        .updateOne({ _id: id }, { $set: { pinnedAt: new Date(), pinnedBy: auth.userId } });
      const updated = await col.messages().findOne({ _id: id });
      const payload = publicMessage(updated!);
      await publishChat(m.chatId.toHexString(), { type: "message.pinned", message: payload });
      return payload;
    },
    { params: t.Object({ id: t.String() }) }
  )

  .delete(
    "/messages/:id/pin",
    async ({ auth, params }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const m = await col.messages().findOne({ _id: id });
      if (!m) throw Errors.notFound("Message");
      const mem = await getMembership(m.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      await col.messages().updateOne({ _id: id }, { $unset: { pinnedAt: "", pinnedBy: "" } });
      const updated = await col.messages().findOne({ _id: id });
      const payload = publicMessage(updated!);
      await publishChat(m.chatId.toHexString(), { type: "message.unpinned", message: payload });
      return payload;
    },
    { params: t.Object({ id: t.String() }) }
  );
