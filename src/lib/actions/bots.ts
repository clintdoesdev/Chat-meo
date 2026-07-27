"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return base || "bot";
}

export async function createBot(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const base = slugify(name);
  let slug = base;
  let suffix = 1;
  while (await prisma.bot.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }

  await prisma.bot.create({
    data: { userId: session.user.id, name, slug },
  });

  revalidatePath("/app");
}

export async function deleteBot(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const botId = String(formData.get("botId") ?? "");
  if (!botId) return;

  await prisma.bot.deleteMany({
    where: { id: botId, userId: session.user.id },
  });

  revalidatePath("/app");
}
