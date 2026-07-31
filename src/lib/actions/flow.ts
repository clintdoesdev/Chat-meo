"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { FlowGraphSchema } from "@/lib/flow-schema";
import { prisma } from "@/lib/prisma";

export async function saveFlow(botId: string, flowId: string, graph: unknown) {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  const parsed = FlowGraphSchema.safeParse(graph);
  if (!parsed.success) return { error: "Invalid flow data." };

  const flow = await prisma.flow.findUnique({
    where: { id: flowId },
    select: { botId: true, bot: { select: { userId: true, slug: true } } },
  });

  if (!flow || flow.botId !== botId || flow.bot.userId !== session.user.id) {
    return { error: "Flow not found." };
  }

  await prisma.flow.update({
    where: { id: flowId },
    data: { graph: parsed.data as object },
  });

  revalidatePath(`/app/studio/${flow.bot.slug}`);
  return { error: null };
}

export async function publishFlow(botId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: { userId: true, slug: true },
  });
  if (!bot || bot.userId !== session.user.id) {
    return { error: "Bot not found." };
  }

  await prisma.$transaction([
    prisma.bot.update({ where: { id: botId }, data: { status: "LIVE" } }),
    prisma.flow.updateMany({ where: { botId }, data: { isActive: true } }),
  ]);

  revalidatePath("/app");
  revalidatePath(`/app/studio/${bot.slug}`);
  return { error: null };
}
