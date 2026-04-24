// Audit-chain verifier.
// Walks activityLog per workspace in createdAt order, recomputing sha256 over
// { workspaceId, actorId, verb, objectType, objectId, metadata, createdAt, prevHash }
// and comparing to stored hash + prevHash. Exits 1 if any chain breaks.
//
// Usage: bun run apps/workers/src/audit-verify.ts [--workspace <id>]

import { ObjectId } from "mongodb";
import { connectMongo, col } from "@be/db/mongo";
import { sha256Hex } from "@be/lib/hash";
import { logger } from "@be/lib/logger";

async function verifyWorkspace(wsId: ObjectId): Promise<{ ok: boolean; count: number; brokenAt?: string }> {
  const cursor = col.activityLog().find({ workspaceId: wsId }).sort({ createdAt: 1 });
  let prevHash = "genesis";
  let count = 0;
  while (await cursor.hasNext()) {
    const a = (await cursor.next())!;
    count++;
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
      return { ok: false, count, brokenAt: a._id.toHexString() };
    }
    prevHash = a.hash;
  }
  return { ok: true, count };
}

async function main() {
  await connectMongo();
  const wsArg = process.argv.indexOf("--workspace");
  const workspaces = wsArg > -1
    ? [{ _id: new ObjectId(process.argv[wsArg + 1]!), name: "(filtered)" }]
    : await col.workspaces().find({ deletedAt: { $exists: false } }, { projection: { name: 1 } }).toArray();

  let failures = 0;
  for (const w of workspaces) {
    const res = await verifyWorkspace(w._id);
    logger.info({ workspace: w._id.toHexString(), name: w.name, ...res }, res.ok ? "chain OK" : "CHAIN BROKEN");
    if (!res.ok) failures++;
  }

  logger.info({ checked: workspaces.length, failures }, "audit-verify done");
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  logger.error(err, "audit-verify failed");
  process.exit(1);
});
