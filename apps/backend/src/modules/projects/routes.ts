import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { col } from "@/db/mongo";
import { authPlugin, requireAuth } from "@/middleware/auth";
import { Errors } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import { getMembership, assertRoleAtLeast } from "@/lib/acl";
import { writeAudit } from "@/lib/audit";

function oid(s: string) {
  if (!ObjectId.isValid(s)) throw Errors.badRequest("bad_id", "Invalid id");
  return new ObjectId(s);
}

export const projectRoutes = new Elysia({ prefix: "/v1/projects" })
  .use(authPlugin)

  .get(
    "/",
    async ({ auth, query }) => {
      requireAuth(auth);
      const wsId = oid(query.workspaceId);
      const mem = await getMembership(wsId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const items = await col
        .projects()
        .find({ workspaceId: wsId, archivedAt: { $exists: false } })
        .sort({ createdAt: -1 })
        .toArray();
      return {
        items: items.map((p) => ({
          id: p._id.toHexString(),
          name: p.name,
          slug: p.slug,
          visibility: p.visibility,
        })),
      };
    },
    { query: t.Object({ workspaceId: t.String() }) }
  )

  .post(
    "/",
    async ({ auth, body }) => {
      requireAuth(auth);
      const wsId = oid(body.workspaceId);
      const mem = await getMembership(wsId, auth.userId);
      if (!mem) throw Errors.forbidden();
      assertRoleAtLeast(mem.role, "member");
      const slug = slugify(body.slug ?? body.name);
      const exists = await col.projects().findOne({ workspaceId: wsId, slug });
      if (exists) throw Errors.conflict("slug_taken", "Project slug already taken");
      const id = new ObjectId();
      await col.projects().insertOne({
        _id: id,
        workspaceId: wsId,
        name: body.name.trim(),
        slug,
        visibility: body.visibility ?? "workspace",
        createdBy: auth.userId,
        createdAt: new Date(),
      });
      await writeAudit({ workspaceId: wsId, actorId: auth.userId, verb: "project.create", objectType: "project", objectId: id });
      return { id: id.toHexString(), slug };
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String({ minLength: 1, maxLength: 80 }),
        slug: t.Optional(t.String()),
        visibility: t.Optional(t.Union([t.Literal("public"), t.Literal("workspace"), t.Literal("restricted")])),
      }),
    }
  )

  .patch(
    "/:id",
    async ({ auth, params, body }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const project = await col.projects().findOne({ _id: id });
      if (!project) throw Errors.notFound("Project");
      const mem = await getMembership(project.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      assertRoleAtLeast(mem.role, "member");
      const $set: Record<string, any> = {};
      if (body.name) $set.name = body.name;
      if (body.visibility) $set.visibility = body.visibility;
      await col.projects().updateOne({ _id: id }, { $set });
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        visibility: t.Optional(t.Union([t.Literal("public"), t.Literal("workspace"), t.Literal("restricted")])),
      }),
    }
  )

  .delete(
    "/:id",
    async ({ auth, params }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const project = await col.projects().findOne({ _id: id });
      if (!project) throw Errors.notFound("Project");
      const mem = await getMembership(project.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      assertRoleAtLeast(mem.role, "admin");
      await col.projects().updateOne({ _id: id }, { $set: { archivedAt: new Date() } });
      await writeAudit({
        workspaceId: project.workspaceId,
        actorId: auth.userId,
        verb: "project.archive",
        objectType: "project",
        objectId: id,
      });
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) }
  );
