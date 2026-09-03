import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  ActionsTrashIcon,
  ChannelsWhatsappIcon,
  ChannelsWidgetIcon,
} from "@/components/icons";
import { deleteConversation, getConversations, setConversationArchived } from "@/lib/api/endpoints";
import type { ConversationDto, ConversationsResponse } from "@/lib/api/types";
import { useCachedQuery } from "@/lib/cache/use-cached-query";
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

// Short enough that a new inbound WhatsApp message shows up without a manual pull, cheap enough
// (one lightweight list query) not to matter for battery/data while the Inbox is open.
const POLL_INTERVAL_MS = 8000;

export default function InboxScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const {
    data: response,
    loading,
    refreshing,
    error,
    refresh,
    setData,
  } = useCachedQuery<ConversationsResponse>("inbox:conversations", getConversations, {
    refetchIntervalMs: POLL_INTERVAL_MS,
  });
  const conversations = useMemo(() => response?.conversations ?? [], [response]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations
      .filter((c) => !c.archived)
      .filter((c) => {
        if (filter === "unread") return c.unread;
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
      setData((current) => ({ conversations: (current?.conversations ?? []).filter((c) => c.id !== id) }));
      setConversationArchived(id, true).catch(() => {
        // The backend mutation failed — refresh from the server rather than leaving the list
        // quietly out of sync with what's actually archived.
        refresh();
      });
    },
    [setData, refresh],
  );

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert("Delete this chat?", "This permanently deletes the conversation and its messages. This can't be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setData((current) => ({ conversations: (current?.conversations ?? []).filter((c) => c.id !== id) }));
            deleteConversation(id).catch(() => {
              refresh();
            });
          },
        },
      ]);
    },
    [setData, refresh],
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange2} />}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              showBotName={hasMultipleBots}
              onPress={() => router.push(`/inbox/${item.id}`)}
              onArchive={() => handleArchive(item.id)}
              onDelete={() => handleDelete(item.id)}
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
  onDelete,
}: {
  conversation: ConversationDto;
  showBotName: boolean;
  onPress: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const isWhatsApp = conversation.channel === "WHATSAPP";
  const ChannelIcon = isWhatsApp ? ChannelsWhatsappIcon : ChannelsWidgetIcon;
  const contact = isWhatsApp ? formatPhoneNumber(conversation.visitorId) : conversation.visitorId;

  return (
    <Swipeable
      renderRightActions={() => (
        <View style={styles.swipeActions}>
          <Pressable onPress={onArchive} style={[styles.swipeAction, styles.archiveAction]}>
            <ActionsArchiveIcon size={18} color={colors.white} />
          </Pressable>
          <Pressable onPress={onDelete} style={[styles.swipeAction, styles.deleteAction]}>
            <ActionsTrashIcon size={18} color={colors.white} />
          </Pressable>
        </View>
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
            <Text style={styles.rowPreview} numberOfLines={1}>
              {conversation.lastMessagePreview}
            </Text>
            {conversation.unread ? <View style={styles.unreadPillWrap}><UnreadPill /></View> : null}
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
  // A solid fill, not just a border-color shift — two clearly distinct states rather than a
  // shade the near-black background could still wash out.
  filterPillActive: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  filterLabel: {
    color: colors.muted,
    fontFamily: fontFamily.medium,
    fontSize: 12.5,
  },
  filterLabelActive: {
    color: colors.white,
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
  swipeActions: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  swipeAction: {
    width: 60,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveAction: {
    backgroundColor: colors.muted,
  },
  deleteAction: {
    backgroundColor: colors.bad,
  },
});
