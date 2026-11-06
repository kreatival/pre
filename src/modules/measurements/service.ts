import { MeasurementStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../lib/errors";
import { quotationInclude, toDto as quotationToDto } from "../quotations/dto";
import { measuredHeight, measuredWidth } from "./calc";
import { measurementInclude, toDto } from "./dto";
import { MeasurementInput } from "./schemas";

const toLines = (lines: MeasurementInput["lines"]) => lines.map((l, i) => ({ ...l, position: i + 1 }));

export async function listMeasurements(o: { page: number; pageSize: number; q?: string; status?: MeasurementStatus; clientId?: string }, tenantId: string) {
  const num = o.q && /^\d+$/.test(o.q) && o.q.length < 10 ? Number(o.q) : undefined;
  const where: Prisma.MeasurementWhereInput = {
    tenantId,
    ...(o.status ? { status: o.status } : {}),
    ...(o.clientId ? { clientId: o.clientId } : {}),
    ...(o.q
      ? {
          OR: [
            { client: { name: { contains: o.q, mode: "insensitive" } } },
            { siteAddress: { contains: o.q, mode: "insensitive" } },
            ...(num !== undefined ? [{ number: num }] : []),
          ],
        }
      : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.measurement.findMany({
      where,
      orderBy: { number: "desc" },
      skip: (o.page - 1) * o.pageSize,
      take: o.pageSize,
      include: {
        client: { select: { id: true, name: true } },
        quotation: { select: { id: true, number: true } },
        _count: { select: { lines: true } },
      },
    }),
    prisma.measurement.count({ where }),
  ]);
  const data = rows.map((r) => ({
    id: r.id,
    number: r.number,
    date: r.date.toISOString(),
    status: r.status,
    siteAddress: r.siteAddress,
    client: r.client,
    quotation: r.quotation,
    linesCount: r._count.lines,
  }));
  return { data, total, page: o.page, pageSize: o.pageSize };
}

export async function getMeasurement(id: string, tenantId: string) {
  const m = await prisma.measurement.findFirst({ where: { id, tenantId }, include: measurementInclude });
  if (!m) throw new HttpError(404, "Measurement not found");
  return toDto(m);
}

export async function createMeasurement(input: MeasurementInput, userId: string, tenantId: string) {
  const { lines, date, ...rest } = input;
  const m = await prisma.measurement.create({
    data: { ...rest, tenantId, date: date ? new Date(date) : undefined, createdById: userId, lines: { create: toLines(lines) } },
    include: measurementInclude,
  });
  return toDto(m);
}

export async function updateMeasurement(id: string, input: MeasurementInput, tenantId: string) {
  const { lines, date, ...rest } = input;
  const m = await prisma.$transaction(async (tx) => {
    await tx.measurementLine.deleteMany({ where: { measurementId: id } });
    return tx.measurement.update({
      where: { id, tenantId },
      data: { ...rest, date: date ? new Date(date) : undefined, lines: { create: toLines(lines) } },
      include: measurementInclude,
    });
  });
  return toDto(m);
}

export async function deleteMeasurement(id: string, tenantId: string) {
  await prisma.measurement.delete({ where: { id, tenantId } });
}

/** Turns the measured openings into a draft quotation (prices left at 0 for the office to fill in). */
export async function convertToQuotation(id: string, userId: string, tenantId: string) {
  const m = await prisma.measurement.findFirst({ where: { id, tenantId }, include: { lines: { orderBy: { position: "asc" } } } });
  if (!m) throw new HttpError(404, "Measurement not found");
  if (m.quotationId) throw new HttpError(409, "This measurement was already converted to a quotation");
  if (m.lines.length === 0) throw new HttpError(400, "Nothing to convert");

  const items = m.lines.map((l, i) => {
    const w = measuredWidth(l);
    const h = measuredHeight(l);
    const name = l.label || l.location || `Item ${i + 1}`;
    if (w === null || h === null) throw new HttpError(400, `Opening ${i + 1} (${name}) is missing a width or a height`);
    const ow = w - m.clearanceMm;
    const oh = h - m.clearanceMm;
    if (ow < 100 || oh < 100) throw new HttpError(400, `Opening ${i + 1} (${name}) is too small after the clearance deduction`);
    return {
      position: i + 1,
      title: name.slice(0, 120),
      type: l.type,
      series: l.series,
      widthMm: ow,
      heightMm: oh,
      quantity: l.quantity,
      unitPrice: 0,
      leaves: l.type === "SLIDING" ? 2 : 1,
      color: l.color,
      shutter: l.shutter,
      motor: l.motor,
      mosquitoNet: l.mosquitoNet,
      notes: [l.label && l.location ? l.location : null, l.notes].filter(Boolean).join(" - ").slice(0, 500) || null,
    };
  });

  const q = await prisma.$transaction(async (tx) => {
    const created = await tx.quotation.create({
      data: {
        tenantId,
        clientId: m.clientId,
        createdById: userId,
        notes: m.siteAddress ? `Site: ${m.siteAddress}` : null,
        items: { create: items },
      },
      include: quotationInclude,
    });
    await tx.measurement.update({ where: { id }, data: { quotationId: created.id, status: "COMPLETED" } });
    return created;
  });
  return quotationToDto(q);
}
