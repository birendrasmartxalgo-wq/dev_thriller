// Admin + notifications + extra API shims, all backed by Eden Treaty.
// Kept separate from endpoints.ts to avoid bloating the main surface.

import { eden, unwrap } from "./client";

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
  audit: async (q: {
    workspaceId: string;
    actor?: string;
    verb?: string;
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<{ items: AuditItem[] }> => {
    const query: Record<string, string | number> = { workspaceId: q.workspaceId };
    if (q.actor !== undefined) query.actor = q.actor;
    if (q.verb !== undefined) query.verb = q.verb;
    if (q.from !== undefined) query.from = q.from;
    if (q.to !== undefined) query.to = q.to;
    if (q.limit !== undefined) query.limit = q.limit;
    const r = await eden.v1.admin.audit.get({ query: query as never });
    return unwrap(r) as unknown as { items: AuditItem[] };
  },
  auditVerify: async (workspaceId: string): Promise<{ ok: boolean; brokenAt: string | null }> => {
    const r = await eden.v1.admin.audit.verify.get({ query: { workspaceId } });
    return unwrap(r) as { ok: boolean; brokenAt: string | null };
  },
  storage: async (
    workspaceId: string
  ): Promise<{ totalBytes: number; totalFiles: number; byMime: { mime: string; size: number; count: number }[] }> => {
    const r = await eden.v1.admin.storage.get({ query: { workspaceId } });
    return unwrap(r) as {
      totalBytes: number;
      totalFiles: number;
      byMime: { mime: string; size: number; count: number }[];
    };
  },
  users: async (
    workspaceId: string
  ): Promise<{
    items: { userId: string; email: string | null; name: string | null; role: string; status: string; lastSeenAt: string | null }[];
  }> => {
    const r = await eden.v1.admin.users.get({ query: { workspaceId } });
    return unwrap(r) as unknown as {
      items: { userId: string; email: string | null; name: string | null; role: string; status: string; lastSeenAt: string | null }[];
    };
  },
  suspend: async (uid: string, workspaceId: string, suspend: boolean): Promise<{ ok: true }> => {
    const r = await eden.v1.admin.users({ uid }).suspend.patch({ workspaceId, suspend });
    return unwrap(r) as { ok: true };
  },
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
  patchMe: async (
    body: Partial<{
      name: string;
      timezone: string;
      status: string;
      pronouns: string;
      notifPrefs: Record<string, boolean>;
    }>
  ): Promise<{ ok: true }> => {
    const r = await eden.v1.users.me.patch(body as never);
    return unwrap(r) as { ok: true };
  },
  changePassword: async (body: { currentPassword: string; newPassword: string }): Promise<{ ok: true }> => {
    const r = await eden.v1.users.me.password.post(body);
    return unwrap(r) as { ok: true };
  },
  sessions: async (): Promise<{ items: SessionItem[] }> => {
    const r = await eden.v1.auth.sessions.get();
    return unwrap(r) as unknown as { items: SessionItem[] };
  },
  revokeSession: async (id: string): Promise<{ ok: true }> => {
    const r = await eden.v1.auth.sessions({ id }).delete();
    return unwrap(r) as { ok: true };
  },
  revokeAllSessions: async (): Promise<{ ok: true; count: number }> => {
    const r = await eden.v1.auth.sessions["revoke-all"].post();
    return unwrap(r) as { ok: true; count: number };
  },
};

export const passwordResetApi = {
  request: async (email: string): Promise<{ ok: true }> => {
    const r = await eden.v1.auth.password["reset-request"].post({ email });
    return unwrap(r) as { ok: true };
  },
  confirm: async (body: { token: string; newPassword: string }): Promise<{ ok: true }> => {
    const r = await eden.v1.auth.password.reset.post(body);
    return unwrap(r) as { ok: true };
  },
};

export const workspaceAdminApi = {
  patch: async (
    id: string,
    body: Partial<{ name: string; retention: { messagesDays?: number; filesDays?: number } }>
  ): Promise<{ ok: true }> => {
    const r = await eden.v1.workspaces({ id }).patch(body as never);
    return unwrap(r) as { ok: true };
  },
  changeMemberRole: async (
    workspaceId: string,
    uid: string,
    role: "admin" | "member" | "guest"
  ): Promise<{ ok: true }> => {
    const r = await eden.v1.workspaces({ id: workspaceId }).members({ uid }).patch({ role });
    return unwrap(r) as { ok: true };
  },
};

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  createdAt: string;
}
export const savedSearchApi = {
  list: async (workspaceId: string): Promise<{ items: SavedSearch[] }> => {
    const r = await eden.v1.search.saved.get({ query: { workspaceId } });
    return unwrap(r) as unknown as { items: SavedSearch[] };
  },
  create: async (body: { workspaceId: string; name: string; query: string }): Promise<{ id: string }> => {
    const r = await eden.v1.search.saved.post(body);
    return unwrap(r) as { id: string };
  },
  remove: async (id: string): Promise<{ ok: true }> => {
    const r = await eden.v1.search.saved({ id }).delete();
    return unwrap(r) as { ok: true };
  },
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
  list: async (fileId: string): Promise<{ items: ShareLink[] }> => {
    const r = await eden.v1.files({ id: fileId }).shares.get();
    return unwrap(r) as unknown as { items: ShareLink[] };
  },
  create: async (
    fileId: string,
    body: { visibility: "public" | "workspace" | "restricted"; expiresAt?: string }
  ): Promise<{ url: string; token: string }> => {
    const r = await eden.v1.files({ id: fileId }).share.post(body);
    return unwrap(r) as { url: string; token: string };
  },
  revoke: async (token: string): Promise<{ ok: true }> => {
    const r = await eden.v1.shares({ token }).delete();
    return unwrap(r) as { ok: true };
  },
};

export const fileVersionApi = {
  list: async (
    fileId: string
  ): Promise<{
    items: { id: string; version: number; sizeBytes: number; checksum: string; createdBy: string; createdAt: string }[];
  }> => {
    const r = await eden.v1.files({ id: fileId }).versions.get();
    return unwrap(r) as unknown as {
      items: { id: string; version: number; sizeBytes: number; checksum: string; createdBy: string; createdAt: string }[];
    };
  },
};

export const notificationApi = {
  list: async (
    q: { workspaceId?: string; kind?: string; unread?: boolean; limit?: number } = {}
  ): Promise<{ items: NotificationItem[] }> => {
    const query: Record<string, string | number | boolean> = {};
    if (q.workspaceId !== undefined) query.workspaceId = q.workspaceId;
    if (q.kind !== undefined) query.kind = q.kind;
    if (q.unread !== undefined) query.unread = q.unread;
    if (q.limit !== undefined) query.limit = q.limit;
    const r = await eden.v1.notifications.get({ query: query as never });
    return unwrap(r) as unknown as { items: NotificationItem[] };
  },
  read: async (id: string): Promise<{ ok: true }> => {
    const r = await eden.v1.notifications({ id }).read.patch();
    return unwrap(r) as { ok: true };
  },
  readAll: async (workspaceId?: string): Promise<{ ok: true; count: number }> => {
    const r = await eden.v1.notifications["read-all"].post(workspaceId ? { workspaceId } : {});
    return unwrap(r) as { ok: true; count: number };
  },
};
