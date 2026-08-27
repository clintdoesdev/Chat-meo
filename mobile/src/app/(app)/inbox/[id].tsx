import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NavBackIcon, CommsSendIcon } from "@/components/icons";
import { ApiError } from "@/lib/api/client";
import { getMessages, sendMessage } from "@/lib/api/endpoints";
import type { ConversationDetailDto, MessageDto } from "@/lib/api/types";
import { colors, radius, spacing } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const listRef = useRef<FlatList<MessageDto>>(null);

  const [conversation, setConversation] = useState<ConversationDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await getMessages(id);
      setConversation(response.conversation);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Can't reach Chatmeo — check your connection.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Standard fetch-on-mount — load()'s setState calls only run after its internal `await`,
    // not synchronously in this effect body, but the rule's static analysis can't see that far.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft("");
    try {
      await sendMessage(id, content);
      await load();
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send — try again.");
      setDraft(content);
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <NavBackIcon size={18} color={colors.text} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {conversation?.botName ?? "Conversation"}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {conversation?.visitorId ?? ""}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.orange2} />
        </View>
      ) : error && !conversation ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <FlatList
            ref={listRef}
            data={conversation?.messages ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesContent}
            renderItem={({ item }) => <MessageBubble message={item} />}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />

          {error ? <Text style={styles.sendError}>{error}</Text> : null}

          <View style={styles.replyBar}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message…"
              placeholderTextColor={colors.muted}
              style={styles.replyInput}
              multiline
            />
            <Pressable
              onPress={handleSend}
              disabled={sending || draft.trim().length === 0}
              style={[styles.sendButton, (sending || draft.trim().length === 0) && styles.sendButtonDisabled]}
            >
              {sending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <CommsSendIcon size={16} color={colors.white} />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function MessageBubble({ message }: { message: MessageDto }) {
  const fromCustomer = message.role === "USER";
  return (
    <View style={[styles.bubbleRow, fromCustomer ? styles.bubbleRowLeft : styles.bubbleRowRight]}>
      <View style={[styles.bubble, fromCustomer ? styles.bubbleCustomer : styles.bubbleUs]}>
        <Text style={[styles.bubbleText, !fromCustomer && styles.bubbleTextOnOrange]}>
          {message.contentType === "IMAGE" ? message.caption ?? "📷 Photo" : message.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 15.5,
  },
  headerSubtitle: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 12,
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
  messagesContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  bubbleRow: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  bubbleRowLeft: {
    justifyContent: "flex-start",
  },
  bubbleRowRight: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.cardSm,
  },
  bubbleCustomer: {
    backgroundColor: colors.card,
  },
  bubbleUs: {
    backgroundColor: colors.orange,
  },
  bubbleText: {
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: 14.5,
  },
  bubbleTextOnOrange: {
    color: colors.white,
  },
  sendError: {
    color: colors.bad,
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  replyInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 40,
    borderRadius: radius.cardSm,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
