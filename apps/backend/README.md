# Dev Thriller — Backend

Bun + Elysia API. MongoDB for primary state, DragonflyDB for ephemerals (rate limits, presence, ACL cache, pub/sub), Cloudflare R2 for blobs, generic SMTP for transactional email.

## Dev workflow

```bash
# from repo root
docker compose up -d                       # mongo + dragonfly
cp apps/backend/.env.example apps/backend/.env
$EDITOR apps/backend/.env                  # fill MONGO_URI, JWT secrets, R2/SMTP if testing those
bun install                                 # workspace install (root-level)
bun run --cwd apps/backend dev              # :3001 with --hot reload
```

Swagger UI: [http://localhost:3001/docs](http://localhost:3001/docs). Liveness `/health`, readiness `/ready` (Mongo + Dragonfly ping).

## Tests

```bash
bun run --cwd apps/backend test             # unit + integration via `bun test`
```

Tests inject test-mode defaults from `src/config/env.ts` (note the `NODE_ENV === "test"` block — JWT secrets and Mongo URI fall back to safe values so `bun test` boots without a full env). R2 + SMTP get mocked at the lib level (see `src/lib/r2.ts` and `src/lib/email.ts`).

## Environment

The schema lives in `src/config/env.ts` (Zod-validated; the process exits on parse failure). Required for any non-test boot:

| Var | Use |
|---|---|
| `MONGO_URI` / `MONGO_DB` | Atlas SRV URI + database name. Local dev can use `mongodb://localhost:27017`. |
| `REDIS_URL` | DragonflyDB (or any Redis-wire endpoint). Defaults to `redis://localhost:6379`. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `openssl rand -hex 64` each. Production refuses to boot if either contains `please_rotate`. |
| `JWT_ACCESS_TTL_MIN` / `JWT_REFRESH_TTL_DAYS` | Token lifetimes. Defaults 15 / 30. |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` / `R2_PUBLIC_URL` | Cloudflare R2 (S3-wire). Required for any upload-touching test in non-test mode. |
| `FRONTEND_ORIGIN` | CORS origin + the base used to mint `/invite/:token` links. Defaults to `http://localhost:5173`. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` / `SMTP_FROM` / `EMAIL_FROM` | Generic SMTP. If `SMTP_HOST` is empty all email is best-effort logged-only. |
| `LOG_LEVEL` | Pino level. Default `info`. |
| `PORT` | HTTP port. Default `3001`. |

Production additionally enforces:

- `JWT_*_SECRET` must not contain `please_rotate`
- `MONGO_URI` must not start with `mongodb://localhost`
- All four `R2_*` (account, key, secret, bucket) must be set

See the bottom of `src/config/env.ts`.

## buildApp / bootstrap

`src/index.ts` exports two functions deliberately:

- **`buildApp()`** — pure factory. Wires routes + middleware on a fresh Elysia instance, no side effects. The `App` type re-exported from this file is what Eden Treaty consumes via `packages/shared`.
- **`bootstrap()`** — connects Mongo, ensures indexes, connects Dragonfly, subscribes to ACL pub-sub, then `buildApp().listen()`. The entrypoint guard (`import.meta.main`) only fires `bootstrap()` when this file is the script being run — importing `App` from the frontend or from a test does **not** open a DB connection.

This split keeps tests fast (they call `buildApp()` against a unit-mocked Mongo) and keeps Eden inference tractable (no `await` in the type).

## Routes

Modules live under `src/modules/<resource>/routes.ts`. Each exports an Elysia subapp plugged into `buildApp()` via `.use(...)`. Conventions:

- Body / params / query are validated with Elysia's `t.Object(...)` — Eden derives the request types from these.
- Auth via `authPlugin` + `requireAuth(auth)`. Workspace-scoped routes call `getMembership(wsId, auth.userId)` and `assertRoleAtLeast(role, "admin")` from `src/lib/acl.ts`.
- Audit-worthy mutations call `writeAudit({...})` from `src/lib/audit.ts` — the chain is hash-linked and verified by the audit-verify worker.
- Rate-limited public routes use `enforceRateLimit(ip, { bucket, limit, windowSec })` from `src/lib/rate-limit.ts` (Dragonfly-backed).

## Where R2 + SMTP plug in

- **R2** — `src/lib/r2.ts`. Uses `@aws-sdk/client-s3` against the Cloudflare R2 endpoint. Multipart upload, signed URL minting (`@aws-sdk/s3-request-presigner`), `putObject` for avatars + thumbnails. The `r2Configured` flag (from `src/config/env.ts`) gates calls in dev so an empty config doesn't throw.
- **SMTP** — `src/lib/email.ts`. Thin nodemailer wrapper with `sendInviteEmail`, `sendPasswordResetEmail`, etc. `smtpConfigured` flag short-circuits to a log-only no-op when SMTP env vars are missing.

## Adding a new module

1. Create `src/modules/<name>/routes.ts`. Export an Elysia instance:

   ```ts
   export const widgetRoutes = new Elysia({ prefix: "/v1/widgets" })
     .use(authPlugin)
     .get("/", async ({ auth }) => { /* ... */ }, { /* schema */ });
   ```

2. Wire it into `buildApp()` in `src/index.ts` — both the import and the `.use(widgetRoutes)` call. The order doesn't matter functionally but match the existing module ordering for diff-friendliness.

3. If the module owns a new Mongo collection, add the typed accessor in `src/db/mongo.ts` (see `col.widgets()` shaped helpers) and the indexes in `src/db/indexes.ts`. Test mode runs `ensureIndexes()` against the test DB on bootstrap.

4. Eden picks the new shape up automatically next time the frontend's `tsc` runs — no manual type generation. Add a typed wrapper in `apps/frontend/src/api/endpoints.ts` so call-sites stay terse.

5. Cover the happy path + one error case in `src/modules/<name>/routes.test.ts`. Tests boot a fresh `buildApp()` per file via `Elysia.handle(req)` — no HTTP, no port collision.

## Scripts

- `seed` / `seed:e2e` — populate the dev / e2e workspace with demo content. The E2E seed creates `alice-e2e@test.local` / `bob-e2e@test.local` and a `general` chat with a couple of messages.
- `atlas:indexes` — apply MongoDB Atlas Search indexes from `src/search/atlas/*.json`. First-boot only.
