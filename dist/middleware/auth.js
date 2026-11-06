"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../lib/errors");
exports.authenticate = (0, errors_1.asyncHandler)(async (req, _res, next) => {
    const header = req.headers.authorization;
    const token = req.cookies?.token ?? (header?.startsWith("Bearer ") ? header.slice(7) : undefined);
    if (!token)
        throw new errors_1.HttpError(401, "Not authenticated");
    let sub;
    try {
        sub = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET).sub;
    }
    catch {
        throw new errors_1.HttpError(401, "Session expired, please sign in again");
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: sub },
        select: { id: true, email: true, name: true, role: true, active: true },
    });
    if (!user || !user.active)
        throw new errors_1.HttpError(401, "Account disabled or not found");
    req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    next();
});
const requireRole = (...roles) => (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return next(new errors_1.HttpError(403, "You do not have permission to do this"));
    }
    next();
};
exports.requireRole = requireRole;
