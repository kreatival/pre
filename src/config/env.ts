import "dotenv/config";
import path from "node:path";
import { z } from "zod";

const pgCaPath = path.resolve(process.cwd(), "src", "config", "ca.pem");
const normalizedPgCaPath = pgCaPath.replace(/\\/g, "/");

const normalizeDatabaseUrl = (value: string) => {
  try {
    const url = new URL(value);
    url.searchParams.set("sslmode", "require");
    if (!url.searchParams.has("sslrootcert")) {
      url.searchParams.set("sslrootcert", normalizedPgCaPath);
    }
    return url.toString();
  } catch {
    return value;
  }
};

const defaultDatabaseUrl = process.env.DATABASE_URL || "postgresql://quote:change_me@db:5432/quote";
const withSsl = normalizeDatabaseUrl(defaultDatabaseUrl);

const defaultMockupMode = "false";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1).default(withSsl),
  MOCKUP_MODE: z.enum(["true", "false"]).default(defaultMockupMode),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters").default("mockup-secret-key-please-change-me"),
  JWT_EXPIRES_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  COMPANY_NAME: z.string().default("My Company"),
  COMPANY_ADDRESS: z.string().default(""),
  COMPANY_PHONE: z.string().default(""),
  COMPANY_EMAIL: z.string().default(""),
  PDF_LANG: z.enum(["sq", "en"]).default("sq"),
});

const parsed = schema.safeParse({
  ...process.env,
  DATABASE_URL: normalizeDatabaseUrl(process.env.DATABASE_URL || withSsl),
});
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === "production",
  mockupMode: parsed.data.MOCKUP_MODE === "true",
  cookieSecure: parsed.data.COOKIE_SECURE
    ? parsed.data.COOKIE_SECURE === "true"
    : parsed.data.NODE_ENV === "production",
};
