import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "@/components/avatar";
import { MeoMark } from "@/components/meo-mark";
import { ApiError } from "@/lib/api/client";
import { getBots } from "@/lib/api/endpoints";
import type { BotDto } from "@/lib/api/types";
import { colors, radius, spacing } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

/** Landing screen for Flow Studio on mobile — picks a bot, then opens its flow's editable
 * canvas at studio/[botId]. Mirrors the web app's own bot-picker-then-canvas structure
 * (src/app/(main)/app/studio/[slug]/page.tsx loads the one bot's one flow directly by slug;
 * mobile needs this list first since there's no per-bot route param coming from anywhere else). */
export default function StudioScreen() {
  const router = useRouter();
  const [bots, setBots] = useState<BotDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await getBots();
      setBots(response.bots);
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
      <Text style={styles.header}>Studio</Text>
      <Text style={styles.subheader}>Pick a bot to edit its flow.</Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.orange2} />
        </View>
      ) : error && bots.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : bots.length === 0 ? (
        <View style={styles.centered}>
          <MeoMark size={40} />
          <Text style={styles.emptyText}>Create a bot on the web app to start building its flow.</Text>
        </View>
      ) : (
        <FlatList
          data={bots}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange2} />}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/studio/${item.id}`)}>
              <Avatar label={item.name} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowSlug} numberOfLines={1}>
                  {item.slug}
                </Text>
              </View>
              <View style={[styles.statusPill, item.status === "LIVE" && styles.statusPillLive]}>
                <Text style={[styles.statusText, item.status === "LIVE" && styles.statusTextLive]}>
                  {item.status === "LIVE" ? "Live" : "Draft"}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
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
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    color: colors.bad,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    textAlign: "center",
  },
  emptyText: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    textAlign: "center",
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 14.5,
  },
  rowSlug: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
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
