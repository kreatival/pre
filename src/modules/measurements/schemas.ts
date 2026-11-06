import { ItemType, MeasurementStatus, OpeningSide } from "@prisma/client";
import { z } from "zod";

const blankToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional());
const mm = z.preprocess(blankToNull, z.number().int().min(100).max(10000).nullable());
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Expected date as YYYY-MM-DD");

export const lineSchema = z.object({
  location: optStr(100),
  label: optStr(100),
  type: z.nativeEnum(ItemType),
  quantity: z.number().int().min(1).max(1000).default(1),
  widthTopMm: mm, widthMidMm: mm, widthBottomMm: mm,
  heightLeftMm: mm, heightMidMm: mm, heightRightMm: mm,
  diagonal1Mm: mm, diagonal2Mm: mm,
  wallDepthMm: z.preprocess(blankToNull, z.number().int().min(0).max(2000).nullable()),
  opening: z.nativeEnum(OpeningSide).default(OpeningSide.NONE),
  series: optStr(60),
  color: optStr(120),
  shutter: z.boolean().default(false),
  motor: z.boolean().default(false),
  mosquitoNet: z.boolean().default(false),
  notes: optStr(500),
});

export const measurementSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  date: dateStr.optional(),
  status: z.nativeEnum(MeasurementStatus).optional(),
  siteAddress: optStr(250),
  clearanceMm: z.number().int().min(0).max(100).default(0),
  notes: optStr(4000),
  lines: z.array(lineSchema).min(1, "Add at least one opening").max(200),
});

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  q: z.string().trim().max(100).optional(),
  status: z.nativeEnum(MeasurementStatus).optional(),
  clientId: z.string().optional(),
});

export type MeasurementInput = z.infer<typeof measurementSchema>;
