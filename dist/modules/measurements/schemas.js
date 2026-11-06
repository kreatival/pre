"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listQuery = exports.measurementSchema = exports.lineSchema = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const blankToNull = (v) => (v === "" || v === undefined ? null : v);
const optStr = (max) => zod_1.z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), zod_1.z.string().trim().max(max).nullable().optional());
const mm = zod_1.z.preprocess(blankToNull, zod_1.z.number().int().min(100).max(10000).nullable());
const dateStr = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Expected date as YYYY-MM-DD");
exports.lineSchema = zod_1.z.object({
    location: optStr(100),
    label: optStr(100),
    type: zod_1.z.nativeEnum(client_1.ItemType),
    quantity: zod_1.z.number().int().min(1).max(1000).default(1),
    widthTopMm: mm, widthMidMm: mm, widthBottomMm: mm,
    heightLeftMm: mm, heightMidMm: mm, heightRightMm: mm,
    diagonal1Mm: mm, diagonal2Mm: mm,
    wallDepthMm: zod_1.z.preprocess(blankToNull, zod_1.z.number().int().min(0).max(2000).nullable()),
    opening: zod_1.z.nativeEnum(client_1.OpeningSide).default(client_1.OpeningSide.NONE),
    series: optStr(60),
    color: optStr(120),
    shutter: zod_1.z.boolean().default(false),
    motor: zod_1.z.boolean().default(false),
    mosquitoNet: zod_1.z.boolean().default(false),
    notes: optStr(500),
});
exports.measurementSchema = zod_1.z.object({
    clientId: zod_1.z.string().min(1, "Client is required"),
    date: dateStr.optional(),
    status: zod_1.z.nativeEnum(client_1.MeasurementStatus).optional(),
    siteAddress: optStr(250),
    clearanceMm: zod_1.z.number().int().min(0).max(100).default(0),
    notes: optStr(4000),
    lines: zod_1.z.array(exports.lineSchema).min(1, "Add at least one opening").max(200),
});
exports.listQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(200).default(20),
    q: zod_1.z.string().trim().max(100).optional(),
    status: zod_1.z.nativeEnum(client_1.MeasurementStatus).optional(),
    clientId: zod_1.z.string().optional(),
});
