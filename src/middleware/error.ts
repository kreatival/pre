import { ErrorRequestHandler, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { HttpError } from "../lib/errors";
import { logger } from "../lib/logger";

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ message: "Route not found" });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    const details = err.issues.slice(0, 10).map((i) => `${i.path.join(".") || "body"}: ${i.message}`);
    return res.status(400).json({ message: "Validation failed", details });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, details: err.details });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return res.status(409).json({ message: "A record with this value already exists" });
    if (err.code === "P2025") return res.status(404).json({ message: "Record not found" });
    if (err.code === "P2003") return res.status(400).json({ message: "Invalid reference" });
  }
  if (err?.type === "entity.parse.failed") return res.status(400).json({ message: "Malformed JSON body" });
  (req.log ?? logger).error({ err }, "Unhandled error");
  return res.status(500).json({ message: "Internal server error" });
};
