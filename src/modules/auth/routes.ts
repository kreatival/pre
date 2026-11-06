import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { Role } from "@prisma/client";
import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { asyncHandler, HttpError } from "../../lib/errors";
import { isSubscriptionActive } from "../../lib/subscription";
import { authenticate } from "../../middleware/auth";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, try again in a few minutes" },
});

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.cookieSecure,
  path: "/",
};

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);
const MOCKUP_EMAIL = "admin@example.com";
const MOCKUP_PASSWORD = "ChangeMe123!";

authRouter.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = z
      .object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) })
      .parse(req.body);

    if (env.mockupMode) {
      if (email !== MOCKUP_EMAIL || password !== MOCKUP_PASSWORD) {
        throw new HttpError(401, "Wrong email or password");
      }
      const mockUser = { id: "mock-admin", email: MOCKUP_EMAIL, name: "Administrator", role: "SUPERADMIN" as const, tenantId: "mock-tenant" as const };
      const token = jwt.sign({ sub: mockUser.id }, env.JWT_SECRET, { expiresIn: `${env.JWT_EXPIRES_HOURS}h` });
      res.cookie("token", token, { ...cookieOptions, maxAge: env.JWT_EXPIRES_HOURS * 3600 * 1000 });
      res.json(mockUser);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: { select: { subscriptionStatus: true, subscriptionEndsAt: true } } },
    });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok || !user.active) throw new HttpError(401, "Wrong email or password");

    if (user.role !== Role.SUPERADMIN && !isSubscriptionActive(user.tenant?.subscriptionStatus ?? "ACTIVE", user.tenant?.subscriptionEndsAt ?? null)) {
      throw new HttpError(403, "Subscription expired or inactive");
    }

    const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: `${env.JWT_EXPIRES_HOURS}h` });
    res.cookie("token", token, { ...cookieOptions, maxAge: env.JWT_EXPIRES_HOURS * 3600 * 1000 });
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId });
  }),
);

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token", cookieOptions);
  res.status(204).end();
});

authRouter.get("/me", authenticate, (req, res) => {
  res.json(req.user);
});

authRouter.post(
  "/change-password",
  authenticate,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = z
      .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(200) })
      .parse(req.body);

    if (env.mockupMode) {
      if (req.user!.id !== "mock-admin" || currentPassword !== MOCKUP_PASSWORD) {
        throw new HttpError(400, "Current password is incorrect");
      }
      res.status(204).end();
      return;
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new HttpError(400, "Current password is incorrect");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) },
    });
    res.status(204).end();
  }),
);
