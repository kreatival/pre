"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginate = exports.pageQuery = void 0;
const zod_1 = require("zod");
exports.pageQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(200).default(20),
    q: zod_1.z.string().trim().max(100).optional(),
});
const paginate = (page, pageSize) => ({
    skip: (page - 1) * pageSize,
    take: pageSize,
});
exports.paginate = paginate;
