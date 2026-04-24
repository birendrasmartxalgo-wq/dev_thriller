import { col } from "./mongo";
import { logger } from "@/lib/logger";

export async function ensureIndexes(): Promise<void> {
  const ops: Promise<unknown>[] = [
    col.users().createIndex({ emailLower: 1 }, { unique: true }),
    col.users().createIndex({ deletedAt: 1 }, { sparse: true }),

    col.workspaces().createIndex({ slug: 1 }, { unique: true }),
    col.workspaces().createIndex({ ownerId: 1 }),
    col.workspaces().createIndex({ deletedAt: 1 }, { sparse: true }),

    col.memberships().createIndex({ workspaceId: 1, userId: 1 }, { unique: true }),
    col.memberships().createIndex({ userId: 1 }),

    col.invites().createIndex({ token: 1 }, { unique: true }),
    col.invites().createIndex({ workspaceId: 1, email: 1 }),
    col.invites().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

    col.projects().createIndex({ workspaceId: 1, slug: 1 }, { unique: true }),
    col.projects().createIndex({ workspaceId: 1, archivedAt: 1 }),

    col.chats().createIndex({ workspaceId: 1, projectId: 1 }),
    col.chats().createIndex({ workspaceId: 1, lastMessageAt: -1 }),
    col.chats().createIndex({ members: 1 }, { sparse: true }),

    col.messages().createIndex({ chatId: 1, createdAt: -1 }),
    col.messages().createIndex({ parentId: 1 }, { sparse: true }),
    col.messages().createIndex({ workspaceId: 1, createdAt: -1 }),
    col.messages().createIndex({ body: "text" }, { name: "messages_text_fallback" }),

    col.files().createIndex({ workspaceId: 1, deletedAt: 1 }),
    col.files().createIndex({ checksum: 1 }),
    col.files().createIndex({ uploaderId: 1, createdAt: -1 }),

    col.fileVersions().createIndex({ fileId: 1, version: -1 }, { unique: true }),

    col.chatMedia().createIndex({ chatId: 1, kind: 1, createdAt: -1 }),
    col.chatMedia().createIndex({ workspaceId: 1, createdAt: -1 }),

    col.acls().createIndex(
      { resourceType: 1, resourceId: 1, principalType: 1, principalId: 1, permission: 1 },
      { unique: true }
    ),
    col.acls().createIndex({ principalType: 1, principalId: 1 }),

    col.activityLog().createIndex({ workspaceId: 1, createdAt: -1 }),
    col.activityLog().createIndex({ actorId: 1, createdAt: -1 }),

    col.shareLinks().createIndex({ token: 1 }, { unique: true }),
    col.shareLinks().createIndex({ resourceType: 1, resourceId: 1 }),
    col.shareLinks().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true }),

    col.uploadSessions().createIndex({ userId: 1, createdAt: -1 }),
    col.uploadSessions().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

    col.userChatState().createIndex({ userId: 1, chatId: 1 }, { unique: true }),
    col.userChatState().createIndex({ userId: 1, workspaceId: 1 }),

    col.refreshTokens().createIndex({ tokenHash: 1 }, { unique: true }),
    col.refreshTokens().createIndex({ userId: 1 }),
    col.refreshTokens().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

    col.notifications().createIndex({ userId: 1, createdAt: -1 }),
    col.notifications().createIndex({ userId: 1, readAt: 1 }),

    col.savedSearches().createIndex({ userId: 1, workspaceId: 1 }),
  ];

  await Promise.all(ops);
  logger.info("mongo indexes ensured");
}
