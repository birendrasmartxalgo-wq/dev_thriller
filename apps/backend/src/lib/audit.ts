import { ObjectId } from "mongodb";
import { col } from "@/db/mongo";
import { sha256Hex } from "./hash";

interface AuditInput {
  workspaceId: ObjectId;
  actorId: ObjectId;
  verb: string;
  objectType: string;
  objectId?: ObjectId;
  metadata?: Record<string, unknown>;
}

// Append-only, hash-chained per workspace.
export async function writeAudit(input: AuditInput): Promise<void> {
  const last = await col
    .activityLog()
    .find({ workspaceId: input.workspaceId })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
  const prevHash = last?.hash ?? "genesis";
  const createdAt = new Date();
  const payload = JSON.stringify({
    workspaceId: input.workspaceId.toHexString(),
    actorId: input.actorId.toHexString(),
    verb: input.verb,
    objectType: input.objectType,
    objectId: input.objectId?.toHexString() ?? null,
    metadata: input.metadata ?? null,
    createdAt: createdAt.toISOString(),
    prevHash,
  });
  const hash = await sha256Hex(payload);
  await col.activityLog().insertOne({
    _id: new ObjectId(),
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    verb: input.verb,
    objectType: input.objectType,
    objectId: input.objectId,
    metadata: input.metadata,
    hash,
    prevHash,
    createdAt,
  });
}
