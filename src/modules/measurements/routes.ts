import { Router } from "express";
import { asyncHandler } from "../../lib/errors";
import { Permission } from "../../lib/roles";
import { authenticate, requirePermission } from "../../middleware/auth";
import { listQuery, measurementSchema } from "./schemas";
import * as svc from "./service";

export const measurementsRouter = Router();
measurementsRouter.use(authenticate);

measurementsRouter.get("/", asyncHandler(async (req, res) => res.json(await svc.listMeasurements(listQuery.parse(req.query), req.user!.tenantId))));

measurementsRouter.post(
  "/",
  asyncHandler(async (req, res) => res.status(201).json(await svc.createMeasurement(measurementSchema.parse(req.body), req.user!.id, req.user!.tenantId))),
);

measurementsRouter.get("/:id", asyncHandler(async (req, res) => res.json(await svc.getMeasurement(req.params.id, req.user!.tenantId))));

measurementsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => res.json(await svc.updateMeasurement(req.params.id, measurementSchema.parse(req.body), req.user!.tenantId))),
);

measurementsRouter.post(
  "/:id/convert",
  asyncHandler(async (req, res) => res.status(201).json(await svc.convertToQuotation(req.params.id, req.user!.id, req.user!.tenantId))),
);

measurementsRouter.delete(
  "/:id",
  requirePermission(Permission.MANAGE_MEASUREMENTS),
  asyncHandler(async (req, res) => {
    await svc.deleteMeasurement(req.params.id, req.user!.tenantId);
    res.status(204).end();
  }),
);
