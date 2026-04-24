import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { col } from "@/db/mongo";
import { authPlugin, requireAuth } from "@/middleware/auth";
import { Errors } from "@/lib/errors";
import { getMembership } from "@/lib/acl";

// Simple query DSL: `from:@name has:file|image before:YYYY-MM-DD after:YYYY-MM-DD "phrase" freetext`
interface Parsed {
  terms: string[];
  from?: string;
  has?: "file" | "image" | "video" | "doc";
  before?: Date;
  after?: Date;
  inChat?: string;
}
function parseQuery(q: string): Parsed {
  const out: Parsed = { terms: [] };
  const tokens = q.match(/"[^"]+"|\S+/g) ?? [];
  for (const raw of tokens) {
    const tok = raw.replace(/^"|"$/g, "");
    const [k, v] = tok.includes(":") ? tok.split(":", 2) : [null, tok];
    if (k === "from") out.from = v!.replace(/^@/, "").toLowerCase();
    else if (k === "has" && ["file", "image", "video", "doc"].includes(v!)) out.has = v as any;
    else if (k === "before") out.before = new Date(v!);
    else if (k === "after") out.after = new Date(v!);
    else if (k === "in") out.inChat = v!;
    else out.terms.push(tok);
  }
  return out;
}

function oid(s: string) {
  if (!ObjectId.isValid(s)) throw Errors.badRequest("bad_id", "Invalid id");
  return new ObjectId(s);
}

export const searchRoutes = new Elysia({ prefix: "/v1/search" })
  .use(authPlugin)

  .get(
    "/",
    async ({ auth, query }) => {
      requireAuth(auth);
      const wsId = oid(query.workspaceId);
      const mem = await getMembership(wsId, auth.userId);
      if (!mem) throw Errors.forbidden();

      const parsed = parseQuery(query.q);
      const limit = Math.min(Number(query.limit ?? 20), 50);
      const type = query.type ?? "all";

      let authorFilter: ObjectId | undefined;
      if (parsed.from) {
        const u = await col.users().findOne({
          $or: [
            { emailLower: parsed.from },
            { name: { $regex: `^${parsed.from}`, $options: "i" } },
          ],
        });
        if (u) authorFilter = u._id;
      }

      // Build results. Prefer $search (Atlas Search) if index exists; else fall back to $text.
      const text = parsed.terms.join(" ").trim();
      const messages: any[] = [];
      const files: any[] = [];

      if (type === "all" || type === "message") {
        const filter: Record<string, any> = { workspaceId: wsId, deletedAt: { $exists: false } };
        if (authorFilter) filter.authorId = authorFilter;
        if (parsed.has === "file") filter.attachments = { $exists: true, $ne: [] };
        if (parsed.has === "image")
          filter["attachments.mime"] = { $regex: "^image/" };
        if (parsed.has === "video") filter["attachments.mime"] = { $regex: "^video/" };
        if (parsed.has === "doc")
          filter["attachments.mime"] = { $regex: "^(application|text)/" };
        if (parsed.inChat) filter.chatId = oid(parsed.inChat);
        if (parsed.before || parsed.after) {
          filter.createdAt = {};
          if (parsed.before) (filter.createdAt as any).$lt = parsed.before;
          if (parsed.after) (filter.createdAt as any).$gt = parsed.after;
        }

        let cursor: any;
        if (text) {
          // Try Atlas $search first; if it fails (index missing), fall back to $text.
          try {
            cursor = col
              .messages()
              .aggregate([
                {
                  $search: {
                    index: "messages_search",
                    compound: {
                      must: [{ text: { query: text, path: "body" } }],
                      filter: [{ equals: { path: "workspaceId", value: wsId } }],
                    },
                  },
                },
                { $match: filter },
                { $limit: limit },
              ]);
            messages.push(...(await cursor.toArray()));
          } catch {
            filter.$text = { $search: text };
            messages.push(
              ...(await col
                .messages()
                .find(filter, { projection: { score: { $meta: "textScore" } } })
                .sort({ score: { $meta: "textScore" } } as any)
                .limit(limit)
                .toArray())
            );
          }
        } else {
          messages.push(
            ...(await col.messages().find(filter).sort({ createdAt: -1 }).limit(limit).toArray())
          );
        }
      }

      if (type === "all" || type === "file") {
        const filter: Record<string, any> = { workspaceId: wsId, deletedAt: { $exists: false } };
        if (authorFilter) filter.uploaderId = authorFilter;
        if (text) {
          try {
            files.push(
              ...(await col
                .files()
                .aggregate([
                  {
                    $search: {
                      index: "files_search",
                      compound: {
                        must: [{ text: { query: text, path: "name" } }],
                        filter: [{ equals: { path: "workspaceId", value: wsId } }],
                      },
                    },
                  },
                  { $match: filter },
                  { $limit: limit },
                ])
                .toArray())
            );
          } catch {
            files.push(...(await col.files().find({ ...filter, name: { $regex: text, $options: "i" } }).limit(limit).toArray()));
          }
        }
      }

      return {
        messages: messages.map((m) => ({
          id: m._id.toHexString?.() ?? String(m._id),
          chatId: m.chatId.toHexString?.() ?? String(m.chatId),
          authorId: m.authorId.toHexString?.() ?? String(m.authorId),
          body: m.body,
          createdAt: m.createdAt,
          hasAttachments: Array.isArray(m.attachments) && m.attachments.length > 0,
        })),
        files: files.map((f) => ({
          id: f._id.toHexString?.() ?? String(f._id),
          name: f.name,
          mime: f.mime,
          sizeBytes: f.sizeBytes,
          uploaderId: f.uploaderId.toHexString?.() ?? String(f.uploaderId),
          createdAt: f.createdAt,
        })),
        parsed,
      };
    },
    {
      query: t.Object({
        q: t.String({ minLength: 1 }),
        workspaceId: t.String(),
        type: t.Optional(t.Union([t.Literal("all"), t.Literal("message"), t.Literal("file")])),
        limit: t.Optional(t.Numeric()),
      }),
    }
  )

  .post(
    "/saved",
    async ({ auth, body }) => {
      requireAuth(auth);
      const wsId = oid(body.workspaceId);
      const mem = await getMembership(wsId, auth.userId);
      if (!mem) throw Errors.forbidden();
      const id = new ObjectId();
      await col.savedSearches().insertOne({
        _id: id,
        userId: auth.userId,
        workspaceId: wsId,
        name: body.name,
        query: body.query,
        createdAt: new Date(),
      });
      return { id: id.toHexString() };
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String({ minLength: 1, maxLength: 80 }),
        query: t.String({ minLength: 1 }),
      }),
    }
  );
