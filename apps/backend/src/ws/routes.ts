import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { accessJwt, type AccessClaims } from "@/lib/jwt";
import { col } from "@/db/mongo";
import { redis, topics, keys } from "@/db/dragonfly";
import { cleanupSocket, localSubscribe, localUnsubscribe, publishTyping, publishWorkspace } from "./bus";
import { logger } from "@/lib/logger";
import { getMembership } from "@/lib/acl";

// token → userId cache so we don't re-verify every message
const socketAuth = new WeakMap<object, { userId: ObjectId; name: string; workspaceIds: Set<string> }>();
// Per-socket throttle so a held-down key can't flood the publish bus.
const lastTypingPublish = new WeakMap<object, Map<string, number>>();
const TYPING_TTL_MS = 4_000;
const TYPING_THROTTLE_MS = 1_500;

export const wsRoutes = new Elysia({ prefix: "/v1" })
  .use(accessJwt)
  .ws("/ws", {
    query: t.Object({
      token: t.String(),
    }),
    async open(ws) {
      try {
        const payload = (await ws.data.accessJwt.verify(ws.data.query.token)) as AccessClaims | false;
        if (!payload || !ObjectId.isValid(payload.sub)) {
          ws.send(JSON.stringify({ type: "error", code: "unauthorized" }));
          ws.close();
          return;
        }
        const userId = new ObjectId(payload.sub);
        const mems = await col.memberships().find({ userId, status: "active" }).toArray();
        const wsIds = new Set(mems.map((m) => m.workspaceId.toHexString()));
        const userDoc = await col.users().findOne({ _id: userId });
        const name = userDoc?.name ?? userDoc?.email ?? payload.sub.slice(-6);
        socketAuth.set(ws.raw as unknown as object, { userId, name, workspaceIds: wsIds });

        const send = (data: string) => ws.send(data);
        // Track on the raw socket handle.
        (ws.raw as any).__dtSend = send;
        // Auto-subscribe to own user topic.
        localSubscribe(topics.user(payload.sub), send);
        // Presence
        for (const wsid of wsIds) {
          await redis.sadd(keys.workspacePresence(wsid), payload.sub);
          await publishWorkspace(wsid, { type: "presence.join", userId: payload.sub });
        }
        await redis.set(keys.presence(payload.sub), "1", "EX", 60);
        ws.send(JSON.stringify({ type: "ready", userId: payload.sub }));
      } catch (err) {
        logger.error({ err }, "ws open failed");
        ws.close();
      }
    },
    async message(ws, raw) {
      const auth = socketAuth.get(ws.raw as unknown as object);
      if (!auth) {
        ws.send(JSON.stringify({ type: "error", code: "unauthorized" }));
        return;
      }
      let msg: any;
      try {
        msg = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        return;
      }
      const send: (data: string) => void = (ws.raw as any).__dtSend;

      if (msg.type === "subscribe" && msg.topic) {
        // Validate topic membership
        if (msg.topic.startsWith("chat:")) {
          const chatId = msg.topic.slice(5);
          if (!ObjectId.isValid(chatId)) return;
          const chat = await col.chats().findOne({ _id: new ObjectId(chatId) });
          if (!chat) return;
          if (!auth.workspaceIds.has(chat.workspaceId.toHexString())) return;
          localSubscribe(msg.topic, send);
          // Auto-subscribe to the ephemeral typing channel for the same chat so
          // callers don't need a second subscribe round-trip.
          localSubscribe(`chat:${chatId}:typing`, send);
          ws.send(JSON.stringify({ type: "subscribed", topic: msg.topic }));
        } else if (msg.topic.startsWith("ws:")) {
          const wsid = msg.topic.slice(3);
          if (!auth.workspaceIds.has(wsid)) return;
          localSubscribe(msg.topic, send);
          ws.send(JSON.stringify({ type: "subscribed", topic: msg.topic }));
        }
      } else if (msg.type === "unsubscribe" && msg.topic) {
        localUnsubscribe(msg.topic, send);
        if (typeof msg.topic === "string" && msg.topic.startsWith("chat:")) {
          localUnsubscribe(`${msg.topic}:typing`, send);
        }
      } else if (msg.type === "typing" && typeof msg.chat === "string") {
        if (!ObjectId.isValid(msg.chat)) return;
        const chat = await col.chats().findOne({ _id: new ObjectId(msg.chat) });
        if (!chat) return;
        if (!auth.workspaceIds.has(chat.workspaceId.toHexString())) return;
        // Throttle per-socket per-chat to one publish every TYPING_THROTTLE_MS.
        const key = ws.raw as unknown as object;
        let perChat = lastTypingPublish.get(key);
        if (!perChat) {
          perChat = new Map();
          lastTypingPublish.set(key, perChat);
        }
        const now = Date.now();
        const last = perChat.get(msg.chat) ?? 0;
        if (now - last < TYPING_THROTTLE_MS) return;
        perChat.set(msg.chat, now);
        await publishTyping(msg.chat, {
          userId: auth.userId.toHexString(),
          name: auth.name,
          until: now + TYPING_TTL_MS,
        });
      } else if (msg.type === "ping") {
        await redis.set(keys.presence(auth.userId.toHexString()), "1", "EX", 60);
        ws.send(JSON.stringify({ type: "pong" }));
      } else if (msg.type === "idle") {
        // Client signals idle (tab hidden or no activity 5+ min) — mark amber.
        await redis.set(keys.presence(auth.userId.toHexString()), "idle", "EX", 60);
      } else if (msg.type === "replay" && typeof msg.chat === "string" && typeof msg.since === "string") {
        // Offline replay on reconnect: stream messages created after `since` as individual msg:new events.
        if (!ObjectId.isValid(msg.chat)) return;
        const chatId = new ObjectId(msg.chat);
        const chat = await col.chats().findOne({ _id: chatId });
        if (!chat) return;
        if (!auth.workspaceIds.has(chat.workspaceId.toHexString())) return;
        const since = new Date(msg.since);
        if (isNaN(since.getTime())) return;
        const items = await col
          .messages()
          .find({ chatId, createdAt: { $gt: since }, deletedAt: { $exists: false } })
          .sort({ createdAt: 1 })
          .limit(500)
          .toArray();
        for (const m of items) {
          ws.send(
            JSON.stringify({
              type: "msg:new",
              message: {
                id: m._id.toHexString(),
                chatId: m.chatId.toHexString(),
                authorId: m.authorId.toHexString(),
                parentId: m.parentId?.toHexString() ?? null,
                body: m.body,
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
              },
            })
          );
        }
        ws.send(JSON.stringify({ type: "replay.done", chat: msg.chat, count: items.length }));
      }
    },
    async close(ws) {
      const auth = socketAuth.get(ws.raw as unknown as object);
      const send: (data: string) => void = (ws.raw as any).__dtSend;
      if (send) cleanupSocket(send);
      if (auth) {
        await redis.del(keys.presence(auth.userId.toHexString()));
        for (const wsid of auth.workspaceIds) {
          await redis.srem(keys.workspacePresence(wsid), auth.userId.toHexString());
          await publishWorkspace(wsid, { type: "presence.leave", userId: auth.userId.toHexString() });
        }
      }
    },
  });
