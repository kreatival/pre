"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listQuotations = listQuotations;
exports.getQuotation = getQuotation;
exports.createQuotation = createQuotation;
exports.updateQuotation = updateQuotation;
exports.setStatus = setStatus;
exports.duplicateQuotation = duplicateQuotation;
exports.deleteQuotation = deleteQuotation;
exports.stats = stats;
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const calc_1 = require("./calc");
const dto_1 = require("./dto");
const toItemCreate = (items) => items.map((it, idx) => ({ ...it, position: idx + 1 }));
async function listQuotations(opts) {
    const { page, pageSize, q, status, clientId } = opts;
    const num = q && /^\d+$/.test(q) && q.length < 10 ? Number(q) : undefined;
    const where = {
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
    const [rows, total] = await prisma_1.prisma.$transaction([
        prisma_1.prisma.quotation.findMany({
            where,
            orderBy: { number: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
                client: { select: { id: true, name: true } },
                items: { select: { widthMm: true, heightMm: true, quantity: true, unitPrice: true } },
            },
        }),
        prisma_1.prisma.quotation.count({ where }),
    ]);
    const data = rows.map((r) => {
        const t = (0, calc_1.computeTotals)(r.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })), Number(r.discountPct), Number(r.vatPct));
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
async function getQuotation(id) {
    const q = await prisma_1.prisma.quotation.findUnique({ where: { id }, include: dto_1.quotationInclude });
    if (!q)
        throw new errors_1.HttpError(404, "Quotation not found");
    return (0, dto_1.toDto)(q);
}
async function createQuotation(input, userId) {
    const { items, date, validUntil, ...rest } = input;
    const q = await prisma_1.prisma.quotation.create({
        data: {
            ...rest,
            date: date ? new Date(date) : undefined,
            validUntil: validUntil ? new Date(validUntil) : null,
            createdById: userId,
            items: { create: toItemCreate(items) },
        },
        include: dto_1.quotationInclude,
    });
    return (0, dto_1.toDto)(q);
}
async function updateQuotation(id, input) {
    const { items, date, validUntil, ...rest } = input;
    const q = await prisma_1.prisma.$transaction(async (tx) => {
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });
        return tx.quotation.update({
            where: { id },
            data: {
                ...rest,
                date: date ? new Date(date) : undefined,
                validUntil: validUntil ? new Date(validUntil) : null,
                items: { create: toItemCreate(items) },
            },
            include: dto_1.quotationInclude,
        });
    });
    return (0, dto_1.toDto)(q);
}
async function setStatus(id, status) {
    const q = await prisma_1.prisma.quotation.update({ where: { id }, data: { status }, include: dto_1.quotationInclude });
    return (0, dto_1.toDto)(q);
}
async function duplicateQuotation(id, userId) {
    const src = await prisma_1.prisma.quotation.findUnique({ where: { id }, include: { items: true } });
    if (!src)
        throw new errors_1.HttpError(404, "Quotation not found");
    const q = await prisma_1.prisma.quotation.create({
        data: {
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
        include: dto_1.quotationInclude,
    });
    return (0, dto_1.toDto)(q);
}
async function deleteQuotation(id) {
    await prisma_1.prisma.quotation.delete({ where: { id } });
}
async function stats() {
    const rows = await prisma_1.prisma.$queryRaw `
    SELECT q.status::text AS status,
           COUNT(*)::int AS count,
           COALESCE(SUM(COALESCE(t.sub, 0) * (1 - q."discountPct" / 100) * (1 + q."vatPct" / 100)), 0)::float AS value
    FROM "Quotation" q
    LEFT JOIN LATERAL (
      SELECT SUM(i."unitPrice" * i.quantity) AS sub FROM "QuotationItem" i WHERE i."quotationId" = q.id
    ) t ON true
    GROUP BY q.status`;
    const clients = await prisma_1.prisma.client.count();
    return { byStatus: rows, clients };
}
