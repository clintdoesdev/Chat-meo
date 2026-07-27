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
    },
  });

  await prisma.bot.upsert({
    where: { slug: "website-assistant" },
    update: {},
    create: {
      userId: user.id,
      name: "Website Assistant",
      slug: "website-assistant",
      status: "LIVE",
    },
  });

  await prisma.bot.upsert({
    where: { slug: "support-bot" },
    update: {},
    create: {
      userId: user.id,
      name: "Support Bot",
      slug: "support-bot",
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
