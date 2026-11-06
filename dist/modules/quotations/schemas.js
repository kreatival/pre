"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listQuery = exports.quotationSchema = exports.itemSchema = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const emptyToNull = (v) => (typeof v === "string" && v.trim() === "" ? null : v);
const optStr = (max) => zod_1.z.preprocess(emptyToNull, zod_1.z.string().trim().max(max).nullable().optional());
const dateStr = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Expected date as YYYY-MM-DD");
exports.itemSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1, "Item title is required").max(120),
    type: zod_1.z.nativeEnum(client_1.ItemType),
    series: optStr(60),
    widthMm: zod_1.z.number().int().min(100).max(10000),
    heightMm: zod_1.z.number().int().min(100).max(10000),
    quantity: zod_1.z.number().int().min(1).max(1000),
    unitPrice: zod_1.z.number().min(0).max(10_000_000),
    leaves: zod_1.z.number().int().min(1).max(6).default(1),
    color: optStr(120),
    glass: optStr(200),
    mechanism: optStr(120),
    shutter: zod_1.z.boolean().default(false),
    motor: zod_1.z.boolean().default(false),
    mosquitoNet: zod_1.z.boolean().default(false),
    notes: optStr(500),
});
exports.quotationSchema = zod_1.z.object({
    clientId: zod_1.z.string().min(1, "Client is required"),
    date: dateStr.optional(),
    validUntil: zod_1.z.preprocess(emptyToNull, dateStr.nullable().optional()),
    status: zod_1.z.nativeEnum(client_1.QuotationStatus).optional(),
    currency: zod_1.z.string().trim().length(3).toUpperCase().default("EUR"),
    discountPct: zod_1.z.number().min(0).max(100).default(0),
    vatPct: zod_1.z.number().min(0).max(100).default(0),
    notes: optStr(4000),
    items: zod_1.z.array(exports.itemSchema).min(1, "Add at least one item").max(200),
});
exports.listQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(200).default(20),
    q: zod_1.z.string().trim().max(100).optional(),
    status: zod_1.z.nativeEnum(client_1.QuotationStatus).optional(),
    clientId: zod_1.z.string().optional(),
});
