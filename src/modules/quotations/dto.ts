import { ItemType, Prisma, QuotationStatus } from "@prisma/client";
import { computeTotals, round2, Totals, unitAreaM2 } from "./calc";

export const quotationInclude = {
  client: true,
  items: { orderBy: { position: "asc" } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.QuotationInclude;

export type QuotationFull = Prisma.QuotationGetPayload<{ include: typeof quotationInclude }>;

export interface ItemDto {
  id: string;
  position: number;
  title: string;
  type: ItemType;
  series: string | null;
  widthMm: number;
  heightMm: number;
  quantity: number;
  unitPrice: number;
  leaves: number;
  color: string | null;
  glass: string | null;
  mechanism: string | null;
  shutter: boolean;
  motor: boolean;
  mosquitoNet: boolean;
  notes: string | null;
  unitArea: number;
  totalArea: number;
  lineTotal: number;
}

export interface QuotationDto {
  id: string;
  number: number;
  date: string;
  validUntil: string | null;
  status: QuotationStatus;
  currency: string;
  discountPct: number;
  vatPct: number;
  notes: string | null;
  client: { id: string; name: string; phone: string | null; email: string | null; address: string | null; city: string | null };
  createdBy: { id: string; name: string } | null;
  items: ItemDto[];
  totals: Totals;
  createdAt: string;
  updatedAt: string;
}

export function toDto(q: QuotationFull): QuotationDto {
  const items: ItemDto[] = q.items.map((i) => {
    const unitPrice = Number(i.unitPrice);
    const unitArea = unitAreaM2(i.widthMm, i.heightMm);
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
      totalArea: round2(unitArea * i.quantity),
      lineTotal: round2(unitPrice * i.quantity),
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
    totals: computeTotals(items, discountPct, vatPct),
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}
