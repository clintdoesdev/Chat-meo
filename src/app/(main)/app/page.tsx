import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { BotsPanel } from "@/components/app/bots-panel";
import { StatCard } from "@/components/app/stat-card";
import { WhatsAppConnectRedirectHandler } from "@/components/app/whatsapp-connect-redirect-handler";
import { NavBotsIcon, NavInboxIcon, NodesMessageIcon, StatusSuccessIcon } from "@/components/icons";
import { startOfCurrentMonth } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";
import { bucketByDay, chatsStartedBuckets, weekOverWeekTrend } from "@/lib/stats";

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
    conversations.length === 0
      ? null
      : Math.round((resolvedConversations.length / conversations.length) * 100);

  const botDates = bots.map((bot) => bot.createdAt);
  const conversationDates = conversations.map((c) => c.createdAt);
  const resolvedDates = resolvedConversations.map((c) => c.createdAt);
  const messageDates = messages.map((m) => m.createdAt);
  const chatsStarted = chatsStartedBuckets(conversationDates);

  return (
    <div>
      <Suspense fallback={null}>
        <WhatsAppConnectRedirectHandler />
      </Suspense>

      <div className="mb-[22px]">
        <h1 className="text-[22px] font-bold tracking-tight">Overview</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {bots.length} {bots.length === 1 ? "bot" : "bots"}
        </p>
      </div>

      <div className="mb-3.5 grid grid-cols-2 gap-3 min-[760px]:grid-cols-4">
        <StatCard
          label="Bots"
          value={String(bots.length)}
          trend={weekOverWeekTrend(botDates)}
          spark={bucketByDay(botDates, 7)}
          icon={NavBotsIcon}
        />
        <StatCard
          label="Conversations"
          value={String(conversations.length)}
          trend={weekOverWeekTrend(conversationDates)}
          spark={bucketByDay(conversationDates, 7)}
          icon={NavInboxIcon}
        />
        <StatCard
          label="Resolution rate"
          value={resolutionRate === null ? "—" : `${resolutionRate}%`}
          trend={weekOverWeekTrend(resolvedDates)}
          spark={bucketByDay(resolvedDates, 7)}
          icon={StatusSuccessIcon}
        />
        <StatCard
          label="Messages"
          value={String(messages.length)}
          trend={weekOverWeekTrend(messageDates)}
          spark={bucketByDay(messageDates, 7)}
          caption={`${messagesThisMonth} this month`}
          icon={NodesMessageIcon}
        />
      </div>

      <div className="mb-3.5">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Chats started</h2>
        <div className="grid grid-cols-2 gap-3 min-[760px]:grid-cols-4">
          <StatCard label="Today" value={String(chatsStarted.today)} trend={null} spark={[]} compact icon={NavInboxIcon} />
          <StatCard
            label="Yesterday"
            value={String(chatsStarted.yesterday)}
            trend={null}
            spark={[]}
            compact
            icon={NavInboxIcon}
          />
          <StatCard
            label="Last 7 days"
            value={String(chatsStarted.last7Days)}
            trend={null}
            spark={[]}
            compact
            icon={NavInboxIcon}
          />
          <StatCard
            label="Last 30 days"
            value={String(chatsStarted.last30Days)}
            trend={null}
            spark={[]}
            compact
            icon={NavInboxIcon}
          />
        </div>
      </div>

      <BotsPanel
        bots={bots.map((bot) => ({
          id: bot.id,
          name: bot.name,
          slug: bot.slug,
          status: bot.status,
          avatarUrl: bot.avatarUrl,
          conversationCount: bot._count.conversations,
        }))}
      />
    </div>
  );
}
