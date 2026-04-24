// Thin helper for server-side notification creation.
// Called inline from message writes; also pushes via WS bus for real-time badges.

import { ObjectId } from "mongodb";
import { col } from "@/db/mongo";
import { publishUser } from "@/ws/bus";

export type NotificationKind = "mention" | "reply" | "dm" | "file" | "admin" | "reaction";

export interface NotifyOpts {
  userId: ObjectId;
  workspaceId?: ObjectId;
  kind: NotificationKind;
  payload: Record<string, unknown>;
}

export async function notify(opts: NotifyOpts): Promise<void> {
  const id = new ObjectId();
  const doc = {
    _id: id,
    userId: opts.userId,
    workspaceId: opts.workspaceId,
    kind: opts.kind,
    payload: opts.payload,
    createdAt: new Date(),
  };
  await col.notifications().insertOne(doc);
  await publishUser(opts.userId.toHexString(), {
    type: "notification.created",
    id: id.toHexString(),
    kind: opts.kind,
    payload: opts.payload,
    workspaceId: opts.workspaceId?.toHexString(),
    createdAt: doc.createdAt,
  });
}
