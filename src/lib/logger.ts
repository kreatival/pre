import pino from "pino";
import { env } from "../config/env";
export const logger = pino({
  level: env.isProd ? "info" : "debug",
  redact: ["req.headers.cookie", "req.headers.authorization"],
});
