import { env } from "./config/env";
import { createApp } from "./app";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { seedDefaultData } from "./seed";

async function start() {
  if (!env.mockupMode) {
    try {
      await seedDefaultData();
    } catch (err) {
      logger.error({ err }, "Seed bootstrap failed");
    }
  }

  const server = createApp().listen(env.PORT, () => logger.info(`API listening on :${env.PORT}`));

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (err) => logger.error({ err }, "unhandledRejection"));
}

start().catch((err) => {
  logger.error({ err }, "Startup failed");
  process.exit(1);
});
