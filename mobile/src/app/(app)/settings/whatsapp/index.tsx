import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NavBackIcon } from "@/components/icons";
import { Avatar } from "@/components/avatar";
import { MeoMark } from "@/components/meo-mark";
import { ApiError } from "@/lib/api/client";
import { getBots } from "@/lib/api/endpoints";
import type { BotDto } from "@/lib/api/types";
import { colors, radius, spacing } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

/** Bot picker for WhatsApp channel management — same structure as the Studio bot picker
 * (studio/index.tsx), just leading into settings/whatsapp/[botId] instead of a flow canvas. */
export default function WhatsAppBotPickerScreen() {
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
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <NavBackIcon size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>WhatsApp channels</Text>
      </View>

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
          <Text style={styles.emptyText}>Create a bot on the web app first.</Text>
        </View>
      ) : (
        <FlatList
          data={bots}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange2} />}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/settings/whatsapp/${item.id}`)}>
              <Avatar label={item.name} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowSlug} numberOfLines={1}>
                  {item.slug}
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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    color: colors.text,
    fontFamily: fontFamily.bold,
    fontSize: 18,
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
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
});
