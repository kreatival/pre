"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientsRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const pagination_1 = require("../../lib/pagination");
const auth_1 = require("../../middleware/auth");
exports.clientsRouter = (0, express_1.Router)();
exports.clientsRouter.use(auth_1.authenticate);
const emptyToNull = (v) => (typeof v === "string" && v.trim() === "" ? null : v);
const optStr = (max = 200) => zod_1.z.preprocess(emptyToNull, zod_1.z.string().trim().max(max).nullable().optional());
const clientSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, "Name is required").max(150),
    phone: optStr(50),
    email: zod_1.z.preprocess(emptyToNull, zod_1.z.string().trim().email().max(200).nullable().optional()),
    address: optStr(250),
    city: optStr(100),
    notes: optStr(2000),
});
exports.clientsRouter.get("/", (0, errors_1.asyncHandler)(async (req, res) => {
    const { page, pageSize, q } = pagination_1.pageQuery.parse(req.query);
    const where = q
        ? {
            OR: [
                { name: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { email: { contains: q, mode: "insensitive" } },
                { city: { contains: q, mode: "insensitive" } },
            ],
        }
        : {};
    const [data, total] = await prisma_1.prisma.$transaction([
        prisma_1.prisma.client.findMany({
            where,
            orderBy: { name: "asc" },
            ...(0, pagination_1.paginate)(page, pageSize),
            include: { _count: { select: { quotations: true } } },
        }),
        prisma_1.prisma.client.count({ where }),
    ]);
    res.json({ data, total, page, pageSize });
}));
exports.clientsRouter.post("/", (0, errors_1.asyncHandler)(async (req, res) => {
    const data = clientSchema.parse(req.body);
    const client = await prisma_1.prisma.client.create({ data: { ...data, createdById: req.user.id } });
    res.status(201).json(client);
}));
exports.clientsRouter.get("/:id", (0, errors_1.asyncHandler)(async (req, res) => {
    const client = await prisma_1.prisma.client.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { quotations: true } } },
    });
    if (!client)
        throw new errors_1.HttpError(404, "Client not found");
    res.json(client);
}));
exports.clientsRouter.patch("/:id", (0, errors_1.asyncHandler)(async (req, res) => {
    const data = clientSchema.partial().parse(req.body);
    res.json(await prisma_1.prisma.client.update({ where: { id: req.params.id }, data }));
}));
exports.clientsRouter.delete("/:id", (0, auth_1.requireRole)(client_1.Role.ADMIN), (0, errors_1.asyncHandler)(async (req, res) => {
    const [quotes, surveys] = await Promise.all([
        prisma_1.prisma.quotation.count({ where: { clientId: req.params.id } }),
        prisma_1.prisma.measurement.count({ where: { clientId: req.params.id } }),
    ]);
    if (quotes + surveys > 0) {
        throw new errors_1.HttpError(409, `This client has ${quotes} quotation(s) and ${surveys} measurement(s) and cannot be deleted`);
    }
    await prisma_1.prisma.client.delete({ where: { id: req.params.id } });
    res.status(204).end();
}));
