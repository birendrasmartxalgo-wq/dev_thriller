import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { env, r2Configured, smtpConfigured } from "@/config/env";
import { logger } from "@/lib/logger";
import { connectMongo, db } from "@/db/mongo";
import { ensureIndexes } from "@/db/indexes";
import { connectDragonfly, redis } from "@/db/dragonfly";
import { errorPlugin } from "@/middleware/errors";
import { applySecurity } from "@/middleware/security";
import { subscribeAclInvalidation } from "@/lib/acl";
import { startPubSub } from "@/ws/bus";

import { authRoutes } from "@/modules/auth/routes";
import { passwordResetRoutes } from "@/modules/auth/passwordReset";
import { userRoutes } from "@/modules/users/routes";
import { workspaceRoutes, inviteRoutes } from "@/modules/workspaces/routes";
import { projectRoutes } from "@/modules/projects/routes";
import { chatRoutes } from "@/modules/chats/routes";
import { messageRoutes } from "@/modules/messages/routes";
import { fileRoutes, shareLinkRoutes } from "@/modules/files/routes";
import { searchRoutes } from "@/modules/search/routes";
import { adminRoutes } from "@/modules/admin/routes";
import { notificationRoutes } from "@/modules/notifications/routes";
import { wsRoutes } from "@/ws/routes";

async function bootstrap() {
  await connectMongo();
  await ensureIndexes();
  await connectDragonfly();
  subscribeAclInvalidation();
  await startPubSub();

  const startedAt = new Date();

  const app = new Elysia()
    .use(
      cors({
        origin: [env.FRONTEND_ORIGIN],
        credentials: true,
      })
    )
    .use(applySecurity)
    .use(
      swagger({
        path: "/docs",
        documentation: {
          info: { title: "Dev Thriller API", version: "0.1.0" },
        },
      })
    )
    .use(errorPlugin)
    .get("/health", () => ({ status: "ok", ts: new Date().toISOString() }))
    .get("/ready", async () => {
      // Deep readiness: Mongo ping + Dragonfly ping. Used by k8s readinessProbe and VPS LB.
      const checks: Record<string, boolean | string> = {};
      try {
        await db().command({ ping: 1 });
        checks.mongo = true;
      } catch (err) {
        checks.mongo = String((err as Error).message);
      }
      try {
        const pong = await redis.ping();
        checks.redis = pong === "PONG";
      } catch (err) {
        checks.redis = String((err as Error).message);
      }
      checks.r2 = r2Configured;
      checks.smtp = smtpConfigured;
      const ready = checks.mongo === true && checks.redis === true;
      return new Response(JSON.stringify({ ready, checks, uptime: Math.round((Date.now() - startedAt.getTime()) / 1000) }), {
        status: ready ? 200 : 503,
        headers: { "content-type": "application/json" },
      });
    })
    .use(authRoutes)
    .use(passwordResetRoutes)
    .use(userRoutes)
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
    .use(wsRoutes)
    .listen(env.PORT);

  logger.info({ port: env.PORT, env: env.NODE_ENV, r2: r2Configured, smtp: smtpConfigured }, "dev-thriller backend up");
  return app;
}

bootstrap().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});

// Re-export the Elysia app type for Eden Treaty. Callers can `import type { App } from '@dt/backend'`.
export type App = Awaited<ReturnType<typeof bootstrap>>;
