import type { ObjectId, Binary } from "mongodb";

export type Role = "owner" | "admin" | "member" | "guest";
export type MembershipStatus = "active" | "invited" | "suspended";
export type ChatType = "channel" | "dm" | "thread";
export type Visibility = "public" | "workspace" | "restricted";
export type PrincipalType = "user" | "role" | "workspace";
export type ResourceType = "workspace" | "project" | "chat" | "file" | "message";
export type Permission = "view" | "comment" | "edit" | "manage" | "delete";
export type MediaKind = "image" | "video" | "doc" | "audio" | "link";
export type UploadStatus = "initiated" | "uploading" | "assembling" | "complete" | "corrupt" | "expired";

export interface UserDoc {
  _id: ObjectId;
  email: string;
  emailLower: string;
  name: string;
  avatarUrl?: string;
  passwordHash: string;
  createdAt: Date;
  lastSeenAt?: Date;
  deletedAt?: Date;
}

export interface WorkspaceDoc {
  _id: ObjectId;
  slug: string;
  name: string;
  ownerId: ObjectId;
  plan: "free" | "pro" | "enterprise";
  caseNumber: string; // e.g. "0142"
  createdAt: Date;
  deletedAt?: Date;
}

export interface MembershipDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  userId: ObjectId;
  role: Role;
  status: MembershipStatus;
  invitedBy?: ObjectId;
  createdAt: Date;
}

export interface InviteDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  email: string;
  role: Role;
  token: string;
  invitedBy: ObjectId;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
}

export interface ProjectDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  name: string;
  slug: string;
  visibility: Visibility;
  createdBy: ObjectId;
  archivedAt?: Date;
  createdAt: Date;
}

export interface ChatDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  projectId?: ObjectId;
  type: ChatType;
  name: string;
  topic?: string;
  members?: ObjectId[]; // for DM / restricted channels
  createdBy: ObjectId;
  lastMessageAt?: Date;
  createdAt: Date;
  archivedAt?: Date;
}

export interface MessageAttachment {
  fileId: ObjectId;
  name: string;
  mime: string;
  sizeBytes: number;
  thumbnailKey?: string;
}

export interface MessageDoc {
  _id: ObjectId;
  chatId: ObjectId;
  workspaceId: ObjectId;
  authorId: ObjectId;
  parentId?: ObjectId;
  body: string;
  mentions?: ObjectId[];
  attachments?: MessageAttachment[];
  reactions?: Record<string, ObjectId[]>; // emoji -> [userIds]
  createdAt: Date;
  editedAt?: Date;
  deletedAt?: Date;
}

export interface FileDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  uploaderId: ObjectId;
  name: string;
  mime: string;
  sizeBytes: number;
  checksum: string; // sha256 hex
  r2Key: string;
  version: number;
  parentFolderId?: ObjectId;
  thumbnailKey?: string;
  createdAt: Date;
  deletedAt?: Date;
}

export interface FileVersionDoc {
  _id: ObjectId;
  fileId: ObjectId;
  version: number;
  r2Key: string;
  sizeBytes: number;
  checksum: string;
  createdBy: ObjectId;
  createdAt: Date;
}

export interface ChatMediaDoc {
  _id: ObjectId;
  chatId: ObjectId;
  workspaceId: ObjectId;
  kind: MediaKind;
  fileId?: ObjectId;
  url?: string;
  senderId: ObjectId;
  metadata?: Record<string, unknown>;
  sizeBytes?: number;
  createdAt: Date;
}

export interface AclDoc {
  _id: ObjectId;
  resourceType: ResourceType;
  resourceId: ObjectId;
  principalType: PrincipalType;
  principalId: ObjectId | string; // role values stored as string
  permission: Permission;
  effect: "allow" | "deny";
  inheritedFrom?: ObjectId;
  createdBy: ObjectId;
  createdAt: Date;
}

export interface ActivityLogDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  actorId: ObjectId;
  verb: string;
  objectType: string;
  objectId?: ObjectId;
  metadata?: Record<string, unknown>;
  hash: string;
  prevHash: string;
  createdAt: Date;
}

export interface ShareLinkDoc {
  _id: ObjectId;
  resourceType: ResourceType;
  resourceId: ObjectId;
  workspaceId: ObjectId;
  token: string;
  visibility: Visibility;
  createdBy: ObjectId;
  expiresAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
}

export interface UploadSessionDoc {
  _id: ObjectId;
  userId: ObjectId;
  workspaceId: ObjectId;
  filename: string;
  mime: string;
  sizeBytes: number;
  chunkSize: number;
  totalChunks: number;
  receivedBitmap: Binary; // bitset, 1 bit per chunk
  checksumExpected: string;
  status: UploadStatus;
  r2Key: string;
  r2UploadId: string;
  parts: { n: number; etag: string; size: number }[];
  createdAt: Date;
  expiresAt: Date;
}

export interface UserChatStateDoc {
  _id: ObjectId;
  userId: ObjectId;
  chatId: ObjectId;
  workspaceId: ObjectId;
  lastReadAt: Date;
  mentionCount: number;
}

export interface RefreshTokenDoc {
  _id: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  userAgent?: string;
  ip?: string;
}

export interface NotificationDoc {
  _id: ObjectId;
  userId: ObjectId;
  workspaceId?: ObjectId;
  kind: string;
  payload: Record<string, unknown>;
  readAt?: Date;
  createdAt: Date;
}

export interface SavedSearchDoc {
  _id: ObjectId;
  userId: ObjectId;
  workspaceId: ObjectId;
  name: string;
  query: string;
  createdAt: Date;
}
