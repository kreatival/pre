import { Prisma } from "@prisma/client";
import { measuredHeight, measuredWidth } from "./calc";

export const measurementInclude = {
  client: { select: { id: true, name: true, phone: true, address: true, city: true } },
  lines: { orderBy: { position: "asc" } },
  quotation: { select: { id: true, number: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.MeasurementInclude;

export type MeasurementFull = Prisma.MeasurementGetPayload<{ include: typeof measurementInclude }>;

export function toDto(m: MeasurementFull) {
  return {
    id: m.id,
    number: m.number,
    date: m.date.toISOString(),
    status: m.status,
    siteAddress: m.siteAddress,
    clearanceMm: m.clearanceMm,
    notes: m.notes,
    client: m.client,
    quotation: m.quotation,
    createdBy: m.createdBy,
    lines: m.lines.map((l) => {
      const w = measuredWidth(l);
      const h = measuredHeight(l);
      return {
        ...l,
        measurementId: undefined,
        orderWidthMm: w === null ? null : w - m.clearanceMm,
        orderHeightMm: h === null ? null : h - m.clearanceMm,
      };
    }),
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}
