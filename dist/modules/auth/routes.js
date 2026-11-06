"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const zod_1 = require("zod");
const env_1 = require("../../config/env");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const auth_1 = require("../../middleware/auth");
exports.authRouter = (0, express_1.Router)();
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts, try again in a few minutes" },
});
const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: env_1.env.cookieSecure,
    path: "/",
};
const DUMMY_HASH = bcryptjs_1.default.hashSync("not-a-real-password", 12);
exports.authRouter.post("/login", loginLimiter, (0, errors_1.asyncHandler)(async (req, res) => {
    const { email, password } = zod_1.z
        .object({ email: zod_1.z.string().trim().toLowerCase().email(), password: zod_1.z.string().min(1).max(200) })
        .parse(req.body);
    const user = await prisma_1.prisma.user.findUnique({ where: { email } });
    const ok = await bcryptjs_1.default.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok || !user.active)
        throw new errors_1.HttpError(401, "Wrong email or password");
    const token = jsonwebtoken_1.default.sign({ sub: user.id }, env_1.env.JWT_SECRET, { expiresIn: `${env_1.env.JWT_EXPIRES_HOURS}h` });
    res.cookie("token", token, { ...cookieOptions, maxAge: env_1.env.JWT_EXPIRES_HOURS * 3600 * 1000 });
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
}));
exports.authRouter.post("/logout", (_req, res) => {
    res.clearCookie("token", cookieOptions);
    res.status(204).end();
});
exports.authRouter.get("/me", auth_1.authenticate, (req, res) => {
    res.json(req.user);
});
exports.authRouter.post("/change-password", auth_1.authenticate, (0, errors_1.asyncHandler)(async (req, res) => {
    const { currentPassword, newPassword } = zod_1.z
        .object({ currentPassword: zod_1.z.string().min(1), newPassword: zod_1.z.string().min(8).max(200) })
        .parse(req.body);
    const user = await prisma_1.prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    if (!(await bcryptjs_1.default.compare(currentPassword, user.passwordHash))) {
        throw new errors_1.HttpError(400, "Current password is incorrect");
    }
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcryptjs_1.default.hash(newPassword, 12) },
    });
    res.status(204).end();
}));
