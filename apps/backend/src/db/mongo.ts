import { MongoClient, type Collection, type Db } from "mongodb";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import type {
  UserDoc,
  WorkspaceDoc,
  MembershipDoc,
  InviteDoc,
  ProjectDoc,
  ChatDoc,
  MessageDoc,
  FileDoc,
  FileVersionDoc,
  ChatMediaDoc,
  AclDoc,
  ActivityLogDoc,
  ShareLinkDoc,
  UploadSessionDoc,
  UserChatStateDoc,
  RefreshTokenDoc,
  NotificationDoc,
  SavedSearchDoc,
} from "./types";

export const client = new MongoClient(env.MONGO_URI, {
  retryWrites: true,
  maxPoolSize: 30,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 8_000,
});

let _db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (_db) return _db;
  await client.connect();
  _db = client.db(env.MONGO_DB);
  await client.db("admin").command({ ping: 1 });
  logger.info({ db: env.MONGO_DB }, "mongo connected");
  return _db;
}

export function db(): Db {
  if (!_db) throw new Error("Mongo not connected. Call connectMongo() at startup.");
  return _db;
}

export const col = {
  users: () => db().collection<UserDoc>("users"),
  workspaces: () => db().collection<WorkspaceDoc>("workspaces"),
  memberships: () => db().collection<MembershipDoc>("memberships"),
  invites: () => db().collection<InviteDoc>("invites"),
  projects: () => db().collection<ProjectDoc>("projects"),
  chats: () => db().collection<ChatDoc>("chats"),
  messages: () => db().collection<MessageDoc>("messages"),
  files: () => db().collection<FileDoc>("files"),
  fileVersions: () => db().collection<FileVersionDoc>("fileVersions"),
  chatMedia: () => db().collection<ChatMediaDoc>("chatMedia"),
  acls: () => db().collection<AclDoc>("acls"),
  activityLog: () => db().collection<ActivityLogDoc>("activityLog"),
  shareLinks: () => db().collection<ShareLinkDoc>("shareLinks"),
  uploadSessions: () => db().collection<UploadSessionDoc>("uploadSessions"),
  userChatState: () => db().collection<UserChatStateDoc>("userChatState"),
  refreshTokens: () => db().collection<RefreshTokenDoc>("refreshTokens"),
  notifications: () => db().collection<NotificationDoc>("notifications"),
  savedSearches: () => db().collection<SavedSearchDoc>("savedSearches"),
};

export type Cols = typeof col;
export type { Collection, Db };
