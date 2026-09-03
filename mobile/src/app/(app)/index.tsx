import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "@/components/avatar";
import { StatCard } from "@/components/stat-card";
import { getBots, getOverviewStats } from "@/lib/api/endpoints";
import type { BotDto, OverviewStatsResponse } from "@/lib/api/types";
import { useCachedQuery } from "@/lib/cache/use-cached-query";
import { colors, radius, spacing } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

function formatCount(count: number): string {
  return count.toLocaleString();
}

type OverviewData = { bots: BotDto[]; stats: OverviewStatsResponse };

async function fetchOverviewData(): Promise<OverviewData> {
  const [botsResponse, statsResponse] = await Promise.all([getBots(), getOverviewStats()]);
  return { bots: botsResponse.bots, stats: statsResponse };
}

/** Mobile counterpart to the web Overview page (src/app/(main)/app/page.tsx) — same stat cards
 * (via GET /api/v1/stats/overview, backed by the same getOverviewStatsForUser query) plus a bots
 * list, so the two dashboards always show the same numbers. Cached (see useCachedQuery) so
 * reopening this tab shows the last-known numbers instantly instead of a blank spinner while a
 * fresh fetch runs behind it. */
export default function OverviewScreen() {
  const { data, loading, refreshing, error, refresh } = useCachedQuery<OverviewData>(
    "overview:data",
    fetchOverviewData,
  );
  const bots = data?.bots ?? [];
  const stats = data?.stats ?? null;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.header}>Overview</Text>
      <Text style={styles.subheader}>
        {bots.length} {bots.length === 1 ? "bot" : "bots"}
      </Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.orange2} />
        </View>
      ) : error && !stats ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : stats ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange2} />}
        >
          <View style={styles.grid}>
            {/* No trend/spark: a bot count is a static total, not a time series — a flat, empty
             * chart under it looked broken rather than merely uneventful. */}
            <StatCard label="Bots" value={formatCount(stats.botsCount)} />
            <StatCard
              label="Conversations"
              value={formatCount(stats.conversationsCount)}
              trend={stats.conversationsTrend}
              spark={stats.conversationsSpark}
            />
            <StatCard
              label="Resolution rate"
              value={stats.resolutionRate === null ? "—" : `${stats.resolutionRate}%`}
              trend={stats.resolutionTrend}
            />
            <StatCard
              label="Messages"
              value={formatCount(stats.messagesCount)}
              trend={stats.messagesTrend}
              spark={stats.messagesSpark}
              caption={`${formatCount(stats.messagesThisMonth)} this month`}
            />
          </View>

          <Text style={styles.sectionTitle}>Chats started</Text>
          <View style={styles.grid}>
            <StatCard label="Today" value={formatCount(stats.chatsStarted.today)} compact />
            <StatCard label="Yesterday" value={formatCount(stats.chatsStarted.yesterday)} compact />
            <StatCard label="Last 7 days" value={formatCount(stats.chatsStarted.last7Days)} compact />
            <StatCard label="Last 30 days" value={formatCount(stats.chatsStarted.last30Days)} compact />
          </View>

          <Text style={styles.sectionTitle}>Your bots</Text>
          {bots.length === 0 ? (
            <Text style={styles.emptyText}>Create a bot on the web app to see it here.</Text>
          ) : (
            <View style={styles.botsList}>
              {bots.map((bot) => (
                <View key={bot.id} style={styles.botRow}>
                  <Avatar label={bot.name} size={36} />
                  <View style={styles.botRowBody}>
                    <Text style={styles.botRowTitle} numberOfLines={1}>
                      {bot.name}
                    </Text>
                    <Text style={styles.botRowMeta} numberOfLines={1}>
                      {bot.conversationCount} {bot.conversationCount === 1 ? "conversation" : "conversations"}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, bot.status === "LIVE" && styles.statusPillLive]}>
                    <Text style={[styles.statusText, bot.status === "LIVE" && styles.statusTextLive]}>
                      {bot.status === "LIVE" ? "Live" : "Draft"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    color: colors.text,
    fontFamily: fontFamily.bold,
    fontSize: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  subheader: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    color: colors.bad,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    textAlign: "center",
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.muted,
    fontFamily: fontFamily.semiBold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 13,
  },
  botsList: {
    gap: spacing.sm,
  },
  botRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  botRowBody: {
    flex: 1,
    gap: 2,
  },
  botRowTitle: {
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
  },
  botRowMeta: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 12,
  },
  statusPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.card2,
  },
  statusPillLive: {
    backgroundColor: "rgba(78, 216, 142, 0.16)",
  },
  statusText: {
    color: colors.muted,
    fontFamily: fontFamily.medium,
    fontSize: 11,
  },
  statusTextLive: {
    color: colors.ok,
  },
});
