"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { FlowGraphSchema } from "@/lib/flow-schema";
import { prisma } from "@/lib/prisma";

/** Deliberately does NOT call revalidatePath for the Studio route itself: this fires on every
 * autosave (as often as every ~1.2s while actively editing), and revalidating the currently
 * mounted route from inside a Server Action forces Next.js to refetch and re-push this page's
 * Server Component props into the live-editing canvas — a disruptive, pointless refresh, since
 * the client's nodes/edges state already reflects everything that was just saved. */
export async function saveFlow(
  botId: string,
  flowId: string,
  graph: unknown,
): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  const parsed = FlowGraphSchema.safeParse(graph);
  if (!parsed.success) return { error: "Invalid flow data." };

  try {
    const flow = await prisma.flow.findUnique({
      where: { id: flowId },
      select: { botId: true, bot: { select: { userId: true } } },
    });

    if (!flow || flow.botId !== botId || flow.bot.userId !== session.user.id) {
      return { error: "Flow not found." };
    }

    await prisma.flow.update({
      where: { id: flowId },
      data: { graph: parsed.data as object },
    });

    return { error: null };
  } catch (error) {
    console.error("[actions/flow] saveFlow failed", error);
    return { error: "Couldn't save — a temporary connection issue. Your changes are still local." };
  }
}

export async function updateStudioAutosave(
  botId: string,
  enabled: boolean,
): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  try {
    const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { userId: true } });
    if (!bot || bot.userId !== session.user.id) return { error: "Bot not found." };

    await prisma.bot.update({ where: { id: botId }, data: { studioAutosave: enabled } });
    return { error: null };
  } catch (error) {
    console.error("[actions/flow] updateStudioAutosave failed", error);
    return { error: "Couldn't update the save setting." };
  }
}

export async function publishFlow(botId: string): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  try {
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      select: { userId: true },
    });
    if (!bot || bot.userId !== session.user.id) {
      return { error: "Bot not found." };
    }

    await prisma.$transaction([
      prisma.bot.update({ where: { id: botId }, data: { status: "LIVE" } }),
      prisma.flow.updateMany({ where: { botId }, data: { isActive: true } }),
    ]);

    // The dashboard's bot list (a different, not-currently-mounted route) does need to pick up
    // the new LIVE status — unlike Studio's own route, refreshing it here doesn't interrupt an
    // actively-editing canvas.
    revalidatePath("/app");
    return { error: null };
  } catch (error) {
    console.error("[actions/flow] publishFlow failed", error);
    return { error: "Couldn't publish — please try again." };
  }
}
