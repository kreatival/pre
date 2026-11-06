"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMeasurements = listMeasurements;
exports.getMeasurement = getMeasurement;
exports.createMeasurement = createMeasurement;
exports.updateMeasurement = updateMeasurement;
exports.deleteMeasurement = deleteMeasurement;
exports.convertToQuotation = convertToQuotation;
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const dto_1 = require("../quotations/dto");
const calc_1 = require("./calc");
const dto_2 = require("./dto");
const toLines = (lines) => lines.map((l, i) => ({ ...l, position: i + 1 }));
async function listMeasurements(o) {
    const num = o.q && /^\d+$/.test(o.q) && o.q.length < 10 ? Number(o.q) : undefined;
    const where = {
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
    const [rows, total] = await prisma_1.prisma.$transaction([
        prisma_1.prisma.measurement.findMany({
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
        prisma_1.prisma.measurement.count({ where }),
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
async function getMeasurement(id) {
    const m = await prisma_1.prisma.measurement.findUnique({ where: { id }, include: dto_2.measurementInclude });
    if (!m)
        throw new errors_1.HttpError(404, "Measurement not found");
    return (0, dto_2.toDto)(m);
}
async function createMeasurement(input, userId) {
    const { lines, date, ...rest } = input;
    const m = await prisma_1.prisma.measurement.create({
        data: { ...rest, date: date ? new Date(date) : undefined, createdById: userId, lines: { create: toLines(lines) } },
        include: dto_2.measurementInclude,
    });
    return (0, dto_2.toDto)(m);
}
async function updateMeasurement(id, input) {
    const { lines, date, ...rest } = input;
    const m = await prisma_1.prisma.$transaction(async (tx) => {
        await tx.measurementLine.deleteMany({ where: { measurementId: id } });
        return tx.measurement.update({
            where: { id },
            data: { ...rest, date: date ? new Date(date) : undefined, lines: { create: toLines(lines) } },
            include: dto_2.measurementInclude,
        });
    });
    return (0, dto_2.toDto)(m);
}
async function deleteMeasurement(id) {
    await prisma_1.prisma.measurement.delete({ where: { id } });
}
/** Turns the measured openings into a draft quotation (prices left at 0 for the office to fill in). */
async function convertToQuotation(id, userId) {
    const m = await prisma_1.prisma.measurement.findUnique({ where: { id }, include: { lines: { orderBy: { position: "asc" } } } });
    if (!m)
        throw new errors_1.HttpError(404, "Measurement not found");
    if (m.quotationId)
        throw new errors_1.HttpError(409, "This measurement was already converted to a quotation");
    if (m.lines.length === 0)
        throw new errors_1.HttpError(400, "Nothing to convert");
    const items = m.lines.map((l, i) => {
        const w = (0, calc_1.measuredWidth)(l);
        const h = (0, calc_1.measuredHeight)(l);
        const name = l.label || l.location || `Item ${i + 1}`;
        if (w === null || h === null)
            throw new errors_1.HttpError(400, `Opening ${i + 1} (${name}) is missing a width or a height`);
        const ow = w - m.clearanceMm;
        const oh = h - m.clearanceMm;
        if (ow < 100 || oh < 100)
            throw new errors_1.HttpError(400, `Opening ${i + 1} (${name}) is too small after the clearance deduction`);
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
    const q = await prisma_1.prisma.$transaction(async (tx) => {
        const created = await tx.quotation.create({
            data: {
                clientId: m.clientId,
                createdById: userId,
                notes: m.siteAddress ? `Site: ${m.siteAddress}` : null,
                items: { create: items },
            },
            include: dto_1.quotationInclude,
        });
        await tx.measurement.update({ where: { id }, data: { quotationId: created.id, status: "COMPLETED" } });
        return created;
    });
    return (0, dto_1.toDto)(q);
}
