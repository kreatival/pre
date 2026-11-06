"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.notFound = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const errors_1 = require("../lib/errors");
const logger_1 = require("../lib/logger");
const notFound = (_req, res) => {
    res.status(404).json({ message: "Route not found" });
};
exports.notFound = notFound;
const errorHandler = (err, req, res, _next) => {
    if (err instanceof zod_1.ZodError) {
        const details = err.issues.slice(0, 10).map((i) => `${i.path.join(".") || "body"}: ${i.message}`);
        return res.status(400).json({ message: "Validation failed", details });
    }
    if (err instanceof errors_1.HttpError) {
        return res.status(err.status).json({ message: err.message, details: err.details });
    }
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002")
            return res.status(409).json({ message: "A record with this value already exists" });
        if (err.code === "P2025")
            return res.status(404).json({ message: "Record not found" });
        if (err.code === "P2003")
            return res.status(400).json({ message: "Invalid reference" });
    }
    if (err?.type === "entity.parse.failed")
        return res.status(400).json({ message: "Malformed JSON body" });
    (req.log ?? logger_1.logger).error({ err }, "Unhandled error");
    res.status(500).json({ message: "Internal server error" });
};
exports.errorHandler = errorHandler;
