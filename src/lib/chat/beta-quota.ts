import { BETA_MESSAGE_CAP, startOfCurrentMonth } from "@/lib/beta-limits";
import { prisma } from "@/lib/prisma";

export const BETA_LIMIT_REPLY =
  "This bot has reached its beta message limit for the month. The owner can review usage in their dashboard.";

/** Counts only inbound visitor messages — a capped bot should stop *accepting new turns*, not
 * get penalized for however many replies the flow itself produced per turn. */
export async function monthlyMessageCount(botId: string): Promise<number> {
  return prisma.message.count({
    where: {
      role: "USER",
      conversation: { botId },
      createdAt: { gte: startOfCurrentMonth() },
    },
  });
}

export async function isBotOverMessageCap(botId: string): Promise<boolean> {
  const count = await monthlyMessageCount(botId);
  return count >= BETA_MESSAGE_CAP;
}
