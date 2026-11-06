"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unitAreaM2 = exports.round2 = void 0;
exports.computeTotals = computeTotals;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
exports.round2 = round2;
/** Area of a single unit in m², rounded to 2 decimals (matches the printed quotes). */
const unitAreaM2 = (widthMm, heightMm) => (0, exports.round2)((widthMm * heightMm) / 1_000_000);
exports.unitAreaM2 = unitAreaM2;
function computeTotals(items, discountPct, vatPct) {
    let subtotalCents = 0;
    let pieces = 0;
    let area = 0;
    for (const it of items) {
        subtotalCents += Math.round(it.unitPrice * it.quantity * 100);
        pieces += it.quantity;
        area += (0, exports.unitAreaM2)(it.widthMm, it.heightMm) * it.quantity;
    }
    const subtotal = subtotalCents / 100;
    const discount = (0, exports.round2)((subtotal * discountPct) / 100);
    const net = (0, exports.round2)(subtotal - discount);
    const vat = (0, exports.round2)((net * vatPct) / 100);
    return { subtotal, discount, net, vat, total: (0, exports.round2)(net + vat), pieces, area: (0, exports.round2)(area) };
}
