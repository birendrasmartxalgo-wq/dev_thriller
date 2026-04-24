import { Elysia } from "elysia";
import { ObjectId } from "mongodb";
import { accessJwt, type AccessClaims } from "@/lib/jwt";
import { Errors } from "@/lib/errors";
import { col } from "@/db/mongo";
import { redis, keys } from "@/db/dragonfly";

export type AuthContext = { userId: ObjectId; email: string; jti?: string } | null;

export const authPlugin = new Elysia({ name: "auth" })
  .use(accessJwt)
  .derive({ as: "scoped" }, async ({ accessJwt, headers }) => {
    const header = headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    let auth: AuthContext = null;
    if (token) {
      const payload = (await accessJwt.verify(token)) as AccessClaims | false;
      if (payload && ObjectId.isValid(payload.sub)) {
        if (payload.jti) {
          const revoked = await redis.get(keys.sessionRevoked(payload.jti));
          if (!revoked) auth = { userId: new ObjectId(payload.sub), email: payload.email, jti: payload.jti };
        } else {
          auth = { userId: new ObjectId(payload.sub), email: payload.email };
        }
      }
    }
    return { auth };
  });

export function requireAuth(auth: AuthContext): asserts auth is NonNullable<AuthContext> {
  if (!auth) throw Errors.unauthorized();
}

export async function currentUser(userId: ObjectId) {
  const user = await col.users().findOne({ _id: userId });
  if (!user || user.deletedAt) throw Errors.unauthorized("User inactive");
  return user;
}
