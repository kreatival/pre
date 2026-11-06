import { Prisma, QuotationStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../lib/errors";
import { computeTotals } from "./calc";
import { quotationInclude, toDto } from "./dto";
import { QuotationInput } from "./schemas";

const toItemCreate = (items: QuotationInput["items"]): Prisma.QuotationItemCreateWithoutQuotationInput[] =>
  items.map((it, idx) => ({ ...it, position: idx + 1 }));

export async function listQuotations(opts: {
  page: number;
  pageSize: number;
  q?: string;
  status?: QuotationStatus;
  clientId?: string;
}, tenantId: string) {
  const { page, pageSize, q, status, clientId } = opts;
  const num = q && /^\d+$/.test(q) && q.length < 10 ? Number(q) : undefined;
  const where: Prisma.QuotationWhereInput = {
    tenantId,
    ...(status ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(q
      ? {
          OR: [
            { client: { name: { contains: q, mode: "insensitive" } } },
            ...(num !== undefined ? [{ number: num }] : []),
          ],
        }
      : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.quotation.findMany({
      where,
      orderBy: { number: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        client: { select: { id: true, name: true } },
        items: { select: { widthMm: true, heightMm: true, quantity: true, unitPrice: true } },
      },
    }),
    prisma.quotation.count({ where }),
  ]);
  const data = rows.map((r) => {
    const t = computeTotals(
      r.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
      Number(r.discountPct),
      Number(r.vatPct),
    );
    return {
      id: r.id,
      number: r.number,
      date: r.date.toISOString(),
      status: r.status,
      currency: r.currency,
      client: r.client,
      itemsCount: r.items.length,
      total: t.total,
    };
  });
  return { data, total, page, pageSize };
}

export async function getQuotation(id: string, tenantId: string) {
  const q = await prisma.quotation.findFirst({ where: { id, tenantId }, include: quotationInclude });
  if (!q) throw new HttpError(404, "Quotation not found");
  return toDto(q);
}

export async function createQuotation(input: QuotationInput, userId: string, tenantId: string) {
  const { items, date, validUntil, ...rest } = input;
  const q = await prisma.quotation.create({
    data: {
      ...rest,
      tenantId,
      date: date ? new Date(date) : undefined,
      validUntil: validUntil ? new Date(validUntil) : null,
      createdById: userId,
      items: { create: toItemCreate(items) },
    },
    include: quotationInclude,
  });
  return toDto(q);
}

export async function updateQuotation(id: string, input: QuotationInput, tenantId: string) {
  const { items, date, validUntil, ...rest } = input;
  const q = await prisma.$transaction(async (tx) => {
    await tx.quotationItem.deleteMany({ where: { quotationId: id } });
    return tx.quotation.update({
      where: { id, tenantId },
      data: {
        ...rest,
        date: date ? new Date(date) : undefined,
        validUntil: validUntil ? new Date(validUntil) : null,
        items: { create: toItemCreate(items) },
      },
      include: quotationInclude,
    });
  });
  return toDto(q);
}

export async function setStatus(id: string, status: QuotationStatus, tenantId: string) {
  const q = await prisma.quotation.update({ where: { id, tenantId }, data: { status }, include: quotationInclude });
  return toDto(q);
}

export async function duplicateQuotation(id: string, userId: string, tenantId: string) {
  const src = await prisma.quotation.findFirst({ where: { id, tenantId }, include: { items: true } });
  if (!src) throw new HttpError(404, "Quotation not found");
  const q = await prisma.quotation.create({
    data: {
      tenantId,
      clientId: src.clientId,
      currency: src.currency,
      discountPct: src.discountPct,
      vatPct: src.vatPct,
      notes: src.notes,
      status: "DRAFT",
      createdById: userId,
      items: {
        create: src.items.map(({ id: _id, quotationId: _qid, ...it }) => it),
      },
    },
    include: quotationInclude,
  });
  return toDto(q);
}

export async function deleteQuotation(id: string, tenantId: string) {
  await prisma.quotation.delete({ where: { id, tenantId } });
}

export async function stats(tenantId: string) {
  const rows = await prisma.$queryRaw<{ status: string; count: number; value: number }[]>`
    SELECT q.status::text AS status,
           COUNT(*)::int AS count,
           COALESCE(SUM(COALESCE(t.sub, 0) * (1 - q."discountPct" / 100) * (1 + q."vatPct" / 100)), 0)::float AS value
    FROM "Quotation" q
    LEFT JOIN LATERAL (
      SELECT SUM(i."unitPrice" * i.quantity) AS sub FROM "QuotationItem" i WHERE i."quotationId" = q.id
    ) t ON true
    WHERE q."tenantId" = ${tenantId}
    GROUP BY q.status`;
  const clients = await prisma.client.count({ where: { tenantId } });
  return { byStatus: rows, clients };
}
