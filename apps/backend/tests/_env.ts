/**
 * Side-effect-only module that installs test env vars.
 *
 * IMPORTANT: This module must be imported first — before any module that
 * transitively loads `@/config/env` — so that env validation sees safe values.
 * Tests never import this directly; `_setup.ts` imports it on line 1.
 */
process.env.NODE_ENV = "test";
process.env.MONGO_DB = "devthriller_test";
process.env.MONGO_URI ??= "mongodb://localhost:27017";
process.env.REDIS_URL ??= process.env.DRAGONFLY_URL ?? "redis://localhost:6379";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-0123456789abcdef";
process.env.FRONTEND_ORIGIN ??= "http://localhost:5173";
// R2 is mocked. Force test values unconditionally — Bun auto-loads `.env` at
// start, which may set real R2_ACCOUNT_ID but leave ACCESS_KEY_ID blank if the
// user hasn't finished wiring R2. The `r2Configured` check would then evaluate
// false and upload routes would return 500 before the mock could intercept.
process.env.R2_ACCOUNT_ID = "test-account";
process.env.R2_ACCESS_KEY_ID = "test-key";
process.env.R2_SECRET_ACCESS_KEY = "test-secret";
process.env.R2_BUCKET = "dev-thriller-test";
