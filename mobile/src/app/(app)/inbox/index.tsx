import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "@/components/avatar";
import { MeoMark } from "@/components/meo-mark";
import {
  ActionsArchiveIcon,
  ActionsSearchIcon,
  ChannelsWhatsappIcon,
  ChannelsWidgetIcon,
} from "@/components/icons";
import { ApiError } from "@/lib/api/client";
import { getConversations, setConversationArchived } from "@/lib/api/endpoints";
import type { ConversationDto } from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/format-time";
import { formatPhoneNumber } from "@/lib/format-phone";
import { colors, radius, spacing } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

type FilterKey = "all" | "unread" | "whatsapp" | "widget";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "widget", label: "Widget" },
];

// Known "status" circle emoji some flow templates use as a lightweight progress marker inside
// message text (WhatsApp itself only renders real unicode emoji, so the sent message keeps it) —
// swapped for a plain colored dot in the *preview list* only, for visual consistency with the
// rest of this app's own icon language. The full conversation view still shows the raw message
// text exactly as sent.
const STATUS_DOT_COLORS: Record<string, string> = {
  "🟡": colors.orange2,
  "🟢": colors.ok,
  "🔴": colors.bad,
};
const STATUS_DOT_PATTERN = /^(🟡|🟢|🔴)\s*/u;

function extractStatusDot(text: string): { color: string | null; rest: string } {
  const match = STATUS_DOT_PATTERN.exec(text);
  if (!match) return { color: null, rest: text };
  return { color: STATUS_DOT_COLORS[match[1]] ?? null, rest: text.slice(match[0].length) };
}

export default function InboxScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const load = useCallback(async () => {
    try {
      const response = await getConversations();
      setConversations(response.conversations);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Can't reach Chatmeo — check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Standard fetch-on-mount — load()'s setState calls only run after its internal `await`,
    // not synchronously in this effect body, but the rule's static analysis can't see that far.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations
      .filter((c) => !c.archived)
      .filter((c) => {
        if (filter === "unread") return c.lastMessageRole === "USER";
        if (filter === "whatsapp") return c.channel === "WHATSAPP";
        if (filter === "widget") return c.channel === "WEB";
        return true;
      })
      .filter((c) => {
        if (!q) return true;
        return (
          c.botName.toLowerCase().includes(q) ||
          c.visitorId.toLowerCase().includes(q) ||
          c.lastMessagePreview.toLowerCase().includes(q)
        );
      });
  }, [conversations, filter, query]);

  // The "Vireon · " row prefix only earns its place when the list actually spans more than one
  // bot — with a single bot it repeats the same word on every row for no added information.
  const hasMultipleBots = useMemo(() => new Set(conversations.map((c) => c.botName)).size > 1, [conversations]);

  const handleArchive = useCallback(
    (id: string) => {
      const previous = conversations;
      setConversations((current) => current.filter((c) => c.id !== id));
      setConversationArchived(id, true).catch(() => {
        // The backend mutation failed — restore the row rather than leaving the list quietly
        // out of sync with what the server actually has archived.
        setConversations(previous);
      });
    },
    [conversations],
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.header}>Inbox</Text>

      <View style={styles.searchPill}>
        <ActionsSearchIcon size={16} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search…"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.orange2} />
        </View>
      ) : error && conversations.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <MeoMark size={40} />
          <Text style={styles.emptyText}>
            {query || filter !== "all"
              ? "Nothing matches that yet."
              : "New messages will show up here the moment someone writes in."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange2} />}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              showBotName={hasMultipleBots}
              onPress={() => router.push(`/inbox/${item.id}`)}
              onArchive={() => handleArchive(item.id)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function ConversationRow({
  conversation,
  showBotName,
  onPress,
  onArchive,
}: {
  conversation: ConversationDto;
  showBotName: boolean;
  onPress: () => void;
  onArchive: () => void;
}) {
  const awaitingReply = conversation.lastMessageRole === "USER";
  const isWhatsApp = conversation.channel === "WHATSAPP";
  const ChannelIcon = isWhatsApp ? ChannelsWhatsappIcon : ChannelsWidgetIcon;
  const contact = isWhatsApp ? formatPhoneNumber(conversation.visitorId) : conversation.visitorId;
  const { color: statusColor, rest: previewText } = extractStatusDot(conversation.lastMessagePreview);

  return (
    <Swipeable
      renderRightActions={() => (
        <Pressable onPress={onArchive} style={styles.archiveAction}>
          <ActionsArchiveIcon size={18} color={colors.white} />
        </Pressable>
      )}
    >
      <Pressable onPress={onPress} style={styles.row}>
        <Avatar label={contact} isPhoneNumber={isWhatsApp} />
        <View style={styles.rowBody}>
          <View style={styles.rowTopLine}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {showBotName ? `${conversation.botName} · ${contact}` : contact}
            </Text>
            <Text style={styles.rowTime}>{formatRelativeTime(conversation.lastMessageAt)}</Text>
          </View>
          <View style={styles.rowBottomLine}>
            <ChannelIcon size={13} color={colors.muted} />
            {statusColor && <View style={[styles.statusDot, { backgroundColor: statusColor }]} />}
            <Text style={styles.rowPreview} numberOfLines={1}>
              {previewText}
            </Text>
            {awaitingReply ? <View style={styles.unreadPillWrap}><UnreadPill /></View> : null}
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

function UnreadPill() {
  return (
    <View style={styles.unreadPill}>
      <Text style={styles.unreadPillText}>•</Text>
    </View>
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
    paddingBottom: spacing.md,
  },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.lg,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  filterPillActive: {
    backgroundColor: colors.card2,
    borderColor: colors.orange2,
  },
  filterLabel: {
    color: colors.muted,
    fontFamily: fontFamily.medium,
    fontSize: 12.5,
  },
  filterLabelActive: {
    color: colors.text,
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
    gap: 4,
  },
  rowTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 14.5,
  },
  rowTime: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
  },
  rowBottomLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rowPreview: {
    flex: 1,
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 13,
  },
  unreadPillWrap: {
    marginLeft: spacing.xs,
  },
  unreadPill: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  unreadPillText: {
    color: colors.white,
    fontSize: 10,
    fontFamily: fontFamily.bold,
    lineHeight: 12,
  },
  archiveAction: {
    width: 72,
    marginBottom: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.bad,
    alignItems: "center",
    justifyContent: "center",
  },
});
