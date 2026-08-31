import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "@/components/avatar";
import { StatCard } from "@/components/stat-card";
import { ApiError } from "@/lib/api/client";
import { getBots, getOverviewStats } from "@/lib/api/endpoints";
import type { BotDto, OverviewStatsResponse } from "@/lib/api/types";
import { colors, radius, spacing } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

/** Mobile counterpart to the web Overview page (src/app/(main)/app/page.tsx) — same stat cards
 * (via GET /api/v1/stats/overview, backed by the same getOverviewStatsForUser query) plus a bots
 * list, so the two dashboards always show the same numbers. */
export default function OverviewScreen() {
  const router = useRouter();
  const [bots, setBots] = useState<BotDto[]>([]);
  const [stats, setStats] = useState<OverviewStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [botsResponse, statsResponse] = await Promise.all([getBots(), getOverviewStats()]);
      setBots(botsResponse.bots);
      setStats(statsResponse);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Can't reach Chatmeo — check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange2} />}
        >
          <View style={styles.grid}>
            <StatCard label="Bots" value={String(stats.botsCount)} trend={stats.botsTrend} spark={stats.botsSpark} />
            <StatCard
              label="Conversations"
              value={String(stats.conversationsCount)}
              trend={stats.conversationsTrend}
              spark={stats.conversationsSpark}
            />
            <StatCard
              label="Resolution rate"
              value={stats.resolutionRate === null ? "—" : `${stats.resolutionRate}%`}
              trend={stats.resolutionTrend}
              spark={stats.resolutionSpark}
            />
            <StatCard
              label="Messages"
              value={String(stats.messagesCount)}
              trend={stats.messagesTrend}
              spark={stats.messagesSpark}
              caption={`${stats.messagesThisMonth} this month`}
            />
          </View>

          <Text style={styles.sectionTitle}>Chats started</Text>
          <View style={styles.grid}>
            <StatCard label="Today" value={String(stats.chatsStarted.today)} trend={null} spark={[]} compact />
            <StatCard label="Yesterday" value={String(stats.chatsStarted.yesterday)} trend={null} spark={[]} compact />
            <StatCard label="Last 7 days" value={String(stats.chatsStarted.last7Days)} trend={null} spark={[]} compact />
            <StatCard label="Last 30 days" value={String(stats.chatsStarted.last30Days)} trend={null} spark={[]} compact />
          </View>

          <Text style={styles.sectionTitle}>Your bots</Text>
          {bots.length === 0 ? (
            <Text style={styles.emptyText}>Create a bot on the web app to see it here.</Text>
          ) : (
            <View style={styles.botsList}>
              {bots.map((bot) => (
                <Pressable key={bot.id} style={styles.botRow} onPress={() => router.push(`/studio/${bot.id}`)}>
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
                </Pressable>
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
