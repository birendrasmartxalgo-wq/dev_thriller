// Domain types returned by the backend — kept hand-written to avoid coupling
// the Vite build to backend tsconfig. Names track src/modules/*/routes.ts.

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  createdAt?: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
  accessExpiresIn: number;
}

export interface SignupResponse extends TokenPair {
  user: AuthUser;
}
export interface LoginResponse extends TokenPair {
  user: AuthUser;
}

export interface WorkspaceSummary {
  id: string;
  slug: string;
  name: string;
  caseNumber: string;
  plan: string;
  role: "owner" | "admin" | "member" | "guest";
}

export interface WorkspaceDetail extends WorkspaceSummary {}

export interface WorkspaceMember {
  userId: string;
  email: string | null;
  name: string | null;
  avatarUrl?: string | null;
  role: "owner" | "admin" | "member" | "guest";
  status: "active" | "invited" | "suspended" | string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  visibility: "public" | "workspace" | "restricted";
}

export interface ChatSummary {
  id: string;
  name: string;
  type: "channel" | "dm" | "thread";
  projectId: string | null;
  topic: string | null;
  lastMessageAt: string | null;
  members: string[] | null;
  archivedAt?: string | null;
}

export interface ChatDetail extends ChatSummary {
  workspaceId: string;
  createdBy?: string;
  archivedAt?: string | null;
}

export interface MessageAttachment {
  fileId: string;
  name: string;
  mime: string;
  sizeBytes: number;
  thumbnailKey?: string;
}

export interface MessagePublic {
  id: string;
  chatId: string;
  authorId: string;
  parentId: string | null;
  body: string;
  mentions: string[];
  attachments: MessageAttachment[];
  reactions: Record<string, string[]>;
  pinnedAt?: string | null;
  pinnedBy?: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface PinnedMessage {
  id: string;
  chatId: string;
  authorId: string;
  body: string;
  createdAt: string;
  pinnedAt: string | null;
  pinnedBy: string | null;
}

export type PresenceStatus = "green" | "amber" | "gray";

export interface MessagePage {
  items: MessagePublic[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ChatMediaItem {
  id: string;
  kind: "image" | "video" | "doc" | "audio" | "link";
  fileId: string | null;
  url: string | null;
  senderId: string;
  metadata: Record<string, unknown> | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface FileDetail {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  checksum: string;
  version: number;
  url: string;
  createdAt: string;
}

export interface SearchResult {
  messages: Array<{
    id: string;
    chatId: string;
    authorId: string;
    body: string;
    createdAt: string;
    hasAttachments: boolean;
  }>;
  files: Array<{
    id: string;
    name: string;
    mime: string;
    sizeBytes: number;
    uploaderId: string;
    createdAt: string;
  }>;
  parsed: {
    terms: string[];
    from?: string;
    has?: string;
    before?: string;
    after?: string;
    inChat?: string;
  };
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code?: string;
  errors?: unknown;
}
