"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const pino_http_1 = __importDefault(require("pino-http"));
const env_1 = require("./config/env");
const logger_1 = require("./lib/logger");
const prisma_1 = require("./lib/prisma");
const error_1 = require("./middleware/error");
const routes_1 = require("./modules/auth/routes");
const routes_2 = require("./modules/catalog/routes");
const routes_3 = require("./modules/clients/routes");
const routes_4 = require("./modules/measurements/routes");
const routes_5 = require("./modules/quotations/routes");
const routes_6 = require("./modules/users/routes");
const auth_1 = require("./middleware/auth");
function createApp() {
    const app = (0, express_1.default)();
    app.set("trust proxy", 1);
    app.disable("x-powered-by");
    app.use((0, helmet_1.default)());
    app.use((0, compression_1.default)());
    app.use((0, cors_1.default)({ origin: env_1.env.CORS_ORIGIN.split(",").map((s) => s.trim()), credentials: true }));
    app.use((0, pino_http_1.default)({ logger: logger_1.logger, autoLogging: { ignore: (req) => req.url === "/health" } }));
    app.use(express_1.default.json({ limit: "1mb" }));
    app.use((0, cookie_parser_1.default)());
    app.get("/health", async (_req, res) => {
        try {
            await prisma_1.prisma.$queryRaw `SELECT 1`;
            res.json({ status: "ok" });
        }
        catch {
            res.status(503).json({ status: "db_unavailable" });
        }
    });
    app.use("/api", (0, express_rate_limit_1.default)({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));
    app.use("/api/auth", routes_1.authRouter);
    app.use("/api/users", routes_6.usersRouter);
    app.use("/api/clients", routes_3.clientsRouter);
    app.use("/api/quotations", routes_5.quotationsRouter);
    app.use("/api/measurements", routes_4.measurementsRouter);
    app.use("/api/catalog", auth_1.authenticate, routes_2.catalogRouter);
    app.use(error_1.notFound);
    app.use(error_1.errorHandler);
    return app;
}
