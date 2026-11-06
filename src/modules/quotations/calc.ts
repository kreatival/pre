export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Area of a single unit in m², rounded to 2 decimals (matches the printed quotes). */
export const unitAreaM2 = (widthMm: number, heightMm: number): number =>
  round2((widthMm * heightMm) / 1_000_000);

export interface CalcItem {
  widthMm: number;
  heightMm: number;
  quantity: number;
  unitPrice: number;
}

export interface Totals {
  subtotal: number;
  discount: number;
  net: number;
  vat: number;
  total: number;
  pieces: number;
  area: number;
}

export function computeTotals(items: CalcItem[], discountPct: number, vatPct: number): Totals {
  let subtotalCents = 0;
  let pieces = 0;
  let area = 0;
  for (const it of items) {
    subtotalCents += Math.round(it.unitPrice * it.quantity * 100);
    pieces += it.quantity;
    area += unitAreaM2(it.widthMm, it.heightMm) * it.quantity;
  }
  const subtotal = subtotalCents / 100;
  const discount = round2((subtotal * discountPct) / 100);
  const net = round2(subtotal - discount);
  const vat = round2((net * vatPct) / 100);
  return { subtotal, discount, net, vat, total: round2(net + vat), pieces, area: round2(area) };
}
