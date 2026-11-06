import { Router } from "express";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../lib/errors";
import { Permission, ROLE_OPTIONS, normalizeRole } from "../../lib/roles";
import { authenticate, requirePermission } from "../../middleware/auth";

export const usersRouter = Router();
usersRouter.use(authenticate);

const select = { id: true, email: true, name: true, role: true, tenantId: true, active: true, createdAt: true } as const;

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(200),
  role: z.nativeEnum(Role).default(Role.USER),
  tenantId: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  role: z.nativeEnum(Role).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).max(200).optional(),
});

usersRouter.get(
  "/roles",
  asyncHandler(async (_req, res) => {
    res.json(ROLE_OPTIONS);
  }),
);

// Any signed-in user may list users (needed for "created by" display); only admins mutate.
usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const where = req.user!.role === Role.SUPERADMIN ? {} : { tenantId: req.user!.tenantId };
    res.json(await prisma.user.findMany({ where, select, orderBy: { name: "asc" } }));
  }),
);

usersRouter.post(
  "/",
  requirePermission(Permission.MANAGE_USERS),
  asyncHandler(async (req, res) => {
    const { password, ...data } = createSchema.parse(req.body);
    const tenantId = data.tenantId ?? req.user!.tenantId;
    if (req.user!.role !== Role.SUPERADMIN && tenantId !== req.user!.tenantId) {
      throw new HttpError(403, "You can only create users in your own tenant");
    }
    const duplicate = await prisma.user.findUnique({ where: { email: data.email } });
    if (duplicate) throw new HttpError(409, "A user with this email already exists");
    const user = await prisma.user.create({
      data: { ...data, tenantId, passwordHash: await bcrypt.hash(password, 12) },
      select,
    });
    res.status(201).json(user);
  }),
);

usersRouter.patch(
  "/:id",
  requirePermission(Permission.MANAGE_USERS),
  asyncHandler(async (req, res) => {
    const { password, ...data } = updateSchema.parse(req.body);
    const id = req.params.id;
    const normalizedRole = data.role ? normalizeRole(data.role) : null;
    const currentUser = await prisma.user.findUnique({ where: { id }, select: { tenantId: true, role: true } });
    if (currentUser && currentUser.tenantId !== req.user!.tenantId && req.user!.role !== Role.SUPERADMIN) {
      throw new HttpError(403, "You can only manage users in your tenant");
    }
    if (id === req.user!.id && (data.active === false || (normalizedRole && normalizedRole !== Role.SUPERADMIN))) {
      throw new HttpError(400, "You cannot disable or demote your own account");
    }
    const user = await prisma.user.update({
      where: { id },
      data: { ...data, ...(normalizedRole ? { role: normalizedRole } : {}), ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
      select,
    });
    res.json(user);
  }),
);

usersRouter.delete(
  "/:id",
  requirePermission(Permission.MANAGE_USERS),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, tenantId: true, role: true } });
    if (!target) throw new HttpError(404, "User not found");
    if (target.tenantId !== req.user!.tenantId && req.user!.role !== Role.SUPERADMIN) {
      throw new HttpError(403, "You can only delete users in your tenant");
    }
    if (id === req.user!.id) throw new HttpError(400, "You cannot delete your own account");

    await prisma.user.delete({ where: { id } });
    res.status(204).end();
  }),
);
