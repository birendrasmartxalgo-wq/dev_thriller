// Admin + notifications + extra API shims.
// Kept separate from endpoints.ts to avoid bloating the main surface.

import { api } from "./client";

export interface AuditItem {
  id: string;
  actorId: string;
  verb: string;
  objectType: string;
  objectId: string | null;
  metadata: Record<string, unknown> | null;
  hash: string;
  prevHash: string;
  createdAt: string;
}

export const adminApi = {
  audit: (q: { workspaceId: string; actor?: string; verb?: string; from?: string; to?: string; limit?: number }) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined) sp.set(k, String(v));
    return api.get<{ items: AuditItem[] }>(`/v1/admin/audit?${sp.toString()}`);
  },
  auditVerify: (workspaceId: string) =>
    api.get<{ ok: boolean; brokenAt: string | null }>(`/v1/admin/audit/verify?workspaceId=${encodeURIComponent(workspaceId)}`),
  storage: (workspaceId: string) =>
    api.get<{ totalBytes: number; totalFiles: number; byMime: { mime: string; size: number; count: number }[] }>(
      `/v1/admin/storage?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
  users: (workspaceId: string) =>
    api.get<{
      items: { userId: string; email: string | null; name: string | null; role: string; status: string; lastSeenAt: string | null }[];
    }>(`/v1/admin/users?workspaceId=${encodeURIComponent(workspaceId)}`),
  suspend: (uid: string, workspaceId: string, suspend: boolean) =>
    api.patch<{ ok: true }>(`/v1/admin/users/${uid}/suspend`, { workspaceId, suspend }),
};

export interface NotificationItem {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  workspaceId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface SessionItem {
  id: string;
  createdAt: string;
  expiresAt: string;
  userAgent: string | null;
  ip: string | null;
}

export const userApi = {
  patchMe: (body: Partial<{ name: string; timezone: string; status: string; pronouns: string; notifPrefs: Record<string, boolean> }>) =>
    api.patch<{ ok: true }>("/v1/users/me", body),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api.post<{ ok: true }>("/v1/users/me/password", body),
  sessions: () => api.get<{ items: SessionItem[] }>("/v1/auth/sessions"),
  revokeSession: (id: string) => api.delete<{ ok: true }>(`/v1/auth/sessions/${id}`),
  revokeAllSessions: () => api.post<{ ok: true; count: number }>("/v1/auth/sessions/revoke-all"),
};

export const passwordResetApi = {
  request: (email: string) => api.post<{ ok: true }>("/v1/auth/password/reset-request", { email }),
  confirm: (body: { token: string; newPassword: string }) => api.post<{ ok: true }>("/v1/auth/password/reset", body),
};

export const workspaceAdminApi = {
  patch: (id: string, body: Partial<{ name: string; retention: { messagesDays?: number; filesDays?: number } }>) =>
    api.patch<{ ok: true }>(`/v1/workspaces/${id}`, body),
};

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  createdAt: string;
}
export const savedSearchApi = {
  list: (workspaceId: string) =>
    api.get<{ items: SavedSearch[] }>(`/v1/search/saved?workspaceId=${encodeURIComponent(workspaceId)}`),
  create: (body: { workspaceId: string; name: string; query: string }) =>
    api.post<{ id: string }>("/v1/search/saved", body),
  remove: (id: string) => api.delete<{ ok: true }>(`/v1/search/saved/${id}`),
};

export interface ShareLink {
  id: string;
  token: string;
  visibility: "public" | "workspace" | "restricted";
  url: string;
  expiresAt: string | null;
  createdAt: string;
}
export const shareLinkApi = {
  list: (fileId: string) => api.get<{ items: ShareLink[] }>(`/v1/files/${fileId}/shares`),
  create: (fileId: string, body: { visibility: "public" | "workspace" | "restricted"; expiresAt?: string }) =>
    api.post<{ url: string; token: string }>(`/v1/files/${fileId}/share`, body),
  revoke: (token: string) => api.delete<{ ok: true }>(`/v1/shares/${token}`),
};

export const fileVersionApi = {
  list: (fileId: string) =>
    api.get<{ items: { id: string; version: number; sizeBytes: number; checksum: string; createdBy: string; createdAt: string }[] }>(
      `/v1/files/${fileId}/versions`
    ),
};

export const notificationApi = {
  list: (q: { workspaceId?: string; kind?: string; unread?: boolean; limit?: number } = {}) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined) sp.set(k, String(v));
    const qs = sp.toString();
    return api.get<{ items: NotificationItem[] }>(`/v1/notifications${qs ? `?${qs}` : ""}`);
  },
  read: (id: string) => api.patch<{ ok: true }>(`/v1/notifications/${id}/read`),
  readAll: (workspaceId?: string) => api.post<{ ok: true; count: number }>(`/v1/notifications/read-all`, workspaceId ? { workspaceId } : {}),
};
