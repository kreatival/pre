import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../lib/errors";
import { Permission } from "../../lib/roles";
import { authenticate, requirePermission } from "../../middleware/auth";

export const tenantsRouter = Router();
tenantsRouter.use(authenticate);

const tenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().min(2).max(60).regex(/^[a-z0-9-]+$/).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "TRIAL", "CANCELLED"]).default("ACTIVE"),
  subscriptionStatus: z.enum(["ACTIVE", "PAUSED", "TRIAL", "CANCELLED"]).default("ACTIVE"),
  subscriptionEndsAt: z.string().datetime().nullable().optional(),
});

const buildTenantSummary = (tenant: any) => ({
  id: tenant.id,
  name: tenant.name,
  slug: tenant.slug,
  status: tenant.status,
  subscriptionStatus: tenant.subscriptionStatus,
  subscriptionEndsAt: tenant.subscriptionEndsAt ? tenant.subscriptionEndsAt.toISOString() : null,
  users: tenant._count?.users ?? 0,
  clients: tenant._count?.clients ?? 0,
  quotations: tenant._count?.quotations ?? 0,
  createdAt: tenant.createdAt,
});

const normalizeSlug = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

tenantsRouter.get(
  "/",
  requirePermission(Permission.MANAGE_TENANTS),
  asyncHandler(async (_req, res) => {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true, clients: true, quotations: true } } },
    });
    res.json(tenants.map(buildTenantSummary));
  }),
);

tenantsRouter.get(
  "/subscriptions",
  requirePermission(Permission.MANAGE_SUBSCRIPTIONS),
  asyncHandler(async (_req, res) => {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true, clients: true, quotations: true } } },
    });

    const items = tenants.map((tenant) => {
      const users = tenant._count?.users ?? 0;
      const plan = tenant.subscriptionStatus === "TRIAL" ? "Trial" : users > 15 ? "Enterprise" : users > 5 ? "Pro" : "Starter";
      return {
        id: tenant.id,
        tenant: tenant.name,
        slug: tenant.slug,
        plan,
        status: tenant.subscriptionStatus,
        subscriptionEndsAt: tenant.subscriptionEndsAt ? tenant.subscriptionEndsAt.toISOString() : null,
        users,
        clients: tenant._count?.clients ?? 0,
        quotations: tenant._count?.quotations ?? 0,
        nextBilling: tenant.subscriptionEndsAt ? new Date(tenant.subscriptionEndsAt).toLocaleDateString() : "Monthly",
      };
    });

    res.json(items);
  }),
);

tenantsRouter.post(
  "/",
  requirePermission(Permission.MANAGE_TENANTS),
  asyncHandler(async (req, res) => {
    const data = tenantSchema.parse(req.body);
    const slug = normalizeSlug(data.slug ?? data.name);
    if (!slug) throw new HttpError(400, "A valid tenant slug is required");

    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) throw new HttpError(409, "A tenant with this slug already exists");

    const tenant = await prisma.tenant.create({
      data: {
        name: data.name,
        slug,
        status: data.status,
        subscriptionStatus: data.subscriptionStatus,
        subscriptionEndsAt: data.subscriptionEndsAt ? new Date(data.subscriptionEndsAt) : null,
      },
      include: { _count: { select: { users: true, clients: true, quotations: true } } },
    });

    res.status(201).json(buildTenantSummary(tenant));
  }),
);

tenantsRouter.patch(
  "/:id",
  requirePermission(Permission.MANAGE_TENANTS),
  asyncHandler(async (req, res) => {
    const data = tenantSchema.partial().parse(req.body);

    if (data.slug) {
      const slug = normalizeSlug(data.slug);
      if (!slug) throw new HttpError(400, "A valid tenant slug is required");
      const existing = await prisma.tenant.findUnique({ where: { slug } });
      if (existing && existing.id !== req.params.id) {
        throw new HttpError(409, "A tenant with this slug already exists");
      }
      data.slug = slug;
    }

    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(data.subscriptionEndsAt !== undefined ? { subscriptionEndsAt: data.subscriptionEndsAt ? new Date(data.subscriptionEndsAt) : null } : {}),
      },
      include: { _count: { select: { users: true, clients: true, quotations: true } } },
    });

    res.json(buildTenantSummary(tenant));
  }),
);

tenantsRouter.patch(
  "/:id/status",
  requirePermission(Permission.MANAGE_SUBSCRIPTIONS),
  asyncHandler(async (req, res) => {
    const parsed = z
      .object({
        subscriptionStatus: z.enum(["ACTIVE", "PAUSED", "TRIAL", "CANCELLED"]).optional(),
        subscriptionEndsAt: z.string().datetime().nullable().optional(),
      })
      .parse(req.body);

    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.subscriptionStatus ? { subscriptionStatus: parsed.subscriptionStatus } : {}),
        ...(parsed.subscriptionEndsAt !== undefined ? { subscriptionEndsAt: parsed.subscriptionEndsAt ? new Date(parsed.subscriptionEndsAt) : null } : {}),
      },
      include: { _count: { select: { users: true, clients: true, quotations: true } } },
    });

    res.json(buildTenantSummary(tenant));
  }),
);
