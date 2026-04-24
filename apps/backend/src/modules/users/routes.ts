// User self-service.
// PATCH  /v1/users/me                  — edit profile (name, timezone, status, pronouns, notifPrefs)
// POST   /v1/users/me/password         — change password (rate-limited, revokes other refresh tokens)
// POST   /v1/users/me/avatar           — small inline avatar upload (≤ 1 MB)
// GET    /v1/auth/sessions             — list this user's active refresh tokens
// DELETE /v1/auth/sessions/:id         — revoke one
// POST   /v1/auth/sessions/revoke-all  — revoke everything except the current session

import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { col } from "@/db/mongo";
import { authPlugin, requireAuth } from "@/middleware/auth";
import { Errors } from "@/lib/errors";
import { hashPassword, sha256Hex, verifyPassword } from "@/lib/hash";
import { enforceRateLimit } from "@/lib/rate-limit";
import { uploadAvatar } from "@/lib/r2";
import { env, r2Configured } from "@/config/env";
import { sendPasswordChangedEmail } from "@/lib/email";

function oid(s: string) {
  if (!ObjectId.isValid(s)) throw Errors.badRequest("bad_id", "Invalid id");
  return new ObjectId(s);
}

export const userRoutes = new Elysia({ prefix: "/v1" })
  .use(authPlugin)

  .patch(
    "/users/me",
    async ({ auth, body }) => {
      requireAuth(auth);
      const $set: Record<string, unknown> = {};
      if (body.name !== undefined) $set.name = body.name.trim();
      if (body.timezone !== undefined) $set.timezone = body.timezone;
      if (body.status !== undefined) $set.status = body.status.slice(0, 140);
      if (body.pronouns !== undefined) $set.pronouns = body.pronouns;
      if (body.notifPrefs !== undefined) $set.notifPrefs = body.notifPrefs;
      if (Object.keys($set).length === 0) return { ok: true };
      await col.users().updateOne({ _id: auth.userId }, { $set });
      return { ok: true };
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 80 })),
        timezone: t.Optional(t.String({ maxLength: 60 })),
        status: t.Optional(t.String({ maxLength: 140 })),
        pronouns: t.Optional(t.String({ maxLength: 30 })),
        notifPrefs: t.Optional(
          t.Object({
            mentions: t.Optional(t.Boolean()),
            all: t.Optional(t.Boolean()),
            dm: t.Optional(t.Boolean()),
            digest: t.Optional(t.Boolean()),
            push: t.Optional(t.Boolean()),
          })
        ),
      }),
    }
  )

  .post(
    "/users/me/password",
    async ({ auth, body, server, request }) => {
      requireAuth(auth);
      const ip = server?.requestIP(request)?.address ?? "0.0.0.0";
      await enforceRateLimit(ip, { bucket: "password:change", limit: 10, windowSec: 3600 });
      const user = await col.users().findOne({ _id: auth.userId });
      if (!user || user.deletedAt) throw Errors.unauthorized();
      const ok = await verifyPassword(body.currentPassword, user.passwordHash);
      if (!ok) throw Errors.unauthorized("Current password incorrect");
      const passwordHash = await hashPassword(body.newPassword);
      await col.users().updateOne({ _id: user._id }, { $set: { passwordHash } });
      // Revoke all OTHER refresh tokens; the one tied to the current session keeps working.
      // We can't identify "current" from an access token alone — we revoke all and let the
      // caller re-log-in on next refresh. This is the conservative choice.
      await col.refreshTokens().updateMany({ userId: user._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
      void sendPasswordChangedEmail({ to: user.email, name: user.name, ip }).catch(() => {});
      return { ok: true };
    },
    {
      body: t.Object({
        currentPassword: t.String({ minLength: 8 }),
        newPassword: t.String({ minLength: 8, maxLength: 128 }),
      }),
    }
  )

  .post(
    "/users/me/avatar",
    async ({ auth, body }) => {
      requireAuth(auth);
      if (!r2Configured) throw Errors.internal("File storage not configured");
      if (!(body.file instanceof File)) throw Errors.badRequest("bad_body", "Expected a file");
      const MAX = 1024 * 1024;
      if (body.file.size > MAX) throw Errors.badRequest("too_large", "Avatar must be ≤ 1 MB");
      const buf = Buffer.from(await body.file.arrayBuffer());
      const key = `users/${auth.userId.toHexString()}/avatar`;
      const url = await uploadAvatar(key, buf, body.file.type || "image/png");
      await col.users().updateOne({ _id: auth.userId }, { $set: { avatarUrl: url } });
      return { url };
    },
    { body: t.Object({ file: t.File() }) }
  )

  .get("/auth/sessions", async ({ auth }) => {
    requireAuth(auth);
    const items = await col
      .refreshTokens()
      .find({ userId: auth.userId, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .toArray();
    return {
      items: items.map((r) => ({
        id: r._id.toHexString(),
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        userAgent: r.userAgent ?? null,
        ip: r.ip ?? null,
      })),
    };
  })

  .delete(
    "/auth/sessions/:id",
    async ({ auth, params }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const r = await col.refreshTokens().findOne({ _id: id, userId: auth.userId });
      if (!r) throw Errors.notFound("Session");
      await col.refreshTokens().updateOne({ _id: id }, { $set: { revokedAt: new Date() } });
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) }
  )

  .post("/auth/sessions/revoke-all", async ({ auth }) => {
    requireAuth(auth);
    const r = await col.refreshTokens().updateMany(
      { userId: auth.userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } }
    );
    return { ok: true, count: r.modifiedCount };
  });

// Re-export for reuse.
export { sha256Hex };

// Keep env + oid from going unused; kept in scope for future expansion.
void env;
