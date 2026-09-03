import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { BotsPanel } from "@/components/app/bots-panel";
import { StatCard } from "@/components/app/stat-card";
import { WhatsAppConnectRedirectHandler } from "@/components/app/whatsapp-connect-redirect-handler";
import { NavBotsIcon, NavInboxIcon, NodesMessageIcon, StatusSuccessIcon } from "@/components/icons";
import { prisma } from "@/lib/prisma";
import { getOverviewStatsForUser } from "@/lib/stats-queries";
import { normalizeTimeZone } from "@/lib/timezone";

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const userId = session.user.id;

  // Set client-side by TimezoneSync (see (main)/layout.tsx) from the browser's own
  // Intl.DateTimeFormat — absent only on a first-ever page load before that effect has run, or a
  // client with cookies/JS disabled, in which case normalizeTimeZone falls back to UTC.
  const cookieStore = await cookies();
  const timeZone = normalizeTimeZone(cookieStore.get("tz")?.value);

  const [bots, stats] = await Promise.all([
    prisma.bot.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { conversations: true } } },
    }),
    getOverviewStatsForUser(userId, timeZone),
  ]);

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
        {/* No trend/spark: a bot count is a static total, not a time series. */}
        <StatCard label="Bots" value={stats.botsCount.toLocaleString()} icon={NavBotsIcon} />
        <StatCard
          label="Conversations"
          value={stats.conversationsCount.toLocaleString()}
          trend={stats.conversationsTrend}
          spark={stats.conversationsSpark}
          icon={NavInboxIcon}
        />
        <StatCard
          label="Resolution rate"
          value={stats.resolutionRate === null ? "—" : `${stats.resolutionRate}%`}
          trend={stats.resolutionTrend}
          icon={StatusSuccessIcon}
        />
        <StatCard
          label="Messages"
          value={stats.messagesCount.toLocaleString()}
          trend={stats.messagesTrend}
          spark={stats.messagesSpark}
          caption={`${stats.messagesThisMonth.toLocaleString()} this month`}
          icon={NodesMessageIcon}
        />
      </div>

      <div className="mb-3.5">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Chats started</h2>
        <div className="grid grid-cols-2 gap-3 min-[760px]:grid-cols-4">
          <StatCard label="Today" value={stats.chatsStarted.today.toLocaleString()} compact icon={NavInboxIcon} />
          <StatCard
            label="Yesterday"
            value={stats.chatsStarted.yesterday.toLocaleString()}
            compact
            icon={NavInboxIcon}
          />
          <StatCard
            label="Last 7 days"
            value={stats.chatsStarted.last7Days.toLocaleString()}
            compact
            icon={NavInboxIcon}
          />
          <StatCard
            label="Last 30 days"
            value={stats.chatsStarted.last30Days.toLocaleString()}
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
