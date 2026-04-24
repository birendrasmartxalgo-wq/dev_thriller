import Redis from "ioredis";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

// Dragonfly is wire-compatible with Redis — the ioredis client works unchanged.
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

export const pubsub = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: null,
});

export async function connectDragonfly(): Promise<void> {
  await redis.connect();
  await pubsub.connect();
  const pong = await redis.ping();
  if (pong !== "PONG") throw new Error(`dragonfly ping unexpected response: ${pong}`);
  logger.info("dragonfly connected");
}

export const keys = {
  aclCache: (userId: string, resourceType: string, resourceId: string) =>
    `acl:${userId}:${resourceType}:${resourceId}`,
  presence: (userId: string) => `presence:${userId}`,
  workspacePresence: (workspaceId: string) => `presence:ws:${workspaceId}`,
  rateLimit: (bucket: string, key: string) => `rl:${bucket}:${key}`,
  sessionRevoked: (jti: string) => `revoked:${jti}`,
};

export const topics = {
  chat: (chatId: string) => `chat:${chatId}`,
  user: (userId: string) => `user:${userId}`,
  workspace: (workspaceId: string) => `ws:${workspaceId}`,
  aclInvalidate: () => `acl:invalidate`,
};
