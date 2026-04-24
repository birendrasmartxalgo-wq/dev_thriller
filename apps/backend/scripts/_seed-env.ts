/** Side-effect-only env bootstrap for seed-e2e. Imported first. */
process.env.NODE_ENV = process.env.NODE_ENV ?? "development";
process.env.MONGO_URI = process.env.MONGO_URI ?? "mongodb://localhost:27017";
process.env.MONGO_DB = process.env.MONGO_DB ?? "devthriller_e2e";
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "e2e-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "e2e-refresh-secret-0123456789abcdef";
process.env.R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? "e2e";
process.env.R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? "e2e";
process.env.R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "e2e";
