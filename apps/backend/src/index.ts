import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { connectMongo } from "@/db/mongo";
import { ensureIndexes } from "@/db/indexes";
import { connectDragonfly, redis } from "@/db/dragonfly";
import { errorPlugin } from "@/middleware/errors";
import { subscribeAclInvalidation } from "@/lib/acl";
import { startPubSub } from "@/ws/bus";

import { authRoutes } from "@/modules/auth/routes";
import { workspaceRoutes, inviteRoutes } from "@/modules/workspaces/routes";
import { projectRoutes } from "@/modules/projects/routes";
import { chatRoutes } from "@/modules/chats/routes";
import { messageRoutes } from "@/modules/messages/routes";
import { fileRoutes, shareLinkRoutes } from "@/modules/files/routes";
import { searchRoutes } from "@/modules/search/routes";
import { adminRoutes } from "@/modules/admin/routes";
import { notificationRoutes } from "@/modules/notifications/routes";
import { wsRoutes } from "@/ws/routes";

// Pure factory — assembles the Elysia app without performing side-effects like
// `.listen()` or opening DB connections. This keeps the shape knowable statically
// so Eden Treaty can infer end-to-end types via `type App = ReturnType<typeof buildApp>`.
export function buildApp() {
  return new Elysia()
    .use(
      cors({
        origin: [env.FRONTEND_ORIGIN],
        credentials: true,
      })
    )
    .use(
      swagger({
        path: "/docs",
        documentation: {
          info: { title: "Dev Thriller API", version: "0.1.0" },
        },
      })
    )
    .use(errorPlugin)
    .get("/health", async () => {
      const pong = await redis.ping();
      return { status: "ok", redis: pong === "PONG", ts: new Date().toISOString() };
    })
    .use(authRoutes)
    .use(workspaceRoutes)
    .use(inviteRoutes)
    .use(projectRoutes)
    .use(chatRoutes)
    .use(messageRoutes)
    .use(fileRoutes)
    .use(shareLinkRoutes)
    .use(searchRoutes)
    .use(adminRoutes)
    .use(notificationRoutes)
    .use(wsRoutes);
}

async function bootstrap() {
  await connectMongo();
  await ensureIndexes();
  await connectDragonfly();
  subscribeAclInvalidation();
  await startPubSub();

  const app = buildApp().listen(env.PORT);

  logger.info({ port: env.PORT, env: env.NODE_ENV }, "dev-thriller backend up");
  return app;
}

// Only bootstrap when this file is the entry point (not when imported for its types
// via Eden Treaty in the frontend).
if (import.meta.main) {
  bootstrap().catch((err) => {
    console.error("Bootstrap failed:", err);
    process.exit(1);
  });
}

// Re-export the Elysia app type for Eden Treaty. Callers import via `@dt/shared`.
export type App = ReturnType<typeof buildApp>;
