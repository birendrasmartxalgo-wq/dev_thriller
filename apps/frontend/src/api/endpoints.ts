// Typed wrappers per resource. Thin layer over `api` — keeps call-sites terse.

import { api, tokenStore } from "./client";
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
  signup: (body: { email: string; password: string; name: string }) =>
    api.post<SignupResponse>("/v1/auth/signup", body).then((r) => {
      tokenStore.set(r.access, r.refresh);
      return r;
    }),
  login: (body: { email: string; password: string }) =>
    api.post<LoginResponse>("/v1/auth/login", body).then((r) => {
      tokenStore.set(r.access, r.refresh);
      return r;
    }),
  me: () => api.get<AuthUser>("/v1/auth/me"),
  logout: () => {
    const refresh = tokenStore.refresh;
    tokenStore.clear();
    return api.post<{ ok: true }>("/v1/auth/logout", refresh ? { refreshToken: refresh } : {});
  },
};

export const workspaceApi = {
  list: () => api.get<{ items: WorkspaceSummary[] }>("/v1/workspaces"),
  create: (body: { name: string; slug?: string }) =>
    api.post<{ id: string; slug: string; name: string }>("/v1/workspaces", body),
  get: (id: string) => api.get<WorkspaceDetail>(`/v1/workspaces/${id}`),
  members: (id: string, q?: { q?: string; limit?: number }) => {
    const sp = new URLSearchParams();
    if (q?.q) sp.set("q", q.q);
    if (q?.limit !== undefined) sp.set("limit", String(q.limit));
    const qs = sp.toString();
    return api.get<{ items: WorkspaceMember[] }>(`/v1/workspaces/${id}/members${qs ? `?${qs}` : ""}`);
  },
  invite: (id: string, body: { emails: string[]; role: "admin" | "member" | "guest" }) =>
    api.post<{ invites: { email: string; token: string }[] }>(`/v1/workspaces/${id}/invites`, body),
  presence: (id: string) => api.get<Record<string, PresenceStatus>>(`/v1/workspaces/${id}/presence`),
};

export const projectApi = {
  list: (workspaceId: string) =>
    api.get<{ items: ProjectSummary[] }>(`/v1/projects?workspaceId=${encodeURIComponent(workspaceId)}`),
  create: (body: { workspaceId: string; name: string; slug?: string; visibility?: "public" | "workspace" | "restricted" }) =>
    api.post<{ id: string; slug: string }>("/v1/projects", body),
};

export const chatApi = {
  list: (workspaceId: string, projectId?: string, opts?: { includeArchived?: boolean }) => {
    const q = new URLSearchParams({ workspaceId });
    if (projectId) q.set("projectId", projectId);
    if (opts?.includeArchived) q.set("includeArchived", "true");
    return api.get<{ items: ChatSummary[] }>(`/v1/chats?${q.toString()}`);
  },
  create: (body: {
    workspaceId: string;
    projectId?: string;
    type: "channel" | "dm" | "thread";
    name: string;
    topic?: string;
    members?: string[];
  }) => api.post<{ id: string }>("/v1/chats", body),
  get: (id: string) => api.get<ChatDetail>(`/v1/chats/${id}`),
  update: (id: string, body: { name?: string; topic?: string | null; archivedAt?: null | boolean }) =>
    api.patch<{ ok: true }>(`/v1/chats/${id}`, body),
  remove: (id: string) => api.delete<{ ok: true }>(`/v1/chats/${id}`),
  jump: (id: string, q: { at?: string; messageId?: string }) => {
    const sp = new URLSearchParams();
    if (q.at) sp.set("at", q.at);
    if (q.messageId) sp.set("messageId", q.messageId);
    return api.get<{ cursor: string | null }>(`/v1/chats/${id}/jump?${sp.toString()}`);
  },
  pinned: (id: string) => api.get<{ items: PinnedMessage[] }>(`/v1/chats/${id}/pinned`),
  media: (
    id: string,
    q: { kind?: string; sender?: string; from?: string; to?: string; limit?: number } = {}
  ) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined) sp.set(k, String(v));
    const qs = sp.toString();
    return api.get<{ items: ChatMediaItem[] }>(`/v1/chats/${id}/media${qs ? `?${qs}` : ""}`);
  },
};

export const messageApi = {
  page: (chatId: string, q: { cursor?: string; limit?: number; direction?: "before" | "after" } = {}) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined) sp.set(k, String(v));
    const qs = sp.toString();
    return api.get<MessagePage>(`/v1/chats/${chatId}/messages${qs ? `?${qs}` : ""}`);
  },
  send: (chatId: string, body: { body: string; parentId?: string; mentions?: string[]; attachments?: { fileId: string }[] }) =>
    api.post<MessagePublic>(`/v1/chats/${chatId}/messages`, body),
  edit: (id: string, body: { body: string }) => api.patch<MessagePublic>(`/v1/messages/${id}`, body),
  remove: (id: string) => api.delete<{ ok: true }>(`/v1/messages/${id}`),
  react: (id: string, body: { emoji: string; action: "add" | "remove" }) =>
    api.post<MessagePublic>(`/v1/messages/${id}/reactions`, body),
  pin: (id: string) => api.post<MessagePublic>(`/v1/messages/${id}/pin`),
  unpin: (id: string) => api.delete<MessagePublic>(`/v1/messages/${id}/pin`),
};

export const fileApi = {
  get: (id: string) => api.get<FileDetail>(`/v1/files/${id}`),
  initUpload: (body: { workspaceId: string; filename: string; mime: string; size: number; checksum: string; chunkSize?: number }) =>
    api.post<{ uploadId: string; chunkSize: number; totalChunks: number; chunkUrls: { n: number; url: string }[] }>(
      "/v1/uploads",
      body
    ),
  ackChunk: (uploadId: string, idx: number, body: { etag: string; size: number }) =>
    api.post<{ ok: true }>(`/v1/uploads/${uploadId}/chunks/${idx}`, body),
  uploadStatus: (uploadId: string) =>
    api.get<{ status: string; totalChunks: number; missing: number[] }>(`/v1/uploads/${uploadId}/status`),
  complete: (uploadId: string) => api.post<{ fileId: string }>(`/v1/uploads/${uploadId}/complete`),
};

export const searchApi = {
  query: (q: { q: string; workspaceId: string; type?: "all" | "message" | "file"; limit?: number }) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined) sp.set(k, String(v));
    return api.get<SearchResult>(`/v1/search?${sp.toString()}`);
  },
};
