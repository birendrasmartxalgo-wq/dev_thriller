import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { col } from "@/db/mongo";
import { redis, keys } from "@/db/dragonfly";
import { accessJwt, refreshJwt, type RefreshClaims } from "@/lib/jwt";
import { hashPassword, verifyPassword, randomToken, sha256Hex } from "@/lib/hash";
import { Errors } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { env } from "@/config/env";
import { authPlugin, requireAuth } from "@/middleware/auth";

const EmailLike = t.String({ format: "email", maxLength: 254 });
const Password = t.String({ minLength: 8, maxLength: 128 });

async function issueTokens(accessJwtCtx: any, refreshJwtCtx: any, userId: ObjectId, email: string, ua?: string, ip?: string) {
  const jti = randomToken(16);
  const access = await accessJwtCtx.sign({ sub: userId.toHexString(), email, jti });
  const refresh = await refreshJwtCtx.sign({ sub: userId.toHexString(), jti });
  const tokenHash = await sha256Hex(refresh);
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86_400_000);
  await col.refreshTokens().insertOne({
    _id: new ObjectId(),
    userId,
    tokenHash,
    expiresAt,
    createdAt: new Date(),
    userAgent: ua,
    ip,
  });
  return { access, refresh, accessExpiresIn: env.JWT_ACCESS_TTL_MIN * 60 };
}

export const authRoutes = new Elysia({ prefix: "/v1/auth" })
  .use(accessJwt)
  .use(refreshJwt)
  .use(authPlugin)

  .post(
    "/signup",
    async ({ body, accessJwt, refreshJwt, server, request }) => {
      const ip = server?.requestIP(request)?.address ?? "0.0.0.0";
      await enforceRateLimit(ip, { bucket: "auth:signup", limit: 10, windowSec: 3600 });

      const emailLower = body.email.toLowerCase().trim();
      if (!body.name.trim()) throw Errors.badRequest("name_required", "Name is required");
      const exists = await col.users().findOne({ emailLower });
      if (exists) throw Errors.conflict("email_taken", "Email already registered");

      const now = new Date();
      const passwordHash = await hashPassword(body.password);
      const userId = new ObjectId();
      await col.users().insertOne({
        _id: userId,
        email: body.email.trim(),
        emailLower,
        name: body.name.trim(),
        passwordHash,
        createdAt: now,
        lastSeenAt: now,
      });

      const tokens = await issueTokens(
        accessJwt,
        refreshJwt,
        userId,
        body.email,
        request.headers.get("user-agent") ?? undefined,
        ip
      );
      return { user: { id: userId.toHexString(), email: body.email, name: body.name }, ...tokens };
    },
    {
      body: t.Object({ email: EmailLike, password: Password, name: t.String({ minLength: 1, maxLength: 80 }) }),
    }
  )

  .post(
    "/login",
    async ({ body, accessJwt, refreshJwt, server, request }) => {
      const ip = server?.requestIP(request)?.address ?? "0.0.0.0";
      await enforceRateLimit(ip, { bucket: "auth:login", limit: 20, windowSec: 900 });

      const emailLower = body.email.toLowerCase().trim();
      const user = await col.users().findOne({ emailLower });
      if (!user || user.deletedAt) throw Errors.unauthorized("Invalid credentials");
      const ok = await verifyPassword(body.password, user.passwordHash);
      if (!ok) throw Errors.unauthorized("Invalid credentials");

      await col.users().updateOne({ _id: user._id }, { $set: { lastSeenAt: new Date() } });
      const tokens = await issueTokens(
        accessJwt,
        refreshJwt,
        user._id,
        user.email,
        request.headers.get("user-agent") ?? undefined,
        ip
      );
      return {
        user: { id: user._id.toHexString(), email: user.email, name: user.name, avatarUrl: user.avatarUrl ?? null },
        ...tokens,
      };
    },
    { body: t.Object({ email: EmailLike, password: Password }) }
  )

  .post(
    "/refresh",
    async ({ body, accessJwt, refreshJwt }) => {
      const payload = (await refreshJwt.verify(body.refreshToken)) as RefreshClaims | false;
      if (!payload) throw Errors.unauthorized("Invalid refresh token");

      const tokenHash = await sha256Hex(body.refreshToken);
      const record = await col.refreshTokens().findOne({ tokenHash });
      if (!record || record.revokedAt || record.expiresAt < new Date()) {
        // Possible token reuse — revoke all sessions for the user.
        if (ObjectId.isValid(payload.sub)) {
          await col
            .refreshTokens()
            .updateMany({ userId: new ObjectId(payload.sub), revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
        }
        throw Errors.unauthorized("Refresh token revoked");
      }

      await col.refreshTokens().updateOne({ _id: record._id }, { $set: { revokedAt: new Date() } });
      const userId = record.userId;
      const user = await col.users().findOne({ _id: userId });
      if (!user || user.deletedAt) throw Errors.unauthorized("User inactive");

      const tokens = await issueTokens(accessJwt, refreshJwt, userId, user.email);
      return tokens;
    },
    { body: t.Object({ refreshToken: t.String() }) }
  )

  .post(
    "/logout",
    async ({ body, auth }) => {
      if (body.refreshToken) {
        const tokenHash = await sha256Hex(body.refreshToken);
        await col.refreshTokens().updateOne({ tokenHash }, { $set: { revokedAt: new Date() } });
      }
      if (auth?.jti) {
        await redis.set(keys.sessionRevoked(auth.jti), "1", "EX", env.JWT_ACCESS_TTL_MIN * 60);
      }
      return { ok: true };
    },
    { body: t.Object({ refreshToken: t.Optional(t.String()) }) }
  )

  .get("/me", async ({ auth }) => {
    requireAuth(auth);
    const user = await col.users().findOne({ _id: auth.userId });
    if (!user || user.deletedAt) throw Errors.unauthorized("User inactive");
    return {
      id: user._id.toHexString(),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: user.createdAt,
    };
  });
