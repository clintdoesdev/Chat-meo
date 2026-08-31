import { startOfCurrentMonth } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";
import {
  bucketByDay,
  chatsStartedBuckets,
  weekOverWeekTrend,
  type ChatsStartedBuckets,
  type Trend,
} from "@/lib/stats";

export type OverviewStats = {
  botsCount: number;
  botsTrend: Trend | null;
  botsSpark: number[];
  conversationsCount: number;
  conversationsTrend: Trend | null;
  conversationsSpark: number[];
  resolutionRate: number | null;
  resolutionTrend: Trend | null;
  resolutionSpark: number[];
  messagesCount: number;
  messagesThisMonth: number;
  messagesTrend: Trend | null;
  messagesSpark: number[];
  chatsStarted: ChatsStartedBuckets;
};

/** Same figures as the web Overview page's own stat cards (src/app/(main)/app/page.tsx, now a
 * thin wrapper over this) — extracted so the mobile REST API's stats endpoint can reuse the exact
 * same queries and bucketing instead of drifting from what the web dashboard shows. */
export async function getOverviewStatsForUser(userId: string): Promise<OverviewStats> {
  const bots = await prisma.bot.findMany({ where: { userId }, select: { id: true, createdAt: true } });
  const botIds = bots.map((bot) => bot.id);
  const monthStart = startOfCurrentMonth();

  const [conversations, messages, messagesThisMonth] = botIds.length
    ? await Promise.all([
        prisma.conversation.findMany({
          where: { botId: { in: botIds } },
          select: { createdAt: true, status: true },
        }),
        prisma.message.findMany({
          where: { conversation: { botId: { in: botIds } } },
          select: { createdAt: true },
        }),
        prisma.message.count({
          where: { role: "USER", conversation: { botId: { in: botIds } }, createdAt: { gte: monthStart } },
        }),
      ])
    : [[], [], 0];

  const resolvedConversations = conversations.filter((c) => c.status === "RESOLVED");
  const resolutionRate =
    conversations.length === 0 ? null : Math.round((resolvedConversations.length / conversations.length) * 100);

  const botDates = bots.map((bot) => bot.createdAt);
  const conversationDates = conversations.map((c) => c.createdAt);
  const resolvedDates = resolvedConversations.map((c) => c.createdAt);
  const messageDates = messages.map((m) => m.createdAt);

  return {
    botsCount: bots.length,
    botsTrend: weekOverWeekTrend(botDates),
    botsSpark: bucketByDay(botDates, 7),
    conversationsCount: conversations.length,
    conversationsTrend: weekOverWeekTrend(conversationDates),
    conversationsSpark: bucketByDay(conversationDates, 7),
    resolutionRate,
    resolutionTrend: weekOverWeekTrend(resolvedDates),
    resolutionSpark: bucketByDay(resolvedDates, 7),
    messagesCount: messages.length,
    messagesThisMonth,
    messagesTrend: weekOverWeekTrend(messageDates),
    messagesSpark: bucketByDay(messageDates, 7),
    chatsStarted: chatsStartedBuckets(conversationDates),
  };
}
