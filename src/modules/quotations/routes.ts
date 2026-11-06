import { Router } from "express";
import { QuotationStatus } from "@prisma/client";
import { z } from "zod";
import { env } from "../../config/env";
import { asyncHandler } from "../../lib/errors";
import { Permission } from "../../lib/roles";
import { authenticate, requirePermission } from "../../middleware/auth";
import { renderQuotationPdf } from "../../pdf/quotationPdf";
import { computeTotals } from "./calc";
import { listQuery, quotationSchema } from "./schemas";
import * as svc from "./service";

export const quotationsRouter = Router();
quotationsRouter.use(authenticate);

type MockQuotation = {
  id: string;
  number: number;
  date: string;
  validUntil: string | null;
  status: QuotationStatus;
  currency: string;
  discountPct: number;
  vatPct: number;
  notes: string;
  client: { id: string; name: string; phone: string | null; email: string | null; address: string | null; city: string | null };
  createdBy: { id: string; name: string };
  items: Array<{
    id: string;
    position: number;
    title: string;
    type: "FIXED" | "TILT_TURN" | "SLIDING" | "DOOR" | "PANEL_DOOR";
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
  }>;
  createdAt: string;
  updatedAt: string;
};

const mockQuotations: MockQuotation[] = [
  {
    id: "mock-quotation-381",
    number: 381,
    date: "2026-11-01",
    validUntil: "2026-11-15",
    status: "DRAFT",
    currency: "EUR",
    discountPct: 5,
    vatPct: 20,
    notes: "Sample aluminium quotation for showroom glazing and entrance doors.",
    client: { id: "mock-client-1", name: "Alumil Sarajevo", phone: "+387 33 222 333", email: "info@alumilsarajevo.ba", address: "Trg Oslobođenja 12", city: "Sarajevo" },
    createdBy: { id: "mock-admin", name: "Administrator" },
    items: [
      {
        id: "mock-item-1",
        position: 1,
        title: "Entrance door",
        type: "TILT_TURN",
        series: "M11000",
        widthMm: 2200,
        heightMm: 2600,
        quantity: 1,
        unitPrice: 1850,
        leaves: 2,
        color: "Anthracite",
        glass: "Low-E 4/16/4",
        mechanism: "Multi-point",
        shutter: false,
        motor: false,
        mosquitoNet: true,
        notes: "Double glazing with thermal break.",
      },
      {
        id: "mock-item-2",
        position: 2,
        title: "Sliding window",
        type: "SLIDING",
        series: "S560",
        widthMm: 1800,
        heightMm: 1500,
        quantity: 3,
        unitPrice: 920,
        leaves: 2,
        color: "White",
        glass: "Double clear",
        mechanism: "Roller system",
        shutter: true,
        motor: false,
        mosquitoNet: false,
        notes: "Three units for the office wing.",
      },
    ],
    createdAt: "2026-11-01T09:15:00.000Z",
    updatedAt: "2026-11-01T09:15:00.000Z",
  },
  {
    id: "mock-quotation-382",
    number: 382,
    date: "2026-11-03",
    validUntil: "2026-11-24",
    status: "SENT",
    currency: "EUR",
    discountPct: 0,
    vatPct: 20,
    notes: "Commercial project for office partitioning.",
    client: { id: "mock-client-2", name: "Mira Construction", phone: "+387 61 555 777", email: "office@mirabuild.ba", address: "Kovačići 45", city: "Mostar" },
    createdBy: { id: "mock-admin", name: "Administrator" },
    items: [
      {
        id: "mock-item-3",
        position: 1,
        title: "Facade panel",
        type: "FIXED",
        series: "M11000",
        widthMm: 1400,
        heightMm: 2100,
        quantity: 5,
        unitPrice: 780,
        leaves: 1,
        color: "Cream",
        glass: "Argon",
        mechanism: "Fixed glazing",
        shutter: false,
        motor: false,
        mosquitoNet: false,
        notes: "Panels for front elevation.",
      },
    ],
    createdAt: "2026-11-03T13:00:00.000Z",
    updatedAt: "2026-11-03T13:00:00.000Z",
  },
];

const normalizePhoneForWhatsapp = (value: string | null | undefined) => {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("00") ? digits.slice(2) : digits;
};

const buildSharePayload = (q: any, req: any) => {
  const pdfUrl = `${req.protocol}://${req.get("host")}/api/quotations/${q.id}/pdf`;
  const clientName = q.client?.name ?? "Client";
  const subject = encodeURIComponent(`Quotation #${q.number}`);
  const message = encodeURIComponent(`Hello ${clientName},\n\nPlease find the quotation #${q.number} here: ${pdfUrl}\n\nBest regards.`);

  const whatsapp = normalizePhoneForWhatsapp(q.client?.phone);
  const email = q.client?.email ?? null;

  return {
    id: q.id,
    number: q.number,
    pdfUrl,
    whatsappUrl: whatsapp ? `https://wa.me/${whatsapp}?text=${message}` : null,
    emailUrl: email ? `mailto:${email}?subject=${subject}&body=${message}` : null,
    fallbackMessage: `Hello ${clientName}, please find quotation #${q.number} here: ${pdfUrl}`,
    whatsappNumber: whatsapp,
    email,
  };
};

const enrichMockQuotation = (q: MockQuotation) => {
  const items = q.items.map((item) => ({
    ...item,
    series: item.series,
    unitArea: Number(((item.widthMm * item.heightMm) / 1_000_000).toFixed(2)),
    totalArea: Number(((item.widthMm * item.heightMm * item.quantity) / 1_000_000).toFixed(2)),
    lineTotal: Number((item.unitPrice * item.quantity).toFixed(2)),
  }));
  const totals = computeTotals(items.map((item) => ({ widthMm: item.widthMm, heightMm: item.heightMm, quantity: item.quantity, unitPrice: item.unitPrice })), Number(q.discountPct), Number(q.vatPct));
  return { ...q, items, totals, createdAt: q.createdAt, updatedAt: q.updatedAt };
};

const getMockQuotationRows = (status?: QuotationStatus, clientId?: string, q?: string) => {
  const search = (q ?? "").trim().toLowerCase();
  return mockQuotations
    .map((item) => enrichMockQuotation(item))
    .filter((item) => {
      if (status && item.status !== status) return false;
      if (clientId && item.client.id !== clientId) return false;
      if (!search) return true;
      const haystack = `${item.number} ${item.client.name} ${item.client.email ?? ""} ${item.client.city ?? ""}`.toLowerCase();
      return haystack.includes(search);
    })
    .map((item) => ({
      id: item.id,
      number: item.number,
      date: item.date,
      status: item.status,
      currency: item.currency,
      client: { id: item.client.id, name: item.client.name },
      itemsCount: item.items.length,
      total: item.totals.total,
    }));
};

quotationsRouter.get("/", asyncHandler(async (req, res) => {
  const parsed = listQuery.parse(req.query);
  if (env.mockupMode) {
    const rows = getMockQuotationRows(parsed.status, parsed.clientId, parsed.q);
    const start = (parsed.page - 1) * parsed.pageSize;
    const data = rows.slice(start, start + parsed.pageSize);
    res.json({ data, total: rows.length, page: parsed.page, pageSize: parsed.pageSize });
    return;
  }
  res.json(await svc.listQuotations(parsed, req.user!.tenantId));
}));

quotationsRouter.get("/stats", asyncHandler(async (req, res) => {
  if (env.mockupMode) {
    const byStatus = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"].map((status) => {
      const rows = getMockQuotationRows(QuotationStatus[status as keyof typeof QuotationStatus] as QuotationStatus);
      const value = rows.reduce((sum, row) => sum + row.total, 0);
      return { status, count: rows.length, value };
    });
    res.json({ byStatus, clients: 3 });
    return;
  }
  res.json(await svc.stats(req.user!.tenantId));
}));

quotationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const q = await svc.createQuotation(quotationSchema.parse(req.body), req.user!.id, req.user!.tenantId);
    res.status(201).json(q);
  }),
);

quotationsRouter.get("/:id", asyncHandler(async (req, res) => {
  if (env.mockupMode) {
    const q = getMockQuotationRows().find((item) => item.id === req.params.id);
    const full = mockQuotations
      .map((item) => enrichMockQuotation(item))
      .find((item) => item.id === req.params.id);
    if (!full) throw new Error("Quotation not found");
    res.json({
      ...full,
      date: `${full.date}T00:00:00.000Z`,
      validUntil: full.validUntil ? `${full.validUntil}T00:00:00.000Z` : null,
      createdAt: full.createdAt,
      updatedAt: full.updatedAt,
      totals: full.totals,
      items: full.items,
    });
    return;
  }
  res.json(await svc.getQuotation(req.params.id, req.user!.tenantId));
}));

quotationsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => res.json(await svc.updateQuotation(req.params.id, quotationSchema.parse(req.body), req.user!.tenantId))),
);

quotationsRouter.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.nativeEnum(QuotationStatus) }).parse(req.body);
    if (env.mockupMode) {
      const found = mockQuotations.find((item) => item.id === req.params.id);
      if (!found) throw new Error("Quotation not found");
      found.status = status;
      found.updatedAt = new Date().toISOString();
      res.json(enrichMockQuotation(found));
      return;
    }
    res.json(await svc.setStatus(req.params.id, status, req.user!.tenantId));
  }),
);

quotationsRouter.post(
  "/:id/duplicate",
  asyncHandler(async (req, res) => {
    if (env.mockupMode) {
      const src = mockQuotations.find((item) => item.id === req.params.id);
      if (!src) throw new Error("Quotation not found");
      const duplicate: MockQuotation = {
        ...src,
        id: `mock-quotation-${Date.now()}`,
        number: Math.max(...mockQuotations.map((item) => item.number)) + 1,
        status: "DRAFT",
        date: new Date().toISOString().slice(0, 10),
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockQuotations.unshift(duplicate);
      res.status(201).json({ id: duplicate.id });
      return;
    }
    res.status(201).json(await svc.duplicateQuotation(req.params.id, req.user!.id, req.user!.tenantId));
  }),
);

quotationsRouter.get(
  "/:id/share",
  asyncHandler(async (req, res) => {
    const q = env.mockupMode
      ? mockQuotations.map((item) => enrichMockQuotation(item)).find((item) => item.id === req.params.id)
      : await svc.getQuotation(req.params.id, req.user!.tenantId);

    if (!q) throw new Error("Quotation not found");
    res.json(buildSharePayload(q, req));
  }),
);

quotationsRouter.delete(
  "/:id",
  requirePermission(Permission.DELETE_QUOTATIONS),
  asyncHandler(async (req, res) => {
    await svc.deleteQuotation(req.params.id, req.user!.tenantId);
    res.status(204).end();
  }),
);

quotationsRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    if (env.mockupMode) {
      const item = mockQuotations.map((q) => enrichMockQuotation(q)).find((q) => q.id === req.params.id);
      if (!item) throw new Error("Quotation not found");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `${req.query.download === "1" ? "attachment" : "inline"}; filename="Oferta-${item.number}.pdf"`);
      res.setHeader("Cache-Control", "private, no-store");
      renderQuotationPdf(item as any, res);
      return;
    }
    const q = await svc.getQuotation(req.params.id, req.user!.tenantId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${req.query.download === "1" ? "attachment" : "inline"}; filename="Oferta-${q.number}.pdf"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    renderQuotationPdf(q, res);
  }),
);
