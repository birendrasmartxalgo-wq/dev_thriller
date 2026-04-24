import { ObjectId } from "mongodb";
import { col } from "@/db/mongo";
import { redis, keys, pubsub, topics } from "@/db/dragonfly";
import { Errors } from "./errors";
import type { Permission, ResourceType, Role } from "@/db/types";

// Role permission defaults — simplified from PRD §3.
const rolePermissions: Record<Role, Set<Permission>> = {
  owner: new Set(["view", "comment", "edit", "manage", "delete"]),
  admin: new Set(["view", "comment", "edit", "manage", "delete"]),
  member: new Set(["view", "comment", "edit"]),
  guest: new Set(["view", "comment"]),
};

export async function getMembership(workspaceId: ObjectId, userId: ObjectId) {
  return col.memberships().findOne({ workspaceId, userId, status: "active" });
}

/**
 * Resolve effective permissions for a user on a resource.
 * Order: deny > allow > inherited allow > role default.
 */
export async function can(
  userId: ObjectId,
  resourceType: ResourceType,
  resourceId: ObjectId,
  workspaceId: ObjectId,
  permission: Permission
): Promise<boolean> {
  const cacheKey = keys.aclCache(userId.toHexString(), resourceType, resourceId.toHexString());
  const cached = await redis.get(cacheKey);
  if (cached) {
    const set = new Set<string>(cached.split(","));
    return set.has(permission);
  }

  const membership = await getMembership(workspaceId, userId);
  if (!membership) return false;

  // Gather direct ACL overrides for this principal on this resource (and inherited from workspace/project).
  const acls = await col
    .acls()
    .find({
      resourceType,
      resourceId,
      $or: [
        { principalType: "user", principalId: userId },
        { principalType: "role", principalId: membership.role },
      ],
    })
    .toArray();

  const denied = new Set<Permission>();
  const allowed = new Set<Permission>();
  for (const a of acls) {
    if (a.effect === "deny") denied.add(a.permission);
    else allowed.add(a.permission);
  }
  for (const p of rolePermissions[membership.role]) allowed.add(p);
  for (const d of denied) allowed.delete(d);

  await redis.set(cacheKey, Array.from(allowed).join(","), "EX", 30);
  return allowed.has(permission);
}

export async function requireCan(
  userId: ObjectId,
  resourceType: ResourceType,
  resourceId: ObjectId,
  workspaceId: ObjectId,
  permission: Permission,
  message = "Permission denied"
): Promise<void> {
  const ok = await can(userId, resourceType, resourceId, workspaceId, permission);
  if (!ok) throw Errors.forbidden(message);
}

export async function invalidateAclCache(userId?: ObjectId, resourceId?: ObjectId): Promise<void> {
  await pubsub.publish(topics.aclInvalidate(), JSON.stringify({ userId: userId?.toHexString(), resourceId: resourceId?.toHexString() }));
}

export function subscribeAclInvalidation() {
  const sub = pubsub.duplicate();
  sub.subscribe(topics.aclInvalidate());
  sub.on("message", async (_ch, msg) => {
    try {
      const { userId, resourceId } = JSON.parse(msg);
      // Wildcard-delete by scanning; on Dragonfly SCAN is fast.
      const pattern = `acl:${userId ?? "*"}:*:${resourceId ?? "*"}`;
      const stream = redis.scanStream({ match: pattern, count: 200 });
      stream.on("data", async (ks: string[]) => {
        if (ks.length) await redis.del(...ks);
      });
    } catch {
      // ignore
    }
  });
  return sub;
}

export function assertRoleAtLeast(role: Role, min: Role): void {
  const rank: Record<Role, number> = { guest: 0, member: 1, admin: 2, owner: 3 };
  if (rank[role] < rank[min]) throw Errors.forbidden(`Requires role ${min}+`);
}
