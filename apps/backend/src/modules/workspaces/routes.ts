import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { col } from "@/db/mongo";
import { authPlugin, requireAuth } from "@/middleware/auth";
import { Errors } from "@/lib/errors";
import { slugify, caseNumber } from "@/lib/slug";
import { writeAudit } from "@/lib/audit";
import { assertRoleAtLeast, getMembership, invalidateAclCache } from "@/lib/acl";
import { randomToken } from "@/lib/hash";

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
      };
    },
    { params: IdParam }
  )

  .get(
    "/:id/members",
    async ({ auth, params }) => {
      requireAuth(auth);
      const wsId = oid(params.id);
      const mem = await getMembership(wsId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const mems = await col.memberships().find({ workspaceId: wsId }).toArray();
      const userIds = mems.map((m) => m.userId);
      const users = await col.users().find({ _id: { $in: userIds } }).toArray();
      const byId = new Map(users.map((u) => [u._id.toHexString(), u]));
      return {
        items: mems.map((m) => {
          const u = byId.get(m.userId.toHexString());
          return {
            userId: m.userId.toHexString(),
            email: u?.email ?? null,
            name: u?.name ?? null,
            avatarUrl: u?.avatarUrl ?? null,
            role: m.role,
            status: m.status,
          };
        }),
      };
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
