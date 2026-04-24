import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { col } from "@/db/mongo";
import { redis, keys } from "@/db/dragonfly";
import { authPlugin, requireAuth } from "@/middleware/auth";
import { Errors } from "@/lib/errors";
import { slugify, caseNumber } from "@/lib/slug";
import { writeAudit } from "@/lib/audit";
import { assertRoleAtLeast, getMembership, invalidateAclCache } from "@/lib/acl";
import { randomToken } from "@/lib/hash";
import { sendInviteEmail } from "@/lib/email";
import { env } from "@/config/env";

const IdParam = t.Object({ id: t.String() });

function oid(s: string): ObjectId {
  if (!ObjectId.isValid(s)) throw Errors.badRequest("bad_id", "Invalid id");
  return new ObjectId(s);
}

export const workspaceRoutes = new Elysia({ prefix: "/v1/workspaces" })
  .use(authPlugin)

  .get("/", async ({ auth }) => {
    requireAuth(auth);
    const mems = await col.memberships().find({ userId: auth.userId, status: "active" }).toArray();
    if (mems.length === 0) return { items: [] };
    const ids = mems.map((m) => m.workspaceId);
    const ws = await col.workspaces().find({ _id: { $in: ids }, deletedAt: { $exists: false } }).toArray();
    const memByWs = new Map(mems.map((m) => [m.workspaceId.toHexString(), m.role]));
    return {
      items: ws.map((w) => ({
        id: w._id.toHexString(),
        slug: w.slug,
        name: w.name,
        caseNumber: w.caseNumber,
        plan: w.plan,
        role: memByWs.get(w._id.toHexString()),
      })),
    };
  })

  .post(
    "/",
    async ({ auth, body }) => {
      requireAuth(auth);
      const slug = slugify(body.slug ?? body.name) || randomToken(4);
      const existing = await col.workspaces().findOne({ slug });
      if (existing) throw Errors.conflict("slug_taken", "Workspace slug already taken");
      const now = new Date();
      const wsId = new ObjectId();
      await col.workspaces().insertOne({
        _id: wsId,
        slug,
        name: body.name.trim(),
        ownerId: auth.userId,
        plan: "free",
        caseNumber: caseNumber(),
        createdAt: now,
      });
      await col.memberships().insertOne({
        _id: new ObjectId(),
        workspaceId: wsId,
        userId: auth.userId,
        role: "owner",
        status: "active",
        createdAt: now,
      });
      await writeAudit({ workspaceId: wsId, actorId: auth.userId, verb: "workspace.create", objectType: "workspace", objectId: wsId });
      return { id: wsId.toHexString(), slug, name: body.name };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 80 }),
        slug: t.Optional(t.String({ maxLength: 48 })),
      }),
    }
  )

  .get(
    "/:id",
    async ({ auth, params }) => {
      requireAuth(auth);
      const wsId = oid(params.id);
      const mem = await getMembership(wsId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const ws = await col.workspaces().findOne({ _id: wsId, deletedAt: { $exists: false } });
      if (!ws) throw Errors.notFound("Workspace");
      return {
        id: ws._id.toHexString(),
        slug: ws.slug,
        name: ws.name,
        caseNumber: ws.caseNumber,
        plan: ws.plan,
        role: mem.role,
        retention: ws.retention ?? null,
      };
    },
    { params: IdParam }
  )

  .patch(
    "/:id",
    async ({ auth, params, body }) => {
      requireAuth(auth);
      const wsId = oid(params.id);
      const mem = await getMembership(wsId, auth.userId);
      if (!mem) throw Errors.forbidden();
      assertRoleAtLeast(mem.role, "admin");
      const $set: Record<string, unknown> = {};
      if (body.name !== undefined) $set.name = body.name.trim();
      if (body.retention !== undefined) $set.retention = body.retention;
      if (Object.keys($set).length === 0) return { ok: true };
      await col.workspaces().updateOne({ _id: wsId }, { $set });
      await writeAudit({
        workspaceId: wsId,
        actorId: auth.userId,
        verb: "workspace.update",
        objectType: "workspace",
        objectId: wsId,
        metadata: $set,
      });
      return { ok: true };
    },
    {
      params: IdParam,
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 80 })),
        retention: t.Optional(
          t.Object({
            messagesDays: t.Optional(t.Number({ minimum: 0, maximum: 3650 })),
            filesDays: t.Optional(t.Number({ minimum: 0, maximum: 3650 })),
          })
        ),
      }),
    }
  )

  .get(
    "/:id/members",
    async ({ auth, params, query }) => {
      requireAuth(auth);
      const wsId = oid(params.id);
      const mem = await getMembership(wsId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const mems = await col.memberships().find({ workspaceId: wsId }).toArray();
      const userIds = mems.map((m) => m.userId);
      const users = await col.users().find({ _id: { $in: userIds } }).toArray();
      const byId = new Map(users.map((u) => [u._id.toHexString(), u]));
      let items = mems.map((m) => {
        const u = byId.get(m.userId.toHexString());
        return {
          userId: m.userId.toHexString(),
          email: u?.email ?? null,
          name: u?.name ?? null,
          avatarUrl: u?.avatarUrl ?? null,
          role: m.role,
          status: m.status,
        };
      });
      const q = query.q?.trim().toLowerCase();
      if (q) {
        items = items.filter(
          (m) =>
            (m.name ?? "").toLowerCase().startsWith(q) ||
            (m.email ?? "").toLowerCase().startsWith(q) ||
            (m.name ?? "").toLowerCase().includes(q)
        );
      }
      const limit = query.limit ? Math.min(Math.max(Number(query.limit), 1), 100) : undefined;
      if (limit) items = items.slice(0, limit);
      return { items };
    },
    { params: IdParam, query: t.Object({ q: t.Optional(t.String()), limit: t.Optional(t.Numeric()) }) }
  )

  .get(
    "/:id/presence",
    async ({ auth, params }) => {
      requireAuth(auth);
      const wsId = oid(params.id);
      const mem = await getMembership(wsId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const mems = await col.memberships().find({ workspaceId: wsId }).toArray();
      const uids = mems.map((m) => m.userId.toHexString());
      const out: Record<string, "green" | "amber" | "gray"> = {};
      if (uids.length === 0) return out;
      // MGET presence:<uid> — value is "1" (green), "idle" (amber), or missing (gray).
      const vals = await redis.mget(...uids.map((u) => keys.presence(u)));
      uids.forEach((uid, i) => {
        const v = vals[i];
        if (!v) out[uid] = "gray";
        else if (v === "idle") out[uid] = "amber";
        else out[uid] = "green";
      });
      return out;
    },
    { params: IdParam }
  )

  .post(
    "/:id/invites",
    async ({ auth, params, body }) => {
      requireAuth(auth);
      const wsId = oid(params.id);
      const mem = await getMembership(wsId, auth.userId);
      if (!mem) throw Errors.forbidden();
      assertRoleAtLeast(mem.role, "admin");

      const tokens: { email: string; token: string }[] = [];
      const ws = await col.workspaces().findOne({ _id: wsId });
      const inviter = await col.users().findOne({ _id: auth.userId });
      for (const email of body.emails) {
        const token = randomToken(24);
        await col.invites().insertOne({
          _id: new ObjectId(),
          workspaceId: wsId,
          email: email.toLowerCase().trim(),
          role: body.role,
          token,
          invitedBy: auth.userId,
          expiresAt: new Date(Date.now() + 14 * 86_400_000),
          createdAt: new Date(),
        });
        tokens.push({ email, token });
        // Fire off email (best-effort; no-op if SMTP unconfigured).
        const inviteUrl = `${env.FRONTEND_ORIGIN}/invite/${token}`;
        void sendInviteEmail({
          to: email,
          workspaceName: ws?.name ?? "Dev Thriller workspace",
          inviteUrl,
          inviterName: inviter?.name ?? "A teammate",
        }).catch(() => {});
      }
      await writeAudit({
        workspaceId: wsId,
        actorId: auth.userId,
        verb: "workspace.invite",
        objectType: "workspace",
        objectId: wsId,
        metadata: { count: body.emails.length, role: body.role },
      });
      return { invites: tokens };
    },
    {
      params: IdParam,
      body: t.Object({
        emails: t.Array(t.String({ format: "email" }), { minItems: 1, maxItems: 50 }),
        role: t.Union([t.Literal("admin"), t.Literal("member"), t.Literal("guest")]),
      }),
    }
  )

  .patch(
    "/:id/members/:uid",
    async ({ auth, params, body }) => {
      requireAuth(auth);
      const wsId = oid(params.id);
      const targetId = oid(params.uid);
      const mem = await getMembership(wsId, auth.userId);
      if (!mem) throw Errors.forbidden();
      assertRoleAtLeast(mem.role, "admin");

      const target = await col.memberships().findOne({ workspaceId: wsId, userId: targetId });
      if (!target) throw Errors.notFound("Member");
      if (target.role === "owner" && mem.role !== "owner")
        throw Errors.forbidden("Only the owner can change the owner role");

      await col.memberships().updateOne({ _id: target._id }, { $set: { role: body.role } });
      await invalidateAclCache(targetId);
      await writeAudit({
        workspaceId: wsId,
        actorId: auth.userId,
        verb: "member.role_change",
        objectType: "user",
        objectId: targetId,
        metadata: { from: target.role, to: body.role },
      });
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String(), uid: t.String() }),
      body: t.Object({ role: t.Union([t.Literal("admin"), t.Literal("member"), t.Literal("guest")]) }),
    }
  );

export const inviteRoutes = new Elysia({ prefix: "/v1/auth/invites" })
  .use(authPlugin)
  .post(
    "/:token/accept",
    async ({ auth, params }) => {
      requireAuth(auth);
      const invite = await col.invites().findOne({ token: params.token });
      if (!invite || invite.acceptedAt || invite.expiresAt < new Date())
        throw Errors.badRequest("invalid_invite", "Invite is invalid or expired");

      const existing = await col.memberships().findOne({ workspaceId: invite.workspaceId, userId: auth.userId });
      if (existing) return { workspaceId: invite.workspaceId.toHexString() };

      await col.memberships().insertOne({
        _id: new ObjectId(),
        workspaceId: invite.workspaceId,
        userId: auth.userId,
        role: invite.role,
        status: "active",
        invitedBy: invite.invitedBy,
        createdAt: new Date(),
      });
      await col.invites().updateOne({ _id: invite._id }, { $set: { acceptedAt: new Date() } });
      await writeAudit({
        workspaceId: invite.workspaceId,
        actorId: auth.userId,
        verb: "workspace.join",
        objectType: "user",
        objectId: auth.userId,
        metadata: { role: invite.role },
      });
      return { workspaceId: invite.workspaceId.toHexString() };
    },
    { params: t.Object({ token: t.String() }) }
  );
