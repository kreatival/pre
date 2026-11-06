import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { asyncHandler, HttpError } from "../lib/errors";
import { Permission, ROLE_DEFINITIONS, normalizeRole } from "../lib/roles";

const mockUser = {
  id: "mock-admin",
  email: "admin@example.com",
  name: "Administrator",
  role: Role.SUPERADMIN,
  tenantId: "mock-tenant",
} as const;

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const token: string | undefined =
    req.cookies?.token ?? (header?.startsWith("Bearer ") ? header.slice(7) : undefined);
  if (!token) throw new HttpError(401, "Not authenticated");

  let sub: string;
  try {
    sub = (jwt.verify(token, env.JWT_SECRET) as { sub: string }).sub;
  } catch {
    throw new HttpError(401, "Session expired, please sign in again");
  }

  if (env.mockupMode) {
    if (sub !== mockUser.id) throw new HttpError(401, "Account disabled or not found");
    req.user = { id: mockUser.id, email: mockUser.email, name: mockUser.name, role: mockUser.role, tenantId: mockUser.tenantId };
    next();
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: sub },
    select: { id: true, email: true, name: true, role: true, active: true, tenantId: true },
  });
  if (!user || !user.active) throw new HttpError(401, "Account disabled or not found");
  req.user = { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId };
  next();
});

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.map(normalizeRole).includes(normalizeRole(req.user.role))) {
      return next(new HttpError(403, "You do not have permission to do this"));
    }
    next();
  };

export const requirePermission =
  (...permissions: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Not authenticated"));
    const role = normalizeRole(req.user.role);
    const allowed = ROLE_DEFINITIONS[role]?.permissions ?? [];
    const matches = permissions.every((permission) => allowed.includes(permission));
    if (!matches) {
      return next(new HttpError(403, "You do not have permission to do this"));
    }
    next();
  };
