import { startOfCurrentMonth } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";
import {
  bucketByDay,
  chatsStartedBuckets,
  weekOverWeekRateTrend,
  weekOverWeekTrend,
  type ChatsStartedBuckets,
  type Trend,
} from "@/lib/stats";
import { DEFAULT_TIME_ZONE } from "@/lib/timezone";

export type OverviewStats = {
  botsCount: number;
  conversationsCount: number;
  conversationsTrend: Trend | null;
  conversationsSpark: number[];
  resolutionRate: number | null;
  resolutionTrend: Trend | null;
  messagesCount: number;
  messagesThisMonth: number;
  messagesTrend: Trend | null;
  messagesSpark: number[];
  chatsStarted: ChatsStartedBuckets;
};

/** Same figures as the web Overview page's own stat cards (src/app/(main)/app/page.tsx, now a
 * thin wrapper over this) — extracted so the mobile REST API's stats endpoint can reuse the exact
 * same queries and bucketing instead of drifting from what the web dashboard shows.
 *
 * `timeZone` is whatever IANA zone the caller's own client (browser, phone) reports for itself —
 * see src/lib/timezone.ts — so "Today"/"Yesterday" and the daily sparklines line up with the
 * viewer's own midnight instead of wherever this server happens to be hosted. Defaults to UTC for
 * a caller that has none to give (should be rare — both the web page and the mobile route
 * normalize a missing/invalid value to this same default before calling in). */
export async function getOverviewStatsForUser(userId: string, timeZone: string = DEFAULT_TIME_ZONE): Promise<OverviewStats> {
  const bots = await prisma.bot.findMany({ where: { userId }, select: { id: true, createdAt: true } });
  const botIds = bots.map((bot) => bot.id);
  const monthStart = startOfCurrentMonth(timeZone);

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

  const conversationDates = conversations.map((c) => c.createdAt);
  const resolvedDates = resolvedConversations.map((c) => c.createdAt);
  const messageDates = messages.map((m) => m.createdAt);

  return {
    botsCount: bots.length,
    conversationsCount: conversations.length,
    conversationsTrend: weekOverWeekTrend(conversationDates),
    conversationsSpark: bucketByDay(conversationDates, 7, timeZone),
    resolutionRate,
    // Trend of the *rate* (resolved / total, per week) rather than weekOverWeekTrend(resolvedDates)
    // — that would report how the raw count of resolved conversations moved, a different quantity
    // that can (and did) show something like "down 100%" right next to a rate that didn't actually
    // fall to 0%, since a quieter week resolves fewer conversations in absolute terms even at an
    // unchanged or rising rate.
    resolutionTrend: weekOverWeekRateTrend(resolvedDates, conversationDates),
    messagesCount: messages.length,
    messagesThisMonth,
    messagesTrend: weekOverWeekTrend(messageDates),
    messagesSpark: bucketByDay(messageDates, 7, timeZone),
    chatsStarted: chatsStartedBuckets(conversationDates, timeZone),
  };
}
