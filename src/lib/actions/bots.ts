"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isValidHexColor } from "@/lib/color";
import { prisma } from "@/lib/prisma";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return base || "bot";
}

export async function createBot(formData: FormData): Promise<{ error: string | null; slug?: string }> {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: null };

  const primaryColor = String(formData.get("primaryColor") ?? "").trim();
  if (primaryColor && !isValidHexColor(primaryColor)) {
    return { error: "Color must be a hex value like #FF5C16." };
  }

  const welcomeMessage = String(formData.get("welcomeMessage") ?? "").trim();

  const base = slugify(name);
  let slug = base;
  let suffix = 1;
  while (await prisma.bot.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }

  await prisma.bot.create({
    data: {
      userId: session.user.id,
      name,
      slug,
      ...(primaryColor ? { primaryColor } : {}),
      ...(welcomeMessage ? { welcomeMessage } : {}),
    },
  });

  revalidatePath("/app");
  return { error: null, slug };
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
  revalidatePath("/app/studio");
}
