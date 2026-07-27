import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BotsPanel } from "@/components/app/bots-panel";
import { StatCard } from "@/components/app/stat-card";
import { prisma } from "@/lib/prisma";
import { bucketByDay, weekOverWeekTrend } from "@/lib/stats";

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const userId = session.user.id;

  const bots = await prisma.bot.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { conversations: true } } },
  });

  const botIds = bots.map((bot) => bot.id);

  const [conversations, messages] = botIds.length
    ? await Promise.all([
        prisma.conversation.findMany({
          where: { botId: { in: botIds } },
          select: { createdAt: true, status: true },
        }),
        prisma.message.findMany({
          where: { conversation: { botId: { in: botIds } } },
          select: { createdAt: true },
        }),
      ])
    : [[], []];

  const resolvedConversations = conversations.filter((c) => c.status === "RESOLVED");
  const resolutionRate =
    conversations.length === 0
      ? null
      : Math.round((resolvedConversations.length / conversations.length) * 100);

  const botDates = bots.map((bot) => bot.createdAt);
  const conversationDates = conversations.map((c) => c.createdAt);
  const resolvedDates = resolvedConversations.map((c) => c.createdAt);
  const messageDates = messages.map((m) => m.createdAt);

  return (
    <div>
      <div className="mb-[22px]">
        <h1 className="text-[22px] font-bold tracking-tight">Overview</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {session.user.plan} plan · {bots.length} {bots.length === 1 ? "bot" : "bots"}
        </p>
      </div>

      <div className="mb-3.5 grid grid-cols-2 gap-3 min-[760px]:grid-cols-4">
        <StatCard
          label="Bots"
          value={String(bots.length)}
          trend={weekOverWeekTrend(botDates)}
          spark={bucketByDay(botDates, 7)}
        />
        <StatCard
          label="Conversations"
          value={String(conversations.length)}
          trend={weekOverWeekTrend(conversationDates)}
          spark={bucketByDay(conversationDates, 7)}
        />
        <StatCard
          label="Resolution rate"
          value={resolutionRate === null ? "—" : `${resolutionRate}%`}
          trend={weekOverWeekTrend(resolvedDates)}
          spark={bucketByDay(resolvedDates, 7)}
        />
        <StatCard
          label="Messages"
          value={String(messages.length)}
          trend={weekOverWeekTrend(messageDates)}
          spark={bucketByDay(messageDates, 7)}
        />
      </div>

      <BotsPanel
        bots={bots.map((bot) => ({
          id: bot.id,
          name: bot.name,
          slug: bot.slug,
          status: bot.status,
          conversationCount: bot._count.conversations,
        }))}
      />
    </div>
  );
}
