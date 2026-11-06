"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const schema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]).default("development"),
    PORT: zod_1.z.coerce.number().int().default(4000),
    DATABASE_URL: zod_1.z.string().min(1),
    JWT_SECRET: zod_1.z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_EXPIRES_HOURS: zod_1.z.coerce.number().int().min(1).max(720).default(12),
    CORS_ORIGIN: zod_1.z.string().default("http://localhost:3000"),
    COOKIE_SECURE: zod_1.z.enum(["true", "false"]).optional(),
    COMPANY_NAME: zod_1.z.string().default("My Company"),
    COMPANY_ADDRESS: zod_1.z.string().default(""),
    COMPANY_PHONE: zod_1.z.string().default(""),
    COMPANY_EMAIL: zod_1.z.string().default(""),
    PDF_LANG: zod_1.z.enum(["sq", "en"]).default("sq"),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    process.exit(1);
}
exports.env = {
    ...parsed.data,
    isProd: parsed.data.NODE_ENV === "production",
    cookieSecure: parsed.data.COOKIE_SECURE
        ? parsed.data.COOKIE_SECURE === "true"
        : parsed.data.NODE_ENV === "production",
};
