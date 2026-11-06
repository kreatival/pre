import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

export const prisma = new PrismaClient();

async function ensureTenant(name: string, slug: string) {
  return prisma.tenant.upsert({
    where: { slug },
    update: { name },
    create: { name, slug },
  });
}

async function ensureRoleUser(email: string, password: string, name: string, role: Role, tenantId: string) {
  const normalizedEmail = email.toLowerCase();
  const hash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name,
        role,
        active: true,
        tenantId,
        passwordHash: hash,
      },
    });
    console.log(`Updated ${role} account ${normalizedEmail}`);
    return;
  }

  await prisma.user.create({
    data: { email: normalizedEmail, name, role, tenantId, passwordHash: hash },
  });
  console.log(`Created ${role} account ${normalizedEmail}`);
}

export async function seedDefaultData() {
  const tenant = await ensureTenant("Ruka Aluminium", "rukajalumin");
  const superAdminEmail = (process.env.SUPERADMIN_EMAIL ?? "superadmin@rukajalumin.al").toLowerCase();
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD ?? "SuperAdmin2026!";
  const legacyEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const legacyPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  await ensureRoleUser(superAdminEmail, superAdminPassword, "Super Administrator", Role.SUPERADMIN, tenant.id);
  await ensureRoleUser(legacyEmail, legacyPassword, "Workshop Administrator", Role.WORKSHOP_ADMIN, tenant.id);

  console.log("Database seed complete");
}

async function main() {
  await seedDefaultData();
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
