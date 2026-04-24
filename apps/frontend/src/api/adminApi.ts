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
