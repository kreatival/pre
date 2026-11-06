"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.quotationsRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const errors_1 = require("../../lib/errors");
const auth_1 = require("../../middleware/auth");
const quotationPdf_1 = require("../../pdf/quotationPdf");
const schemas_1 = require("./schemas");
const svc = __importStar(require("./service"));
exports.quotationsRouter = (0, express_1.Router)();
exports.quotationsRouter.use(auth_1.authenticate);
exports.quotationsRouter.get("/", (0, errors_1.asyncHandler)(async (req, res) => res.json(await svc.listQuotations(schemas_1.listQuery.parse(req.query)))));
exports.quotationsRouter.get("/stats", (0, errors_1.asyncHandler)(async (_req, res) => res.json(await svc.stats())));
exports.quotationsRouter.post("/", (0, errors_1.asyncHandler)(async (req, res) => {
    const q = await svc.createQuotation(schemas_1.quotationSchema.parse(req.body), req.user.id);
    res.status(201).json(q);
}));
exports.quotationsRouter.get("/:id", (0, errors_1.asyncHandler)(async (req, res) => res.json(await svc.getQuotation(req.params.id))));
exports.quotationsRouter.put("/:id", (0, errors_1.asyncHandler)(async (req, res) => res.json(await svc.updateQuotation(req.params.id, schemas_1.quotationSchema.parse(req.body)))));
exports.quotationsRouter.patch("/:id/status", (0, errors_1.asyncHandler)(async (req, res) => {
    const { status } = zod_1.z.object({ status: zod_1.z.nativeEnum(client_1.QuotationStatus) }).parse(req.body);
    res.json(await svc.setStatus(req.params.id, status));
}));
exports.quotationsRouter.post("/:id/duplicate", (0, errors_1.asyncHandler)(async (req, res) => res.status(201).json(await svc.duplicateQuotation(req.params.id, req.user.id))));
exports.quotationsRouter.delete("/:id", (0, auth_1.requireRole)(client_1.Role.ADMIN), (0, errors_1.asyncHandler)(async (req, res) => {
    await svc.deleteQuotation(req.params.id);
    res.status(204).end();
}));
exports.quotationsRouter.get("/:id/pdf", (0, errors_1.asyncHandler)(async (req, res) => {
    const q = await svc.getQuotation(req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download === "1" ? "attachment" : "inline"}; filename="Oferta-${q.number}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    (0, quotationPdf_1.renderQuotationPdf)(q, res);
}));
