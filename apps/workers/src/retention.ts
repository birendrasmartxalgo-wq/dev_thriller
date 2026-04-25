// Retention reaper.
//
// Walks every workspace and:
//  1. Soft-deletes messages older than `retention.messagesDays`.
//  2. Hard-deletes already-soft-deleted files past `retention.filesDays`.
//  3. Tail-prunes activityLog entries older than `retention.auditDays`.
//
// Prints a dry-run plan by default; pass --apply to actually write. Safe to rerun.
//
// Usage:
//   bun run apps/workers/src/retention.ts            # dry run
//   bun run apps/workers/src/retention.ts --apply    # execute
//
// Config lookup order per workspace (all optional):
//   workspaces.retention.messagesDays  (number; 0 = forever)
//   workspaces.retention.filesDays     (number; 0 = forever)
//   workspaces.retention.auditDays     (number; 0 = forever)
//   env DT_DEFAULT_MESSAGE_DAYS / DT_DEFAULT_FILE_DAYS / DT_DEFAULT_AUDIT_DAYS
//     (fallbacks; defaults 365 / 0 / 0)
//
// === Audit hash chain — TAIL PRUNE strategy ===
// activityLog is a per-workspace, append-only, hash-chained log. Each entry's
// `prevHash` references the hash of the previous entry's payload. Pruning any
// entry from the MIDDLE breaks the chain — verifiers would see prevHash
// referencing a hash they can no longer recompute.
//
// We only ever delete the OLDEST contiguous tail (entries strictly older than
// the cutoff). The earliest retained entry's `prevHash` becomes a "soft genesis":
// we can no longer recompute it from data, but everything from the retain-cutoff
// forward is still self-consistent and tamper-evident.
//
// audit-verify.ts treats the earliest existing entry as the chain start (its
// prevHash is taken on faith) and walks forward from there. Any tampering of
// retained entries — including swapping in a forged "earliest" entry that
// breaks downstream chaining — is still detected.

import { ObjectId } from "mongodb";
import { connectMongo, col } from "@be/db/mongo";
import { logger } from "@be/lib/logger";

interface Plan {
  workspaceId: string;
  name: string;
  messagesToSoftDelete: number;
  filesToHardDelete: number;
  auditToCut: number;
  auditToKeep: number;
  messagesCutoff: Date | null;
  filesCutoff: Date | null;
  auditCutoff: Date | null;
}

interface RetentionConfig {
  messagesDays?: number;
  filesDays?: number;
  auditDays?: number;
}

async function planFor(
  wsId: ObjectId,
  name: string,
  defaults: { msgDays: number; fileDays: number; auditDays: number }
): Promise<Plan> {
  const ws = await col.workspaces().findOne({ _id: wsId });
  const ret = (ws as unknown as { retention?: RetentionConfig } | null)?.retention;
  const msgDays = ret?.messagesDays ?? defaults.msgDays;
  const fileDays = ret?.filesDays ?? defaults.fileDays;
  const auditDays = ret?.auditDays ?? defaults.auditDays;
  const messagesCutoff = msgDays > 0 ? new Date(Date.now() - msgDays * 86_400_000) : null;
  const filesCutoff = fileDays > 0 ? new Date(Date.now() - fileDays * 86_400_000) : null;
  const auditCutoff = auditDays > 0 ? new Date(Date.now() - auditDays * 86_400_000) : null;

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
  const auditToCut = auditCutoff
    ? await col.activityLog().countDocuments({ workspaceId: wsId, createdAt: { $lt: auditCutoff } })
    : 0;
  const auditToKeep = auditCutoff
    ? await col.activityLog().countDocuments({ workspaceId: wsId, createdAt: { $gte: auditCutoff } })
    : await col.activityLog().countDocuments({ workspaceId: wsId });

  return {
    workspaceId: wsId.toHexString(),
    name,
    messagesToSoftDelete,
    filesToHardDelete,
    auditToCut,
    auditToKeep,
    messagesCutoff,
    filesCutoff,
    auditCutoff,
  };
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
  if (plan.auditCutoff && plan.auditToCut > 0) {
    // TAIL PRUNE only — see file header comment for the chain-safety rationale.
    // Critical: we cut entries strictly older than the cutoff. The earliest
    // retained entry's prevHash becomes a soft genesis — audit-verify.ts knows
    // to treat the earliest existing entry as the chain start.
    await col
      .activityLog()
      .deleteMany({ workspaceId: wsId, createdAt: { $lt: plan.auditCutoff } });
    const cutoffStr = plan.auditCutoff.toISOString().slice(0, 10);
    // eslint-disable-next-line no-console
    console.log(
      `[audit-retention] workspace ${plan.workspaceId}: ${plan.auditToCut} entries cut, ${plan.auditToKeep} kept (cutoff ${cutoffStr})`
    );
  }
}

async function main() {
  const apply_ = process.argv.includes("--apply");
  const defaults = {
    msgDays: Number(process.env.DT_DEFAULT_MESSAGE_DAYS ?? 365),
    fileDays: Number(process.env.DT_DEFAULT_FILE_DAYS ?? 0),
    auditDays: Number(process.env.DT_DEFAULT_AUDIT_DAYS ?? 0),
  };
  await connectMongo();
  const ws = await col.workspaces().find({ deletedAt: { $exists: false } }).toArray();
  const plans: Plan[] = [];
  for (const w of ws) plans.push(await planFor(w._id, w.name, defaults));

  for (const p of plans) {
    logger.info(p, apply_ ? "applying retention" : "retention plan (dry run)");
    if (apply_) await apply(p);
    else if (p.auditCutoff && p.auditToCut > 0) {
      const cutoffStr = p.auditCutoff.toISOString().slice(0, 10);
      // Surface the audit-retention dry-run line in the same format we'd emit on apply.
      // eslint-disable-next-line no-console
      console.log(
        `[audit-retention] workspace ${p.workspaceId}: ${p.auditToCut} entries cut, ${p.auditToKeep} kept (cutoff ${cutoffStr}) [dry-run]`
      );
    }
  }
  logger.info(
    {
      workspaces: plans.length,
      totalMessages: plans.reduce((a, p) => a + p.messagesToSoftDelete, 0),
      totalFiles: plans.reduce((a, p) => a + p.filesToHardDelete, 0),
      totalAuditCut: plans.reduce((a, p) => a + p.auditToCut, 0),
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
