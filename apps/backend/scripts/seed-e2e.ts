/**
 * Seed data for Playwright E2E. Idempotent — safe to run repeatedly.
 *
 * Creates:
 *   - two users (primary + secondary)
 *   - one shared workspace
 *   - one chat with a couple of seeded messages
 *
 * Run with:
 *   bun run apps/backend/scripts/seed-e2e.ts
 *
 * Env:
 *   MONGO_URI          (default mongodb://localhost:27017)
 *   MONGO_DB           (default devthriller_e2e)
 *   E2E_PRIMARY_EMAIL  (default alice-e2e@test.local)
 *   E2E_PRIMARY_PW     (default Password1!)
 *   E2E_SECONDARY_EMAIL (default bob-e2e@test.local)
 *   E2E_WORKSPACE_SLUG (default e2e-workspace)
 */
import "./_seed-env";

import { ObjectId } from "mongodb";
import { client, col, connectMongo } from "@/db/mongo";
import { ensureIndexes } from "@/db/indexes";
import { hashPassword } from "@/lib/hash";
import { slugify, caseNumber } from "@/lib/slug";

const PRIMARY_EMAIL = process.env.E2E_PRIMARY_EMAIL ?? "alice-e2e@test.local";
const PRIMARY_PW = process.env.E2E_PRIMARY_PW ?? "Password1!";
const SECONDARY_EMAIL = process.env.E2E_SECONDARY_EMAIL ?? "bob-e2e@test.local";
const SECONDARY_PW = process.env.E2E_SECONDARY_PW ?? "Password1!";
const WS_SLUG = process.env.E2E_WORKSPACE_SLUG ?? "e2e-workspace";

async function upsertUser(email: string, name: string, password: string): Promise<ObjectId> {
  const emailLower = email.toLowerCase().trim();
  const existing = await col.users().findOne({ emailLower });
  if (existing) return existing._id;
  const _id = new ObjectId();
  await col.users().insertOne({
    _id,
    email,
    emailLower,
    name,
    passwordHash: await hashPassword(password),
    createdAt: new Date(),
    lastSeenAt: new Date(),
  });
  return _id;
}

async function upsertWorkspace(ownerId: ObjectId, slug: string, name: string): Promise<ObjectId> {
  const existing = await col.workspaces().findOne({ slug });
  if (existing) return existing._id;
  const _id = new ObjectId();
  await col.workspaces().insertOne({
    _id,
    slug: slugify(slug) || slug,
    name,
    ownerId,
    plan: "free",
    caseNumber: caseNumber(),
    createdAt: new Date(),
  });
  return _id;
}

async function ensureMembership(workspaceId: ObjectId, userId: ObjectId, role: "owner" | "admin" | "member") {
  const existing = await col.memberships().findOne({ workspaceId, userId });
  if (existing) return;
  await col.memberships().insertOne({
    _id: new ObjectId(),
    workspaceId,
    userId,
    role,
    status: "active",
    createdAt: new Date(),
  });
}

async function ensureChat(workspaceId: ObjectId, creatorId: ObjectId, name: string): Promise<ObjectId> {
  const existing = await col.chats().findOne({ workspaceId, name, type: "channel" });
  if (existing) return existing._id;
  const _id = new ObjectId();
  await col.chats().insertOne({
    _id,
    workspaceId,
    type: "channel",
    name,
    createdBy: creatorId,
    createdAt: new Date(),
  });
  return _id;
}

async function ensureMessages(chatId: ObjectId, workspaceId: ObjectId, authorId: ObjectId) {
  const count = await col.messages().countDocuments({ chatId });
  if (count > 0) return;
  const now = Date.now();
  await col.messages().insertMany([
    {
      _id: new ObjectId(),
      chatId,
      workspaceId,
      authorId,
      body: "Welcome to the E2E workspace!",
      createdAt: new Date(now - 60_000),
    },
    {
      _id: new ObjectId(),
      chatId,
      workspaceId,
      authorId,
      body: "Say hi to kick off the smoke test.",
      createdAt: new Date(now - 30_000),
    },
  ]);
}

async function main() {
  await connectMongo();
  await ensureIndexes();

  const aliceId = await upsertUser(PRIMARY_EMAIL, "Alice E2E", PRIMARY_PW);
  const bobId = await upsertUser(SECONDARY_EMAIL, "Bob E2E", SECONDARY_PW);
  const wsId = await upsertWorkspace(aliceId, WS_SLUG, "E2E Workspace");
  await ensureMembership(wsId, aliceId, "owner");
  await ensureMembership(wsId, bobId, "member");
  const chatId = await ensureChat(wsId, aliceId, "general");
  await ensureMessages(chatId, wsId, aliceId);

  console.log(
    JSON.stringify(
      {
        primaryEmail: PRIMARY_EMAIL,
        primaryPassword: PRIMARY_PW,
        secondaryEmail: SECONDARY_EMAIL,
        secondaryPassword: SECONDARY_PW,
        workspaceSlug: WS_SLUG,
        workspaceId: wsId.toHexString(),
        chatId: chatId.toHexString(),
      },
      null,
      2
    )
  );

  await client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("seed-e2e failed:", err);
  process.exit(1);
});
