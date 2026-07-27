import { PrismaPg } from "@prisma/adapter-pg";
import bcryptjs from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcryptjs.hash("chatmeo-demo", 10);

  const user = await prisma.user.upsert({
    where: { email: "demo@chatmeo.app" },
    update: {},
    create: {
      name: "Clinton A.",
      email: "demo@chatmeo.app",
      passwordHash,
      plan: "GROWTH",
    },
  });

  await prisma.bot.upsert({
    where: { slug: "nova-support" },
    update: {},
    create: {
      userId: user.id,
      name: "Nova Support",
      slug: "nova-support",
      status: "LIVE",
    },
  });

  await prisma.bot.upsert({
    where: { slug: "unimart-helper" },
    update: {},
    create: {
      userId: user.id,
      name: "UniMart Helper",
      slug: "unimart-helper",
      status: "DRAFT",
    },
  });

  console.log(`Seeded user ${user.email} with 2 bots.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
