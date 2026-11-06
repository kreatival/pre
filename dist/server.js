"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./config/env");
const app_1 = require("./app");
const logger_1 = require("./lib/logger");
const prisma_1 = require("./lib/prisma");
const server = (0, app_1.createApp)().listen(env_1.env.PORT, () => logger_1.logger.info(`API listening on :${env_1.env.PORT}`));
const shutdown = (signal) => {
    logger_1.logger.info(`${signal} received, shutting down`);
    server.close(async () => {
        await prisma_1.prisma.$disconnect();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => logger_1.logger.error({ err }, "unhandledRejection"));
