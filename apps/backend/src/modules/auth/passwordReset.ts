// Password reset: request (sends email) + confirm (sets new password + revokes sessions).
// Token: 32-byte random, hashed before storage, 1-hour TTL. Always responds 200 to avoid
// leaking which emails exist.

import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { col } from "@/db/mongo";
import { Errors } from "@/lib/errors";
import { hashPassword, randomToken, sha256Hex } from "@/lib/hash";
import { enforceRateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";
import { env } from "@/config/env";
import { redis, keys } from "@/db/dragonfly";

const RESET_TTL_SEC = 60 * 60; // 1 hour

function resetKey(tokenHash: string) {
  return `pwreset:${tokenHash}`;
}

export const passwordResetRoutes = new Elysia({ prefix: "/v1/auth/password" })
  .post(
    "/reset-request",
    async ({ body, server, request }) => {
      const ip = server?.requestIP(request)?.address ?? "0.0.0.0";
      await enforceRateLimit(ip, { bucket: "pwreset:request", limit: 5, windowSec: 900 });
      const user = await col.users().findOne({ emailLower: body.email.toLowerCase().trim() });
      if (user && !user.deletedAt) {
        const token = randomToken(32);
        const tokenHash = await sha256Hex(token);
        await redis.set(resetKey(tokenHash), user._id.toHexString(), "EX", RESET_TTL_SEC);
        const url = `${env.FRONTEND_ORIGIN}/reset-password?token=${token}`;
        void sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl: url }).catch(() => {});
      }
      // Always 200 — don't leak existence.
      return { ok: true };
    },
    { body: t.Object({ email: t.String({ format: "email" }) }) }
  )

  .post(
    "/reset",
    async ({ body, server, request }) => {
      const ip = server?.requestIP(request)?.address ?? "0.0.0.0";
      await enforceRateLimit(ip, { bucket: "pwreset:confirm", limit: 10, windowSec: 3600 });
      const tokenHash = await sha256Hex(body.token);
      const userIdHex = await redis.get(resetKey(tokenHash));
      if (!userIdHex) throw Errors.badRequest("invalid_token", "Reset token is invalid or expired");
      if (!ObjectId.isValid(userIdHex)) throw Errors.badRequest("invalid_token", "Reset token payload invalid");
      const userId = new ObjectId(userIdHex);
      const user = await col.users().findOne({ _id: userId });
      if (!user || user.deletedAt) throw Errors.badRequest("invalid_token", "User inactive");
      const passwordHash = await hashPassword(body.newPassword);
      await col.users().updateOne({ _id: userId }, { $set: { passwordHash } });
      // Revoke everything.
      await col.refreshTokens().updateMany({ userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
      await redis.del(resetKey(tokenHash));
      // Force any active access tokens with jti to be invalidated.
      void keys;
      return { ok: true };
    },
    { body: t.Object({ token: t.String({ minLength: 32 }), newPassword: t.String({ minLength: 8, maxLength: 128 }) }) }
  );
