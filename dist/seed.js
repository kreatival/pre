"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        console.log(`Admin ${email} already exists - skipping seed`);
        return;
    }
    await prisma.user.create({
        data: { email, name: "Administrator", role: client_1.Role.ADMIN, passwordHash: await bcryptjs_1.default.hash(password, 12) },
    });
    console.log(`Created admin ${email} - change the password after first login`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
