import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../lib/errors";
import { paginate, pageQuery } from "../../lib/pagination";
import { Permission } from "../../lib/roles";
import { authenticate, requirePermission } from "../../middleware/auth";

export const clientsRouter = Router();
clientsRouter.use(authenticate);

type MockClient = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  _count: { quotations: number };
};

const mockClients: MockClient[] = [
  {
    id: "mock-client-1",
    name: "Alumil Sarajevo",
    phone: "+387 33 222 333",
    email: "info@alumilsarajevo.ba",
    address: "Trg Oslobođenja 12",
    city: "Sarajevo",
    notes: "Prefers sliding systems.",
    _count: { quotations: 3 },
  },
  {
    id: "mock-client-2",
    name: "Mira Construction",
    phone: "+387 61 555 777",
    email: "office@mirabuild.ba",
    address: "Kovačići 45",
    city: "Mostar",
    notes: null,
    _count: { quotations: 1 },
  },
  {
    id: "mock-client-3",
    name: "Zenit d.o.o.",
    phone: null,
    email: "sales@zenit.ba",
    address: null,
    city: "Banja Luka",
    notes: "Needs premium aluminium finishings.",
    _count: { quotations: 2 },
  },
];

const getMockClientList = (q = "") => {
  const term = q.trim().toLowerCase();
  if (!term) return [...mockClients];
  return mockClients.filter((client) => {
    const haystack = [client.name, client.phone ?? "", client.email ?? "", client.city ?? ""].join(" ").toLowerCase();
    return haystack.includes(term);
  });
};

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optStr = (max = 200) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  phone: optStr(50),
  email: z.preprocess(emptyToNull, z.string().trim().email().max(200).nullable().optional()),
  address: optStr(250),
  city: optStr(100),
  notes: optStr(2000),
});

clientsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, q } = pageQuery.parse(req.query);

    if (env.mockupMode) {
      const filtered = getMockClientList(q ?? "").sort((a, b) => a.name.localeCompare(b.name));
      const start = (page - 1) * pageSize;
      const data = filtered.slice(start, start + pageSize);
      res.json({ data, total: filtered.length, page, pageSize });
      return;
    }

    const where: Prisma.ClientWhereInput = {
      tenantId: req.user!.tenantId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { email: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.client.findMany({
        where,
        orderBy: { name: "asc" },
        ...paginate(page, pageSize),
        include: { _count: { select: { quotations: true } } },
      }),
      prisma.client.count({ where }),
    ]);
    res.json({ data, total, page, pageSize });
  }),
);

clientsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = clientSchema.parse(req.body);

    if (env.mockupMode) {
      const created = {
        id: `mock-client-${Date.now()}`,
        name: data.name,
        phone: data.phone ?? null,
        email: data.email ?? null,
        address: data.address ?? null,
        city: data.city ?? null,
        notes: data.notes ?? null,
        _count: { quotations: 0 },
      };
      mockClients.unshift(created);
      res.status(201).json(created);
      return;
    }

    const client = await prisma.client.create({ data: { ...data, tenantId: req.user!.tenantId, createdById: req.user!.id } });
    res.status(201).json(client);
  }),
);

clientsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (env.mockupMode) {
      const client = mockClients.find((item) => item.id === req.params.id);
      if (!client) throw new HttpError(404, "Client not found");
      res.json(client);
      return;
    }

    const client = await prisma.client.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      include: { _count: { select: { quotations: true } } },
    });
    if (!client) throw new HttpError(404, "Client not found");
    res.json(client);
  }),
);

clientsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = clientSchema.partial().parse(req.body);

    if (env.mockupMode) {
      const index = mockClients.findIndex((item) => item.id === req.params.id);
      if (index === -1) throw new HttpError(404, "Client not found");
      const updated = {
        ...mockClients[index],
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone ?? null } : {}),
        ...(data.email !== undefined ? { email: data.email ?? null } : {}),
        ...(data.address !== undefined ? { address: data.address ?? null } : {}),
        ...(data.city !== undefined ? { city: data.city ?? null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
      };
      mockClients[index] = updated;
      res.json(updated);
      return;
    }

    res.json(await prisma.client.update({ where: { id: req.params.id, tenantId: req.user!.tenantId }, data }));
  }),
);

clientsRouter.delete(
  "/:id",
  requirePermission(Permission.MANAGE_CLIENTS),
  asyncHandler(async (req, res) => {
    if (env.mockupMode) {
      const index = mockClients.findIndex((item) => item.id === req.params.id);
      if (index === -1) throw new HttpError(404, "Client not found");
      mockClients.splice(index, 1);
      res.status(204).end();
      return;
    }

    const [quotes, surveys] = await Promise.all([
      prisma.quotation.count({ where: { clientId: req.params.id, tenantId: req.user!.tenantId } }),
      prisma.measurement.count({ where: { clientId: req.params.id, tenantId: req.user!.tenantId } }),
    ]);
    if (quotes + surveys > 0) {
      throw new HttpError(409, `This client has ${quotes} quotation(s) and ${surveys} measurement(s) and cannot be deleted`);
    }
    await prisma.client.delete({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    res.status(204).end();
  }),
);
