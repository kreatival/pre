import { ItemType, QuotationStatus } from "@prisma/client";
import { z } from "zod";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optStr = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Expected date as YYYY-MM-DD");

export const itemSchema = z.object({
  title: z.string().trim().min(1, "Item title is required").max(120),
  type: z.nativeEnum(ItemType),
  series: optStr(60),
  widthMm: z.number().int().min(100).max(10000),
  heightMm: z.number().int().min(100).max(10000),
  quantity: z.number().int().min(1).max(1000),
  unitPrice: z.number().min(0).max(10_000_000),
  leaves: z.number().int().min(1).max(6).default(1),
  color: optStr(120),
  glass: optStr(200),
  mechanism: optStr(120),
  shutter: z.boolean().default(false),
  motor: z.boolean().default(false),
  mosquitoNet: z.boolean().default(false),
  notes: optStr(500),
});

export const quotationSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  date: dateStr.optional(),
  validUntil: z.preprocess(emptyToNull, dateStr.nullable().optional()),
  status: z.nativeEnum(QuotationStatus).optional(),
  currency: z.string().trim().length(3).toUpperCase().default("EUR"),
  discountPct: z.number().min(0).max(100).default(0),
  vatPct: z.number().min(0).max(100).default(0),
  notes: optStr(4000),
  items: z.array(itemSchema).min(1, "Add at least one item").max(200),
});

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  q: z.string().trim().max(100).optional(),
  status: z.nativeEnum(QuotationStatus).optional(),
  clientId: z.string().optional(),
});

export type QuotationInput = z.infer<typeof quotationSchema>;
