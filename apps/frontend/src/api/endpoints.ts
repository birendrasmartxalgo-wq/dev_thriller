// Typed wrappers per resource. Thin layer over Eden Treaty — keeps call-sites
// terse and preserves a stable public surface so callers in src/modules/** are
// independent of the underlying client.
//
// Each function delegates to `eden.*`, which derives its types from the backend
// `App` type. We unwrap the treaty `{ data, error }` envelope with `unwrap()` so
// callers see a plain promise; the inferred response type (which Eden infers as
// `Date` for timestamp fields, mirroring the handler return) is then narrowed
// to the hand-written view-model in `./types` whose timestamps are `string` —
// the JSON-on-the-wire reality. `unwrap()` returns `unknown`, so the single
// `as <ViewModel>` cast at each callsite is the bridge between the two.

import { eden, tokenStore, unwrap } from "./client";
import type {
  AuthUser,
  ChatDetail,
  ChatMediaItem,
  ChatSummary,
  FileDetail,
  LoginResponse,
  MessagePage,
  MessagePublic,
  PinnedMessage,
  PresenceStatus,
  ProjectSummary,
  SearchResult,
  SignupResponse,
  WorkspaceDetail,
  WorkspaceMember,
  WorkspaceSummary,
} from "./types";

export const authApi = {
  signup: async (body: { email: string; password: string; name: string }): Promise<SignupResponse> => {
    const r = await eden.v1.auth.signup.post(body);
    const data = unwrap(r) as SignupResponse;
    tokenStore.set(data.access, data.refresh);
    return data;
  },
  login: async (body: { email: string; password: string }): Promise<LoginResponse> => {
    const r = await eden.v1.auth.login.post(body);
    const data = unwrap(r) as LoginResponse;
    tokenStore.set(data.access, data.refresh);
    return data;
  },
  me: async (): Promise<AuthUser> => {
    const r = await eden.v1.auth.me.get();
    return unwrap(r) as AuthUser;
  },
  logout: async (): Promise<{ ok: true }> => {
    const refresh = tokenStore.refresh;
    tokenStore.clear();
    const r = await eden.v1.auth.logout.post(refresh ? { refreshToken: refresh } : {});
    return unwrap(r) as { ok: true };
  },
};

export const workspaceApi = {
  list: async (): Promise<{ items: WorkspaceSummary[] }> => {
    const r = await eden.v1.workspaces.get();
    return unwrap(r) as { items: WorkspaceSummary[] };
  },
  create: async (body: { name: string; slug?: string }): Promise<{ id: string; slug: string; name: string }> => {
    const r = await eden.v1.workspaces.post(body);
    return unwrap(r) as { id: string; slug: string; name: string };
  },
  get: async (id: string): Promise<WorkspaceDetail> => {
    const r = await eden.v1.workspaces({ id }).get();
    return unwrap(r) as WorkspaceDetail;
  },
  members: async (id: string, q?: { q?: string; limit?: number }): Promise<{ items: WorkspaceMember[] }> => {
    const query: Record<string, string | number> = {};
    if (q?.q !== undefined) query.q = q.q;
    if (q?.limit !== undefined) query.limit = q.limit;
    const r = await eden.v1.workspaces({ id }).members.get({ query });
    return unwrap(r) as { items: WorkspaceMember[] };
  },
  invite: async (
    id: string,
    body: { emails: string[]; role: "admin" | "member" | "guest" }
  ): Promise<{ invites: { email: string; token: string }[] }> => {
    const r = await eden.v1.workspaces({ id }).invites.post(body);
    return unwrap(r) as { invites: { email: string; token: string }[] };
  },
  // Public preview of an invite by token — no auth, used by /invite/:token.
  getInvite: async (
    token: string
  ): Promise<{
    workspaceId: string;
    workspaceName: string;
    email: string;
    role: "admin" | "member" | "guest";
    expiresAt: string;
    accepted: false;
  }> => {
    const r = await eden.v1.auth.invites({ token }).get();
    return unwrap(r) as {
      workspaceId: string;
      workspaceName: string;
      email: string;
      role: "admin" | "member" | "guest";
      expiresAt: string;
      accepted: false;
    };
  },
  acceptInvite: async (token: string): Promise<{ workspaceId: string }> => {
    const r = await eden.v1.auth.invites({ token }).accept.post();
    return unwrap(r) as { workspaceId: string };
  },
  presence: async (id: string): Promise<Record<string, PresenceStatus>> => {
    const r = await eden.v1.workspaces({ id }).presence.get();
    return unwrap(r) as Record<string, PresenceStatus>;
  },
};

export const projectApi = {
  list: async (workspaceId: string): Promise<{ items: ProjectSummary[] }> => {
    const r = await eden.v1.projects.get({ query: { workspaceId } });
    return unwrap(r) as { items: ProjectSummary[] };
  },
  create: async (body: {
    workspaceId: string;
    name: string;
    slug?: string;
    visibility?: "public" | "workspace" | "restricted";
  }): Promise<{ id: string; slug: string }> => {
    const r = await eden.v1.projects.post(body);
    return unwrap(r) as { id: string; slug: string };
  },
};

export const chatApi = {
  list: async (
    workspaceId: string,
    projectId?: string,
    opts?: { includeArchived?: boolean }
  ): Promise<{ items: ChatSummary[] }> => {
    const query: Record<string, string | boolean> = { workspaceId };
    if (projectId) query.projectId = projectId;
    if (opts?.includeArchived) query.includeArchived = true;
    const r = await eden.v1.chats.get({ query: query as never });
    return unwrap(r) as { items: ChatSummary[] };
  },
  create: async (body: {
    workspaceId: string;
    projectId?: string;
    type: "channel" | "dm" | "thread";
    name: string;
    topic?: string;
    members?: string[];
  }): Promise<{ id: string }> => {
    const r = await eden.v1.chats.post(body);
    return unwrap(r) as { id: string };
  },
  get: async (id: string): Promise<ChatDetail> => {
    const r = await eden.v1.chats({ id }).get();
    return unwrap(r) as ChatDetail;
  },
  update: async (
    id: string,
    body: { name?: string; topic?: string | null; archivedAt?: null | boolean }
  ): Promise<{ ok: true }> => {
    const r = await eden.v1.chats({ id }).patch(body);
    return unwrap(r) as { ok: true };
  },
  remove: async (id: string): Promise<{ ok: true }> => {
    const r = await eden.v1.chats({ id }).delete();
    return unwrap(r) as { ok: true };
  },
  jump: async (id: string, q: { at?: string; messageId?: string }): Promise<{ cursor: string | null }> => {
    const query: Record<string, string> = {};
    if (q.at) query.at = q.at;
    if (q.messageId) query.messageId = q.messageId;
    const r = await eden.v1.chats({ id }).jump.get({ query });
    return unwrap(r) as { cursor: string | null };
  },
  pinned: async (id: string): Promise<{ items: PinnedMessage[] }> => {
    const r = await eden.v1.chats({ id }).pinned.get();
    return unwrap(r) as { items: PinnedMessage[] };
  },
  media: async (
    id: string,
    q: { kind?: string; sender?: string; from?: string; to?: string; limit?: number } = {}
  ): Promise<{ items: ChatMediaItem[] }> => {
    const query: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(q)) if (v !== undefined) query[k] = v as string | number;
    const r = await eden.v1.chats({ id }).media.get({ query: query as never });
    return unwrap(r) as { items: ChatMediaItem[] };
  },
  markRead: async (id: string, body: { messageId: string }): Promise<{ ok: true }> => {
    const r = await eden.v1.chats({ id }).read.post(body);
    return unwrap(r) as { ok: true };
  },
  readState: async (
    id: string
  ): Promise<{ items: Record<string, { lastReadMessageId: string | null; lastReadAt: string }> }> => {
    const r = await eden.v1.chats({ id })["read-state"].get();
    return unwrap(r) as { items: Record<string, { lastReadMessageId: string | null; lastReadAt: string }> };
  },
};

export const messageApi = {
  page: async (
    chatId: string,
    q: { cursor?: string; limit?: number; direction?: "before" | "after"; parentId?: string } = {}
  ): Promise<MessagePage> => {
    const query: Record<string, string | number> = {};
    if (q.cursor !== undefined) query.cursor = q.cursor;
    if (q.limit !== undefined) query.limit = q.limit;
    if (q.direction !== undefined) query.direction = q.direction;
    if (q.parentId !== undefined) query.parentId = q.parentId;
    const r = await eden.v1.chats({ id: chatId }).messages.get({ query: query as never });
    return unwrap(r) as MessagePage;
  },
  send: async (
    chatId: string,
    body: { body: string; parentId?: string; mentions?: string[]; attachments?: { fileId: string }[] }
  ): Promise<MessagePublic> => {
    const r = await eden.v1.chats({ id: chatId }).messages.post(body);
    return unwrap(r) as MessagePublic;
  },
  edit: async (id: string, body: { body: string }): Promise<MessagePublic> => {
    const r = await eden.v1.messages({ id }).patch(body);
    return unwrap(r) as MessagePublic;
  },
  remove: async (id: string): Promise<{ ok: true }> => {
    const r = await eden.v1.messages({ id }).delete();
    return unwrap(r) as { ok: true };
  },
  react: async (id: string, body: { emoji: string; action: "add" | "remove" }): Promise<MessagePublic> => {
    const r = await eden.v1.messages({ id }).reactions.post(body);
    return unwrap(r) as MessagePublic;
  },
  pin: async (id: string): Promise<MessagePublic> => {
    const r = await eden.v1.messages({ id }).pin.post();
    return unwrap(r) as MessagePublic;
  },
  unpin: async (id: string): Promise<MessagePublic> => {
    const r = await eden.v1.messages({ id }).pin.delete();
    return unwrap(r) as MessagePublic;
  },
};

export const fileApi = {
  get: async (id: string): Promise<FileDetail> => {
    const r = await eden.v1.files({ id }).get();
    return unwrap(r) as FileDetail;
  },
  thumbnail: async (id: string): Promise<{ url: string }> => {
    const r = await eden.v1.files({ id }).thumbnail.get();
    return unwrap(r) as { url: string };
  },
  remove: async (id: string): Promise<{ ok: true }> => {
    const r = await eden.v1.files({ id }).delete();
    return unwrap(r) as { ok: true };
  },
  initUpload: async (body: {
    workspaceId: string;
    filename: string;
    mime: string;
    size: number;
    checksum: string;
    chunkSize?: number;
  }): Promise<{ uploadId: string; chunkSize: number; totalChunks: number; chunkUrls: { n: number; url: string }[] }> => {
    const r = await eden.v1.uploads.post(body);
    return unwrap(r) as {
      uploadId: string;
      chunkSize: number;
      totalChunks: number;
      chunkUrls: { n: number; url: string }[];
    };
  },
  ackChunk: async (uploadId: string, idx: number, body: { etag: string; size: number }): Promise<{ ok: true }> => {
    const r = await eden.v1.uploads({ id: uploadId }).chunks({ idx: String(idx) }).post(body);
    return unwrap(r) as { ok: true };
  },
  uploadStatus: async (
    uploadId: string
  ): Promise<{ status: string; totalChunks: number; missing: number[] }> => {
    const r = await eden.v1.uploads({ id: uploadId }).status.get();
    return unwrap(r) as { status: string; totalChunks: number; missing: number[] };
  },
  complete: async (uploadId: string): Promise<{ fileId: string }> => {
    const r = await eden.v1.uploads({ id: uploadId }).complete.post();
    // Backend may return { fileId, already?: true } on idempotent re-complete; the
    // caller only reads fileId so we keep the original signature.
    return unwrap(r) as { fileId: string };
  },
};

export const searchApi = {
  query: async (q: {
    q: string;
    workspaceId: string;
    type?: "all" | "message" | "file";
    limit?: number;
  }): Promise<SearchResult> => {
    const query: Record<string, string | number> = { q: q.q, workspaceId: q.workspaceId };
    if (q.type !== undefined) query.type = q.type;
    if (q.limit !== undefined) query.limit = q.limit;
    const r = await eden.v1.search.get({ query: query as never });
    return unwrap(r) as SearchResult;
  },
};
