// Audit-chain verifier.
// Walks activityLog per workspace in createdAt order, recomputing sha256 over
// { workspaceId, actorId, verb, objectType, objectId, metadata, createdAt, prevHash }
// and comparing to stored hash + prevHash. Exits 1 if any chain breaks.
//
// Tail-prune awareness: the retention worker (retention.ts) tail-prunes
// activityLog entries older than `retention.auditDays`. After a prune, the
// earliest retained entry's `prevHash` references an entry we no longer have.
// We therefore treat the earliest existing entry as the chain start and
// take its `prevHash` on faith (anchor). Every subsequent entry must still
// chain correctly off the previous retained entry — so any tampering of
// retained data is still detected.
//
// Usage: bun run apps/workers/src/audit-verify.ts [--workspace <id>] [--strict]
//   --strict requires the earliest entry to chain to "genesis" (no pruning).

import { ObjectId } from "mongodb";
import { connectMongo, col } from "@be/db/mongo";
import { sha256Hex } from "@be/lib/hash";
import { logger } from "@be/lib/logger";

interface VerifyResult {
  ok: boolean;
  count: number;
  brokenAt?: string;
  anchorPrevHash?: string;
  anchored: boolean; // true if we accepted a soft-genesis anchor (post tail-prune)
}

async function verifyWorkspace(wsId: ObjectId, strict: boolean): Promise<VerifyResult> {
  const cursor = col.activityLog().find({ workspaceId: wsId }).sort({ createdAt: 1 });
  let prevHash: string | null = null;
  let anchored = false;
  let anchorPrevHash: string | undefined;
  let count = 0;
  while (await cursor.hasNext()) {
    const a = (await cursor.next())!;
    count++;
    if (prevHash === null) {
      // Earliest existing entry. In strict mode it must reference "genesis".
      // Otherwise we accept whatever prevHash it has as the soft-genesis anchor —
      // older entries may have been tail-pruned by retention.ts.
      if (strict && a.prevHash !== "genesis") {
        return { ok: false, count, brokenAt: a._id.toHexString(), anchored: false };
      }
      anchorPrevHash = a.prevHash;
      anchored = a.prevHash !== "genesis";
      prevHash = a.prevHash;
    }
    const payload = JSON.stringify({
      workspaceId: a.workspaceId.toHexString(),
      actorId: a.actorId.toHexString(),
      verb: a.verb,
      objectType: a.objectType,
      objectId: a.objectId?.toHexString() ?? null,
      metadata: a.metadata ?? null,
      createdAt: a.createdAt.toISOString(),
      prevHash,
    });
    const expected = await sha256Hex(payload);
    if (expected !== a.hash || a.prevHash !== prevHash) {
      return { ok: false, count, brokenAt: a._id.toHexString(), anchored, anchorPrevHash };
    }
    prevHash = a.hash;
  }
  return { ok: true, count, anchored, anchorPrevHash };
}

async function main() {
  await connectMongo();
  const wsArg = process.argv.indexOf("--workspace");
  const strict = process.argv.includes("--strict");
  const workspaces = wsArg > -1
    ? [{ _id: new ObjectId(process.argv[wsArg + 1]!), name: "(filtered)" }]
    : await col.workspaces().find({ deletedAt: { $exists: false } }, { projection: { name: 1 } }).toArray();

  let failures = 0;
  for (const w of workspaces) {
    const res = await verifyWorkspace(w._id, strict);
    logger.info({ workspace: w._id.toHexString(), name: w.name, ...res }, res.ok ? "chain OK" : "CHAIN BROKEN");
    if (!res.ok) failures++;
  }

  logger.info({ checked: workspaces.length, failures, strict }, "audit-verify done");
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  logger.error(err, "audit-verify failed");
  process.exit(1);
});
