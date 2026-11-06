import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { errorHandler, notFound } from "./middleware/error";
import { authRouter } from "./modules/auth/routes";
import { catalogRouter } from "./modules/catalog/routes";
import { clientsRouter } from "./modules/clients/routes";
import { measurementsRouter } from "./modules/measurements/routes";
import { quotationsRouter } from "./modules/quotations/routes";
import { tenantsRouter } from "./modules/tenants/routes";
import { usersRouter } from "./modules/users/routes";
import { authenticate } from "./middleware/auth";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(compression());
  app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()), credentials: true }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", async (_req, res) => {
    if (env.mockupMode) {
      res.json({ status: "ok", mode: "mockup" });
      return;
    }
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", mode: "database" });
    } catch {
      res.status(503).json({ status: "db_unavailable" });
    }
  });

  app.use("/api", rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/clients", clientsRouter);
  app.use("/api/quotations", quotationsRouter);
  app.use("/api/measurements", measurementsRouter);
  app.use("/api/tenants", tenantsRouter);
  app.use("/api/catalog", authenticate, catalogRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
