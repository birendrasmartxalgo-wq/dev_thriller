import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().default(3001),
  LOG_LEVEL: z.string().default("info"),

  MONGO_URI: z.string().min(1),
  MONGO_DB: z.string().default("devthriller"),

  REDIS_URL: z.string().default("redis://localhost:6379"),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL_MIN: z.coerce.number().int().default(15),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().default(30),

  R2_ACCOUNT_ID: z.string().default(""),
  R2_ACCESS_KEY_ID: z.string().default(""),
  R2_SECRET_ACCESS_KEY: z.string().default(""),
  R2_BUCKET: z.string().default("dev-thriller"),
  R2_PUBLIC_URL: z.string().default(""),

  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),

  EMAIL_FROM: z.string().default("Dev Thriller <no-reply@devthriller.app>"),
  RESEND_API_KEY: z.string().default(""),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProd = env.NODE_ENV === "production";
export const r2Configured = Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);
