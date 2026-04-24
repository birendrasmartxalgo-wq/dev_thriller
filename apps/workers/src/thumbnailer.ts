// Thumbnail worker. Long-running. Pulls jobs from Dragonfly list `thumb:jobs`,
// generates a 512px WebP thumbnail for image/video files, uploads to R2 at
// `thumbnails/<fileId>.webp`, and patches the files doc.
//
// Job payload: `{ fileId: string, r2Key: string, mime: string }` (JSON string).
//
// Usage: bun run apps/workers/src/thumbnailer.ts
//
// Retry policy: v1 drops failed jobs after logging. No DLQ yet — if the worker
// crashes mid-job the item is gone because BRPOP is destructive.

import { ObjectId } from "mongodb";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import { connectMongo, col } from "@be/db/mongo";
import { redis, connectDragonfly } from "@be/db/dragonfly";
import { signDownloadUrl, putObject } from "@be/lib/r2";
import { logger } from "@be/lib/logger";

interface ThumbJob {
  fileId: string;
  r2Key: string;
  mime: string;
}

const THUMB_EDGE = 512;
const THUMB_QUALITY = 82;

let shuttingDown = false;

function thumbKey(fileId: string) {
  return `thumbnails/${fileId}.webp`;
}

async function fetchToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function encodeWebp(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate() // respect EXIF orientation before we strip
    .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();
}

async function grabVideoFrame(srcBuf: Buffer): Promise<Buffer> {
  // fluent-ffmpeg needs a file path — write the source to a tmp file, extract
  // the first frame at 1s, read back, then clean up.
  const dir = await mkdtemp(join(tmpdir(), "thumb-"));
  const srcPath = join(dir, "src");
  const outPath = join(dir, "frame.png");
  try {
    await writeFile(srcPath, srcBuf);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(srcPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .screenshots({
          timestamps: ["1"],
          filename: "frame.png",
          folder: dir,
          size: `${THUMB_EDGE}x?`,
        });
    });
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function processJob(job: ThumbJob) {
  const t0 = Date.now();
  if (!ObjectId.isValid(job.fileId)) {
    logger.warn({ job }, "thumbnailer: bad fileId, skipping");
    return;
  }
  const _id = new ObjectId(job.fileId);

  if (!job.mime.startsWith("image/") && !job.mime.startsWith("video/")) {
    if (job.mime === "application/pdf") {
      logger.info({ fileId: job.fileId }, "thumbnailer: pdf skipped (v1)");
    } else {
      logger.debug({ mime: job.mime, fileId: job.fileId }, "thumbnailer: unsupported mime, skipping");
    }
    return;
  }

  // Pull the original from R2 via a signed URL — avoids threading a second R2
  // client through the worker. 10 min TTL is plenty for the download.
  const srcUrl = await signDownloadUrl(job.r2Key, 600);
  const srcBuf = await fetchToBuffer(srcUrl);

  let webp: Buffer;
  if (job.mime.startsWith("image/")) {
    webp = await encodeWebp(srcBuf);
  } else {
    const frame = await grabVideoFrame(srcBuf);
    webp = await encodeWebp(frame);
  }

  const key = thumbKey(job.fileId);
  await putObject(key, webp, "image/webp");
  await col.files().updateOne({ _id }, { $set: { thumbnailKey: key } });

  logger.info(
    { fileId: job.fileId, mime: job.mime, bytes: webp.length, ms: Date.now() - t0 },
    "thumbnailer: job done"
  );
}

async function loop() {
  while (!shuttingDown) {
    let raw: [string, string] | null = null;
    try {
      // BRPOP returns [listName, value] or null on timeout.
      raw = (await redis.brpop("thumb:jobs", 1)) as [string, string] | null;
    } catch (err) {
      if (shuttingDown) break;
      logger.error({ err }, "thumbnailer: brpop failed");
      // brief pause before retrying to avoid a tight error loop
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    if (!raw) continue;

    let job: ThumbJob;
    try {
      job = JSON.parse(raw[1]) as ThumbJob;
    } catch {
      logger.warn({ raw: raw[1] }, "thumbnailer: bad job payload, dropping");
      continue;
    }

    try {
      await processJob(job);
    } catch (err) {
      logger.error({ err, job }, "thumbnailer: job failed (dropped — no retry in v1)");
    }
  }
}

function attachShutdown() {
  const stop = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "thumbnailer: shutting down");
    // Give the current job a moment to finish, then disconnect redis.
    setTimeout(() => {
      redis.disconnect();
      process.exit(0);
    }, 2000).unref();
  };
  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
}

async function main() {
  await connectMongo();
  await connectDragonfly();
  attachShutdown();
  logger.info("thumbnailer: ready, waiting for jobs on 'thumb:jobs'");
  await loop();
}

main().catch((err) => {
  logger.error({ err }, "thumbnailer: fatal");
  process.exit(1);
});
