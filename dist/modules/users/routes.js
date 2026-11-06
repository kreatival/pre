"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const auth_1 = require("../../middleware/auth");
exports.usersRouter = (0, express_1.Router)();
exports.usersRouter.use(auth_1.authenticate);
const select = { id: true, email: true, name: true, role: true, active: true, createdAt: true };
const createSchema = zod_1.z.object({
    email: zod_1.z.string().trim().toLowerCase().email(),
    name: zod_1.z.string().trim().min(1).max(100),
    password: zod_1.z.string().min(8).max(200),
    role: zod_1.z.nativeEnum(client_1.Role).default(client_1.Role.USER),
});
const updateSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(100).optional(),
    role: zod_1.z.nativeEnum(client_1.Role).optional(),
    active: zod_1.z.boolean().optional(),
    password: zod_1.z.string().min(8).max(200).optional(),
});
// Any signed-in user may list users (needed for "created by" display); only admins mutate.
exports.usersRouter.get("/", (0, errors_1.asyncHandler)(async (_req, res) => {
    res.json(await prisma_1.prisma.user.findMany({ select, orderBy: { name: "asc" } }));
}));
exports.usersRouter.post("/", (0, auth_1.requireRole)(client_1.Role.ADMIN), (0, errors_1.asyncHandler)(async (req, res) => {
    const { password, ...data } = createSchema.parse(req.body);
    const user = await prisma_1.prisma.user.create({
        data: { ...data, passwordHash: await bcryptjs_1.default.hash(password, 12) },
        select,
    });
    res.status(201).json(user);
}));
exports.usersRouter.patch("/:id", (0, auth_1.requireRole)(client_1.Role.ADMIN), (0, errors_1.asyncHandler)(async (req, res) => {
    const { password, ...data } = updateSchema.parse(req.body);
    const id = req.params.id;
    if (id === req.user.id && (data.active === false || (data.role && data.role !== client_1.Role.ADMIN))) {
        throw new errors_1.HttpError(400, "You cannot disable or demote your own account");
    }
    const user = await prisma_1.prisma.user.update({
        where: { id },
        data: { ...data, ...(password ? { passwordHash: await bcryptjs_1.default.hash(password, 12) } : {}) },
        select,
    });
    res.json(user);
}));
