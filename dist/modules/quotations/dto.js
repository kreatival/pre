"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quotationInclude = void 0;
exports.toDto = toDto;
const calc_1 = require("./calc");
exports.quotationInclude = {
    client: true,
    items: { orderBy: { position: "asc" } },
    createdBy: { select: { id: true, name: true } },
};
function toDto(q) {
    const items = q.items.map((i) => {
        const unitPrice = Number(i.unitPrice);
        const unitArea = (0, calc_1.unitAreaM2)(i.widthMm, i.heightMm);
        return {
            id: i.id,
            position: i.position,
            title: i.title,
            type: i.type,
            series: i.series,
            widthMm: i.widthMm,
            heightMm: i.heightMm,
            quantity: i.quantity,
            unitPrice,
            leaves: i.leaves,
            color: i.color,
            glass: i.glass,
            mechanism: i.mechanism,
            shutter: i.shutter,
            motor: i.motor,
            mosquitoNet: i.mosquitoNet,
            notes: i.notes,
            unitArea,
            totalArea: (0, calc_1.round2)(unitArea * i.quantity),
            lineTotal: (0, calc_1.round2)(unitPrice * i.quantity),
        };
    });
    const discountPct = Number(q.discountPct);
    const vatPct = Number(q.vatPct);
    return {
        id: q.id,
        number: q.number,
        date: q.date.toISOString(),
        validUntil: q.validUntil ? q.validUntil.toISOString() : null,
        status: q.status,
        currency: q.currency,
        discountPct,
        vatPct,
        notes: q.notes,
        client: {
            id: q.client.id,
            name: q.client.name,
            phone: q.client.phone,
            email: q.client.email,
            address: q.client.address,
            city: q.client.city,
        },
        createdBy: q.createdBy,
        items,
        totals: (0, calc_1.computeTotals)(items, discountPct, vatPct),
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
    };
}
