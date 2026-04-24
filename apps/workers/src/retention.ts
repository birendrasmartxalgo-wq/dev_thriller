// Retention reaper.
//
// Walks every workspace and soft-deletes messages older than the workspace's
// `retentionDays.messages` setting, and hard-deletes already-soft-deleted files
// past `retentionDays.files`. Prints a dry-run plan by default; pass --apply to
// actually write. Safe to rerun.
//
// Usage:
//   bun run apps/workers/src/retention.ts            # dry run
//   bun run apps/workers/src/retention.ts --apply    # execute
//
// Config lookup order per workspace:
//   workspaces.retention.messagesDays  (number; 0 = forever)
//   workspaces.retention.filesDays     (number; 0 = forever)
//   env DT_DEFAULT_MESSAGE_DAYS / DT_DEFAULT_FILE_DAYS (fallbacks, defaults 365 / 0)

import { ObjectId } from "mongodb";
import { connectMongo, col } from "@be/db/mongo";
import { logger } from "@be/lib/logger";

interface Plan {
  workspaceId: string;
  name: string;
  messagesToSoftDelete: number;
  filesToHardDelete: number;
  messagesCutoff: Date | null;
  filesCutoff: Date | null;
}

async function planFor(wsId: ObjectId, name: string, defaults: { msgDays: number; fileDays: number }): Promise<Plan> {
  const ws = await col.workspaces().findOne({ _id: wsId });
  const ret = (ws as unknown as { retention?: { messagesDays?: number; filesDays?: number } } | null)?.retention;
  const msgDays = ret?.messagesDays ?? defaults.msgDays;
  const fileDays = ret?.filesDays ?? defaults.fileDays;
  const messagesCutoff = msgDays > 0 ? new Date(Date.now() - msgDays * 86_400_000) : null;
  const filesCutoff = fileDays > 0 ? new Date(Date.now() - fileDays * 86_400_000) : null;

  const messagesToSoftDelete = messagesCutoff
    ? await col
        .messages()
        .countDocuments({ workspaceId: wsId, createdAt: { $lt: messagesCutoff }, deletedAt: { $exists: false } })
    : 0;
  const filesToHardDelete = filesCutoff
    ? await col
        .files()
        .countDocuments({ workspaceId: wsId, deletedAt: { $exists: true, $lt: filesCutoff } })
    : 0;

  return { workspaceId: wsId.toHexString(), name, messagesToSoftDelete, filesToHardDelete, messagesCutoff, filesCutoff };
}

async function apply(plan: Plan) {
  const wsId = new ObjectId(plan.workspaceId);
  if (plan.messagesCutoff && plan.messagesToSoftDelete > 0) {
    await col
      .messages()
      .updateMany(
        { workspaceId: wsId, createdAt: { $lt: plan.messagesCutoff }, deletedAt: { $exists: false } },
        { $set: { deletedAt: new Date() } }
      );
  }
  if (plan.filesCutoff && plan.filesToHardDelete > 0) {
    // Hard-delete soft-deleted files past the cutoff.
    // R2 object removal is deferred to a separate storage reaper (not in PRD scope for v1).
    await col.files().deleteMany({ workspaceId: wsId, deletedAt: { $exists: true, $lt: plan.filesCutoff } });
  }
}

async function main() {
  const apply_ = process.argv.includes("--apply");
  const defaults = {
    msgDays: Number(process.env.DT_DEFAULT_MESSAGE_DAYS ?? 365),
    fileDays: Number(process.env.DT_DEFAULT_FILE_DAYS ?? 0),
  };
  await connectMongo();
  const ws = await col.workspaces().find({ deletedAt: { $exists: false } }).toArray();
  const plans: Plan[] = [];
  for (const w of ws) plans.push(await planFor(w._id, w.name, defaults));

  for (const p of plans) {
    logger.info(p, apply_ ? "applying retention" : "retention plan (dry run)");
    if (apply_) await apply(p);
  }
  logger.info(
    {
      workspaces: plans.length,
      totalMessages: plans.reduce((a, p) => a + p.messagesToSoftDelete, 0),
      totalFiles: plans.reduce((a, p) => a + p.filesToHardDelete, 0),
      mode: apply_ ? "apply" : "dry-run",
    },
    "retention pass complete"
  );
  process.exit(0);
}

main().catch((err) => {
  logger.error(err, "retention worker failed");
  process.exit(1);
});
