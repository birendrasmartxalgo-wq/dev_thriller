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

  // Generic SMTP — works with Amazon SES, Postmark, Mailgun, Brevo, self-hosted Postfix, etc.
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_FROM: z.string().default("Dev Thriller <no-reply@devthriller.app>"),
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
export const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

// Refuse to boot in production with default / placeholder secrets.
if (isProd) {
  const bad: string[] = [];
  if (env.JWT_ACCESS_SECRET.includes("please_rotate") || env.JWT_REFRESH_SECRET.includes("please_rotate")) bad.push("JWT_*_SECRET");
  if (env.MONGO_URI.startsWith("mongodb://localhost")) bad.push("MONGO_URI");
  if (!r2Configured) bad.push("R2_*");
  if (bad.length) {
    console.error(`refusing to start in production with default / missing secrets: ${bad.join(", ")}`);
    process.exit(1);
  }
}
