import { Elysia, t } from "elysia";
import { ObjectId, Binary } from "mongodb";
import { col } from "@/db/mongo";
import { redis } from "@/db/dragonfly";
import { authPlugin, requireAuth } from "@/middleware/auth";
import { Errors } from "@/lib/errors";
import { getMembership, assertRoleAtLeast } from "@/lib/acl";
import {
  abortMultipart,
  completeMultipart,
  createMultipart,
  deleteObject,
  fileKey,
  signDownloadUrl,
  signPartUrl,
} from "@/lib/r2";
import { emptyBitmap, getBit, missingBits, setBit } from "@/lib/bitmap";
import { randomToken } from "@/lib/hash";
import { writeAudit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { env, r2Configured } from "@/config/env";

const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB
const MAX_FILE = 1024 * 1024 * 1024; // 1 GB

function oid(s: string) {
  if (!ObjectId.isValid(s)) throw Errors.badRequest("bad_id", "Invalid id");
  return new ObjectId(s);
}

export const fileRoutes = new Elysia({ prefix: "/v1" })
  .use(authPlugin)

  .post(
    "/uploads",
    async ({ auth, body }) => {
      requireAuth(auth);
      await enforceRateLimit(auth.userId.toHexString(), { bucket: "upload:init", limit: 60, windowSec: 3600 });
      if (!r2Configured) throw Errors.internal("File storage not configured");
      const wsId = oid(body.workspaceId);
      const mem = await getMembership(wsId, auth.userId);
      if (!mem) throw Errors.forbidden();
      assertRoleAtLeast(mem.role, "member");

      if (body.size <= 0 || body.size > MAX_FILE)
        throw Errors.badRequest("bad_size", `File must be 1..${MAX_FILE} bytes`);

      const chunkSize = Math.max(body.chunkSize ?? CHUNK_SIZE, 5 * 1024 * 1024);
      const totalChunks = Math.ceil(body.size / chunkSize);
      const fileIdPending = new ObjectId();
      const key = fileKey(wsId.toHexString(), fileIdPending.toHexString(), 1, body.filename);
      const uploadId = await createMultipart(key, body.mime);

      const sessionId = new ObjectId();
      await col.uploadSessions().insertOne({
        _id: sessionId,
        userId: auth.userId,
        workspaceId: wsId,
        filename: body.filename,
        mime: body.mime,
        sizeBytes: body.size,
        chunkSize,
        totalChunks,
        receivedBitmap: new Binary(emptyBitmap(totalChunks)),
        checksumExpected: body.checksum,
        status: "initiated",
        r2Key: key,
        r2UploadId: uploadId,
        parts: [],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      });

      const urls: { n: number; url: string }[] = [];
      for (let i = 1; i <= totalChunks; i++) urls.push({ n: i, url: await signPartUrl(key, uploadId, i, 3600) });
      return { uploadId: sessionId.toHexString(), chunkSize, totalChunks, chunkUrls: urls };
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        filename: t.String({ minLength: 1, maxLength: 260 }),
        mime: t.String({ minLength: 1 }),
        size: t.Number(),
        checksum: t.String({ minLength: 10 }),
        chunkSize: t.Optional(t.Number()),
      }),
    }
  )

  .post(
    "/uploads/:id/chunks/:idx",
    async ({ auth, params, body }) => {
      requireAuth(auth);
      const sessionId = oid(params.id);
      const idx = Number(params.idx);
      const sess = await col.uploadSessions().findOne({ _id: sessionId, userId: auth.userId });
      if (!sess) throw Errors.notFound("Upload session");
      if (sess.status !== "initiated" && sess.status !== "uploading")
        throw Errors.badRequest("bad_status", `Session ${sess.status}`);
      if (idx < 1 || idx > sess.totalChunks)
        throw Errors.badRequest("bad_index", `Chunk ${idx} out of range`);

      // Client uploaded the chunk directly to R2 with the signed URL; they post back etag for bookkeeping.
      const etag = body.etag.replace(/"/g, "");
      const bitmap = Buffer.from(sess.receivedBitmap.buffer);
      const next = setBit(bitmap, idx - 1);
      const parts = sess.parts.filter((p) => p.n !== idx).concat({ n: idx, etag, size: body.size });
      await col.uploadSessions().updateOne(
        { _id: sessionId },
        { $set: { receivedBitmap: new Binary(next), parts, status: "uploading" } }
      );
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String(), idx: t.String() }),
      body: t.Object({ etag: t.String(), size: t.Number() }),
    }
  )

  .get(
    "/uploads/:id/status",
    async ({ auth, params }) => {
      requireAuth(auth);
      const sess = await col.uploadSessions().findOne({ _id: oid(params.id), userId: auth.userId });
      if (!sess) throw Errors.notFound("Upload session");
      const bitmap = Buffer.from(sess.receivedBitmap.buffer);
      return {
        status: sess.status,
        totalChunks: sess.totalChunks,
        missing: missingBits(bitmap, sess.totalChunks).map((i) => i + 1),
      };
    },
    { params: t.Object({ id: t.String() }) }
  )

  .post(
    "/uploads/:id/complete",
    async ({ auth, params }) => {
      requireAuth(auth);
      const sess = await col.uploadSessions().findOne({ _id: oid(params.id), userId: auth.userId });
      if (!sess) throw Errors.notFound("Upload session");
      if (sess.status === "complete") {
        const f = await col.files().findOne({ r2Key: sess.r2Key });
        return { fileId: f?._id.toHexString(), already: true };
      }
      const bitmap = Buffer.from(sess.receivedBitmap.buffer);
      for (let i = 0; i < sess.totalChunks; i++) {
        if (!getBit(bitmap, i)) throw Errors.badRequest("missing_chunks", `Chunk ${i + 1} not received`);
      }
      await col.uploadSessions().updateOne({ _id: sess._id }, { $set: { status: "assembling" } });
      try {
        await completeMultipart(sess.r2Key, sess.r2UploadId, sess.parts);
      } catch (e) {
        await col.uploadSessions().updateOne({ _id: sess._id }, { $set: { status: "corrupt" } });
        throw Errors.unprocessable("multipart_failed", "Failed to assemble parts");
      }

      const fileId = new ObjectId();
      await col.files().insertOne({
        _id: fileId,
        workspaceId: sess.workspaceId,
        uploaderId: sess.userId,
        name: sess.filename,
        mime: sess.mime,
        sizeBytes: sess.sizeBytes,
        checksum: sess.checksumExpected,
        r2Key: sess.r2Key,
        version: 1,
        createdAt: new Date(),
      });
      await col.fileVersions().insertOne({
        _id: new ObjectId(),
        fileId,
        version: 1,
        r2Key: sess.r2Key,
        sizeBytes: sess.sizeBytes,
        checksum: sess.checksumExpected,
        createdBy: sess.userId,
        createdAt: new Date(),
      });
      await col.uploadSessions().updateOne({ _id: sess._id }, { $set: { status: "complete" } });
      await writeAudit({
        workspaceId: sess.workspaceId,
        actorId: sess.userId,
        verb: "file.upload",
        objectType: "file",
        objectId: fileId,
        metadata: { name: sess.filename, size: sess.sizeBytes },
      });
      // Enqueue thumbnail job for images/videos. Failure here must not block the response.
      if (sess.mime.startsWith("image/") || sess.mime.startsWith("video/")) {
        try {
          await redis.lpush(
            "thumb:jobs",
            JSON.stringify({ fileId: fileId.toHexString(), r2Key: sess.r2Key, mime: sess.mime })
          );
        } catch (err) {
          logger.warn({ err, fileId: fileId.toHexString() }, "failed to enqueue thumbnail job");
        }
      }
      return { fileId: fileId.toHexString() };
    },
    { params: t.Object({ id: t.String() }) }
  )

  .delete(
    "/uploads/:id",
    async ({ auth, params }) => {
      requireAuth(auth);
      const sess = await col.uploadSessions().findOne({ _id: oid(params.id), userId: auth.userId });
      if (!sess) return { ok: true };
      await abortMultipart(sess.r2Key, sess.r2UploadId);
      await col.uploadSessions().updateOne({ _id: sess._id }, { $set: { status: "expired" } });
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) }
  )

  .get(
    "/files/:id",
    async ({ auth, params }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const f = await col.files().findOne({ _id: id, deletedAt: { $exists: false } });
      if (!f) throw Errors.notFound("File");
      const mem = await getMembership(f.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const url = await signDownloadUrl(f.r2Key, 900);
      const thumbnailUrl = f.thumbnailKey ? await signDownloadUrl(f.thumbnailKey, 300) : null;
      return {
        id: f._id.toHexString(),
        name: f.name,
        mime: f.mime,
        sizeBytes: f.sizeBytes,
        checksum: f.checksum,
        version: f.version,
        url,
        thumbnailKey: f.thumbnailKey ?? null,
        thumbnailUrl,
        createdAt: f.createdAt,
      };
    },
    { params: t.Object({ id: t.String() }) }
  )

  .get(
    "/files/:id/versions",
    async ({ auth, params }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const f = await col.files().findOne({ _id: id, deletedAt: { $exists: false } });
      if (!f) throw Errors.notFound("File");
      const mem = await getMembership(f.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const items = await col.fileVersions().find({ fileId: id }).sort({ version: -1 }).toArray();
      return {
        items: items.map((v) => ({
          id: v._id.toHexString(),
          version: v.version,
          sizeBytes: v.sizeBytes,
          checksum: v.checksum,
          createdBy: v.createdBy.toHexString(),
          createdAt: v.createdAt,
        })),
      };
    },
    { params: t.Object({ id: t.String() }) }
  )

  .get(
    "/files/:id/thumbnail",
    async ({ auth, params }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const f = await col.files().findOne({ _id: id, deletedAt: { $exists: false } });
      if (!f) throw Errors.notFound("File");
      const mem = await getMembership(f.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      if (!f.thumbnailKey) throw Errors.notFound("Thumbnail");
      const url = await signDownloadUrl(f.thumbnailKey, 300);
      return { url };
    },
    { params: t.Object({ id: t.String() }) }
  )

  .patch(
    "/files/:id",
    async ({ auth, params, body }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const f = await col.files().findOne({ _id: id, deletedAt: { $exists: false } });
      if (!f) throw Errors.notFound("File");
      const mem = await getMembership(f.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const $set: Record<string, unknown> = {};
      if (body.name) $set.name = body.name;
      if (body.parentFolderId) $set.parentFolderId = oid(body.parentFolderId);
      await col.files().updateOne({ _id: id }, { $set });
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ name: t.Optional(t.String()), parentFolderId: t.Optional(t.String()) }),
    }
  )

  .delete(
    "/files/:id",
    async ({ auth, params }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const f = await col.files().findOne({ _id: id, deletedAt: { $exists: false } });
      if (!f) throw Errors.notFound("File");
      const mem = await getMembership(f.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const isOwner = f.uploaderId.equals(auth.userId);
      const isAdmin = mem.role === "owner" || mem.role === "admin";
      if (!isOwner && !isAdmin) throw Errors.forbidden();
      await col.files().updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
      await writeAudit({ workspaceId: f.workspaceId, actorId: auth.userId, verb: "file.delete", objectType: "file", objectId: id });
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) }
  )

  .get(
    "/files/:id/shares",
    async ({ auth, params }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const f = await col.files().findOne({ _id: id, deletedAt: { $exists: false } });
      if (!f) throw Errors.notFound("File");
      const mem = await getMembership(f.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const items = await col
        .shareLinks()
        .find({ resourceType: "file", resourceId: id, revokedAt: { $exists: false } })
        .sort({ createdAt: -1 })
        .toArray();
      return {
        items: items.map((s) => ({
          id: s._id.toHexString(),
          token: s.token,
          visibility: s.visibility,
          url: `${env.FRONTEND_ORIGIN}/s/${s.token}`,
          expiresAt: s.expiresAt ?? null,
          createdAt: s.createdAt,
        })),
      };
    },
    { params: t.Object({ id: t.String() }) }
  )

  .delete(
    "/shares/:token",
    async ({ auth, params }) => {
      requireAuth(auth);
      const link = await col.shareLinks().findOne({ token: params.token });
      if (!link) throw Errors.notFound("Share link");
      const mem = await getMembership(link.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      await col.shareLinks().updateOne({ _id: link._id }, { $set: { revokedAt: new Date() } });
      await writeAudit({
        workspaceId: link.workspaceId,
        actorId: auth.userId,
        verb: "file.share_revoke",
        objectType: "file",
        objectId: link.resourceId,
      });
      return { ok: true };
    },
    { params: t.Object({ token: t.String() }) }
  )

  .post(
    "/files/:id/share",
    async ({ auth, params, body }) => {
      requireAuth(auth);
      const id = oid(params.id);
      const f = await col.files().findOne({ _id: id, deletedAt: { $exists: false } });
      if (!f) throw Errors.notFound("File");
      const mem = await getMembership(f.workspaceId, auth.userId);
      if (!mem) throw Errors.forbidden();
      assertRoleAtLeast(mem.role, "member");
      const token = randomToken(24);
      const linkId = new ObjectId();
      await col.shareLinks().insertOne({
        _id: linkId,
        resourceType: "file",
        resourceId: id,
        workspaceId: f.workspaceId,
        token,
        visibility: body.visibility,
        createdBy: auth.userId,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        createdAt: new Date(),
      });
      await writeAudit({ workspaceId: f.workspaceId, actorId: auth.userId, verb: "file.share", objectType: "file", objectId: id, metadata: { visibility: body.visibility } });
      return {
        url: `${env.FRONTEND_ORIGIN}/s/${token}`,
        token,
      };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        visibility: t.Union([t.Literal("public"), t.Literal("workspace"), t.Literal("restricted")]),
        expiresAt: t.Optional(t.String()),
      }),
    }
  );

export const shareLinkRoutes = new Elysia({ prefix: "/v1/s" }).get(
  "/:token",
  async ({ params }) => {
    const link = await col.shareLinks().findOne({ token: params.token });
    if (!link || link.revokedAt || (link.expiresAt && link.expiresAt < new Date())) throw Errors.notFound("Share link");
    if (link.resourceType !== "file") throw Errors.notFound("Share link");
    const f = await col.files().findOne({ _id: link.resourceId, deletedAt: { $exists: false } });
    if (!f) throw Errors.notFound("File");
    const url = await signDownloadUrl(f.r2Key, 900);
    return { name: f.name, mime: f.mime, sizeBytes: f.sizeBytes, url };
  },
  { params: t.Object({ token: t.String() }) }
);
