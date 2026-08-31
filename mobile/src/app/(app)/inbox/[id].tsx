import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AttachmentAudioIcon,
  AttachmentDocumentIcon,
  AttachmentPhotoIcon,
  AttachmentVideoIcon,
  NavBackIcon,
  CommsSendIcon,
} from "@/components/icons";
import { ApiError } from "@/lib/api/client";
import { getMessages, sendMessage } from "@/lib/api/endpoints";
import type { ConversationDetailDto, MessageDto, QuotedMessageDto } from "@/lib/api/types";
import { colors, radius, spacing } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

const READ_TICK_COLOR = "#4EC5D8";

type MediaPreview = { Icon: ComponentType<{ size?: number; color?: string }> | null; text: string };

/** The app-drawn "this is a photo/document/video/audio" indicator for a quoted-message or
 * reply-bar preview — an icon, not the 📷/📄/🎥/🎤 emoji this used to prefix the text with, since
 * that's UI chrome the app itself generates, not something the user or bot typed. */
function mediaPreview(contentType: MessageDto["contentType"], content: string, caption?: string | null, fileName?: string | null): MediaPreview {
  switch (contentType) {
    case "IMAGE":
      return { Icon: AttachmentPhotoIcon, text: caption ?? "Photo" };
    case "DOCUMENT":
      return { Icon: AttachmentDocumentIcon, text: fileName ?? caption ?? "Document" };
    case "VIDEO":
      return { Icon: AttachmentVideoIcon, text: caption ?? "Video" };
    case "AUDIO":
      return { Icon: AttachmentAudioIcon, text: "Audio" };
    default:
      return { Icon: null, text: content };
  }
}

function MediaPreviewLabel({
  preview,
  textStyle,
  iconColor,
}: {
  preview: MediaPreview;
  textStyle: TextStyle | TextStyle[];
  iconColor: string;
}) {
  return (
    <View style={styles.mediaPreviewRow}>
      {preview.Icon ? <preview.Icon size={12} color={iconColor} /> : null}
      <Text style={textStyle} numberOfLines={1}>
        {preview.text}
      </Text>
    </View>
  );
}

function quoteLabel(role: "BOT" | "USER" | "AGENT", visitorId: string): string {
  if (role === "USER") return visitorId;
  if (role === "AGENT") return "You";
  return "Bot";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

async function openAttachment(dataUri: string) {
  try {
    const canOpen = await Linking.canOpenURL(dataUri);
    if (canOpen) {
      await Linking.openURL(dataUri);
      return;
    }
  } catch {
    // fall through to the alert below
  }
  Alert.alert("Can't open this file", "Your device doesn't support opening this attachment directly.");
}

export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const listRef = useRef<FlatList<MessageDto>>(null);
  const insets = useSafeAreaInsets();

  const [conversation, setConversation] = useState<ConversationDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageDto | null>(null);

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
    const quoting = replyingTo;
    setSending(true);
    setDraft("");
    setReplyingTo(null);
    try {
      await sendMessage(id, content, quoting?.id);
      await load();
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send — try again.");
      setDraft(content);
      setReplyingTo(quoting);
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
          // react-native-keyboard-controller's version (not RN's own) — it drives this padding
          // off the live native keyboard-animation callback on both platforms (keyboardWillShow/
          // keyboardWillChangeFrame on iOS, WindowInsetsAnimationCallback on Android via
          // app.json's android.softwareKeyboardLayoutMode: "resize"), so the reply bar rises and
          // falls in step with the keyboard's own curve instead of snapping in after the fact.
          // automaticOffset measures the header above this view itself, so no manual layout
          // tracking is needed for the offset the way RN's own KeyboardAvoidingView requires.
          behavior="padding"
          automaticOffset
        >
          <FlatList
            ref={listRef}
            data={conversation?.messages ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesContent}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                visitorId={conversation?.visitorId ?? ""}
                channel={conversation?.channel ?? "WEB"}
                onLongPress={() => setReplyingTo(item)}
              />
            )}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />

          {error ? <Text style={styles.sendError}>{error}</Text> : null}

          {replyingTo && (
            <View style={styles.replyingBar}>
              <View style={styles.replyingTextWrap}>
                <Text style={styles.replyingLabel}>{quoteLabel(replyingTo.role, conversation?.visitorId ?? "")}</Text>
                <MediaPreviewLabel
                  preview={mediaPreview(replyingTo.contentType, replyingTo.content, replyingTo.caption, replyingTo.fileName)}
                  textStyle={styles.replyingText}
                  iconColor={colors.muted}
                />
              </View>
              <Pressable onPress={() => setReplyingTo(null)} hitSlop={10}>
                <Text style={styles.replyingCancel}>✕</Text>
              </Pressable>
            </View>
          )}

          <View style={[styles.replyBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
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

function QuotedMessage({ quote, visitorId }: { quote: QuotedMessageDto; visitorId: string }) {
  return (
    <View style={styles.quote}>
      <Text style={styles.quoteLabel}>{quoteLabel(quote.role, visitorId)}</Text>
      <MediaPreviewLabel
        preview={mediaPreview(quote.contentType, quote.content, quote.caption, quote.fileName)}
        textStyle={styles.quoteText}
        iconColor={colors.muted}
      />
    </View>
  );
}

function DeliveryTicks({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  if (status === "FAILED") return <Text style={styles.tickFailed}>!</Text>;
  if (status === "SENT") return <Text style={styles.tick}>✓</Text>;
  if (status === "DELIVERED") return <Text style={styles.tick}>✓✓</Text>;
  if (status === "READ") return <Text style={[styles.tick, styles.tickRead]}>✓✓</Text>;
  return null;
}

function MessageBubble({
  message,
  visitorId,
  channel,
  onLongPress,
}: {
  message: MessageDto;
  visitorId: string;
  channel: "WHATSAPP" | "WEB";
  onLongPress: () => void;
}) {
  const fromCustomer = message.role === "USER";
  const reaction = message.customerReaction || message.agentReaction || null;

  return (
    <View style={[styles.bubbleRow, fromCustomer ? styles.bubbleRowLeft : styles.bubbleRowRight]}>
      <Pressable
        onLongPress={onLongPress}
        style={[styles.bubble, fromCustomer ? styles.bubbleCustomer : styles.bubbleUs]}
      >
        {message.forwarded && <Text style={styles.forwardedLabel}>Forwarded</Text>}
        {message.replyTo && <QuotedMessage quote={message.replyTo} visitorId={visitorId} />}

        {message.contentType === "IMAGE" ? (
          <>
            <Image source={{ uri: message.content }} style={styles.attachmentImage} resizeMode="cover" />
            {message.caption ? <Text style={styles.bubbleText}>{message.caption}</Text> : null}
          </>
        ) : message.contentType === "DOCUMENT" || message.contentType === "VIDEO" || message.contentType === "AUDIO" ? (
          <Pressable style={styles.attachmentCard} onPress={() => openAttachment(message.content)}>
            {message.contentType === "DOCUMENT" ? (
              <AttachmentDocumentIcon size={22} color={colors.orange2} />
            ) : message.contentType === "VIDEO" ? (
              <AttachmentVideoIcon size={22} color={colors.orange2} />
            ) : (
              <AttachmentAudioIcon size={22} color={colors.orange2} />
            )}
            <View style={styles.attachmentTextWrap}>
              <Text style={[styles.bubbleText, styles.attachmentTitle]} numberOfLines={1}>
                {message.contentType === "DOCUMENT" ? (message.fileName ?? "Document") : message.contentType === "VIDEO" ? "Video" : "Voice message"}
              </Text>
              <Text style={styles.attachmentHint}>Tap to open</Text>
              {message.caption ? <Text style={styles.bubbleText}>{message.caption}</Text> : null}
            </View>
          </Pressable>
        ) : (
          <Text style={styles.bubbleText}>{message.content}</Text>
        )}

        <View style={styles.metaRow}>
          <Text style={styles.metaTime}>{formatTime(message.createdAt)}</Text>
          {!fromCustomer && channel === "WHATSAPP" && <DeliveryTicks status={message.deliveryStatus} />}
        </View>

        {message.starred && <Text style={styles.starBadge}>★</Text>}
        {reaction && (
          <View style={styles.reactionBadge}>
            <Text style={styles.reactionText}>{reaction}</Text>
          </View>
        )}
      </Pressable>
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
    position: "relative",
    maxWidth: "80%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.cardSm,
  },
  bubbleCustomer: {
    backgroundColor: colors.card,
  },
  // Not a solid orange fill: a long bot caption (a promo message with an image, say) turned the
  // whole bubble into a full-bleed orange card that read as an ad glued into the thread rather
  // than a chat bubble. Orange stays reserved for the accent border + small interactive/unread
  // elements elsewhere, matching every other "our" bubble's dark background.
  bubbleUs: {
    backgroundColor: colors.card2,
    borderWidth: 1,
    borderColor: "rgba(255,92,22,0.35)",
  },
  bubbleText: {
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: 14.5,
  },
  forwardedLabel: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontStyle: "italic",
    fontSize: 11,
    marginBottom: 4,
  },
  quote: {
    borderLeftWidth: 2,
    borderLeftColor: colors.orange2,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  quoteLabel: {
    color: colors.orange2,
    fontFamily: fontFamily.semiBold,
    fontSize: 11,
  },
  quoteText: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 12,
  },
  mediaPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  attachmentImage: {
    width: 220,
    height: 220,
    borderRadius: radius.cardSm - 4,
    marginBottom: 4,
    backgroundColor: colors.card2,
  },
  attachmentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 180,
  },
  attachmentTextWrap: {
    flex: 1,
    gap: 2,
  },
  attachmentTitle: {
    fontFamily: fontFamily.semiBold,
  },
  attachmentHint: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 11,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 4,
  },
  metaTime: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 10.5,
  },
  tick: {
    color: colors.muted,
    fontSize: 11,
  },
  tickRead: {
    color: READ_TICK_COLOR,
  },
  tickFailed: {
    color: colors.bad,
    fontSize: 11,
    fontFamily: fontFamily.semiBold,
  },
  starBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    color: colors.orange2,
    fontSize: 12,
    backgroundColor: colors.bg,
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 2,
  },
  reactionBadge: {
    position: "absolute",
    bottom: -10,
    left: 8,
    backgroundColor: colors.card2,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: colors.line,
  },
  reactionText: {
    fontSize: 12,
  },
  sendError: {
    color: colors.bad,
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  replyingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.cardSm,
    borderLeftWidth: 2,
    borderLeftColor: colors.orange2,
    backgroundColor: colors.card2,
  },
  replyingTextWrap: {
    flex: 1,
    gap: 2,
  },
  replyingLabel: {
    color: colors.orange2,
    fontFamily: fontFamily.semiBold,
    fontSize: 11,
  },
  replyingText: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 12,
  },
  replyingCancel: {
    color: colors.muted,
    fontSize: 13,
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
