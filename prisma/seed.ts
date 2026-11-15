import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, DIRECTORY_VETS } from "./demo-accounts";
import { seedRules } from "./seed-rules";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const account of Object.values(DEMO_ACCOUNTS)) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: { name: account.name, role: account.role, passwordHash },
      create: { email: account.email, name: account.name, role: account.role, passwordHash },
    });
    if ("provider" in account) {
      await prisma.provider.upsert({
        where: { userId: user.id },
        update: { ...account.provider, verified: true },
        create: { ...account.provider, verified: true, userId: user.id },
      });
    }
  }
  console.log(`Seeded ${Object.keys(DEMO_ACCOUNTS).length} demo accounts.`);

  for (const vet of DIRECTORY_VETS) {
    const user = await prisma.user.upsert({
      where: { email: vet.email },
      /* "!" is never a valid bcrypt hash, so these accounts can't log in */
      update: { name: vet.name, role: "VET", passwordHash: "!" },
      create: { email: vet.email, name: vet.name, role: "VET", passwordHash: "!" },
    });
    await prisma.provider.upsert({
      where: { userId: user.id },
      update: { ...vet.provider, verified: true },
      create: { ...vet.provider, verified: true, userId: user.id },
    });
  }
  console.log(`Seeded ${DIRECTORY_VETS.length} directory vets.`);

  const rules = await seedRules(prisma);
  console.log(`Rules: ${rules.created} new rule versions, ${rules.total} rules in the catalog.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
