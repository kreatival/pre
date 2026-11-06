"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.measurementInclude = void 0;
exports.toDto = toDto;
const calc_1 = require("./calc");
exports.measurementInclude = {
    client: { select: { id: true, name: true, phone: true, address: true, city: true } },
    lines: { orderBy: { position: "asc" } },
    quotation: { select: { id: true, number: true } },
    createdBy: { select: { id: true, name: true } },
};
function toDto(m) {
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
            const w = (0, calc_1.measuredWidth)(l);
            const h = (0, calc_1.measuredHeight)(l);
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
