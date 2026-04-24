// Media extractor. Rebuilds chat_media rows from messages.attachments + URLs.
//
// Idempotent: for each message we check if chat_media already has rows with
// messageId; if yes we skip. Run after changing the extraction rules, or to
// backfill after an import.
//
// Usage: bun run apps/workers/src/media-extract.ts [--workspace <id>]

import { ObjectId } from "mongodb";
import { connectMongo, col } from "@be/db/mongo";
import { logger } from "@be/lib/logger";

function classifyUrlKind(url: string): "image" | "video" | "doc" | "audio" | "link" {
  const u = url.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/.test(u)) return "image";
  if (/\.(mp4|webm|mov|mkv|avi)(\?|$)/.test(u)) return "video";
  if (/\.(mp3|wav|m4a|flac|ogg)(\?|$)/.test(u)) return "audio";
  if (/\.(pdf|docx?|xlsx?|pptx?|txt|md|csv)(\?|$)/.test(u)) return "doc";
  return "link";
}

function extractUrls(body: string): string[] {
  const re = /https?:\/\/[^\s<>"']+/g;
  return (body.match(re) ?? []).slice(0, 10);
}

async function main() {
  await connectMongo();
  const wsArg = process.argv.indexOf("--workspace");
  const wsFilter = wsArg > -1 ? { workspaceId: new ObjectId(process.argv[wsArg + 1]!) } : {};

  const cursor = col.messages().find({ ...wsFilter, deletedAt: { $exists: false } });
  let scanned = 0;
  let inserted = 0;

  while (await cursor.hasNext()) {
    const m = (await cursor.next())!;
    scanned++;
    const already = await col.chatMedia().countDocuments({ chatId: m.chatId, createdAt: m.createdAt });
    if (already > 0) continue;

    const rows: Array<Record<string, unknown>> = [];
    for (const a of m.attachments ?? []) {
      const kind = a.mime.startsWith("image/")
        ? "image"
        : a.mime.startsWith("video/")
        ? "video"
        : a.mime.startsWith("audio/")
        ? "audio"
        : "doc";
      rows.push({
        _id: new ObjectId(),
        chatId: m.chatId,
        workspaceId: m.workspaceId,
        kind,
        fileId: a.fileId,
        senderId: m.authorId,
        sizeBytes: a.sizeBytes,
        metadata: { name: a.name, mime: a.mime, thumbnailKey: a.thumbnailKey },
        createdAt: m.createdAt,
      });
    }
    for (const url of extractUrls(m.body)) {
      rows.push({
        _id: new ObjectId(),
        chatId: m.chatId,
        workspaceId: m.workspaceId,
        kind: classifyUrlKind(url),
        url,
        senderId: m.authorId,
        createdAt: m.createdAt,
      });
    }
    if (rows.length) {
      await col.chatMedia().insertMany(rows as any[]);
      inserted += rows.length;
    }
  }

  logger.info({ scanned, inserted, workspace: wsArg > -1 ? process.argv[wsArg + 1] : "all" }, "media-extract pass done");
  process.exit(0);
}

main().catch((err) => {
  logger.error(err, "media-extract failed");
  process.exit(1);
});
