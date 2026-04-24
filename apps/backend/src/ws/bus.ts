import { redis, pubsub, topics } from "@/db/dragonfly";
import { logger } from "@/lib/logger";

type WsSend = (data: string) => void;

/**
 * In-process registry of WS clients keyed by topic → set of send fns.
 * Combined with Dragonfly pub/sub for cross-node fan-out.
 */
const topicToSockets = new Map<string, Set<WsSend>>();
const socketToTopics = new WeakMap<WsSend, Set<string>>();

export function localSubscribe(topic: string, send: WsSend): void {
  let set = topicToSockets.get(topic);
  if (!set) {
    set = new Set();
    topicToSockets.set(topic, set);
  }
  set.add(send);
  let subs = socketToTopics.get(send);
  if (!subs) {
    subs = new Set();
    socketToTopics.set(send, subs);
  }
  subs.add(topic);
}

export function localUnsubscribe(topic: string, send: WsSend): void {
  topicToSockets.get(topic)?.delete(send);
  socketToTopics.get(send)?.delete(topic);
}

export function cleanupSocket(send: WsSend): void {
  const subs = socketToTopics.get(send);
  if (subs) {
    for (const t of subs) topicToSockets.get(t)?.delete(send);
  }
  socketToTopics.delete(send);
}

function fanoutLocal(topic: string, data: string) {
  const set = topicToSockets.get(topic);
  if (!set) return;
  for (const send of set) {
    try {
      send(data);
    } catch (err) {
      logger.debug({ err }, "ws send failed");
    }
  }
}

let subscriber: ReturnType<typeof pubsub.duplicate> | null = null;
export async function startPubSub(): Promise<void> {
  subscriber = pubsub.duplicate();
  await subscriber.psubscribe("chat:*", "user:*", "ws:*");
  subscriber.on("pmessage", (_pattern, channel, message) => {
    fanoutLocal(channel, message);
  });
  logger.info("ws bus pub/sub subscribed");
}

export async function publishChat(chatId: string, event: Record<string, unknown>): Promise<void> {
  await redis.publish(topics.chat(chatId), JSON.stringify(event));
}
export async function publishUser(userId: string, event: Record<string, unknown>): Promise<void> {
  await redis.publish(topics.user(userId), JSON.stringify(event));
}
export async function publishWorkspace(workspaceId: string, event: Record<string, unknown>): Promise<void> {
  await redis.publish(topics.workspace(workspaceId), JSON.stringify(event));
}
