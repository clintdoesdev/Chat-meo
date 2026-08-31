import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChannelsWhatsappIcon, NavBackIcon } from "@/components/icons";
import { API_BASE_URL, ApiError } from "@/lib/api/client";
import { disconnectWhatsApp, getWhatsAppConnection, setWhatsAppActive } from "@/lib/api/endpoints";
import type { WhatsAppConnectionDto } from "@/lib/api/types";
import { colors, radius, spacing } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

function statusLabel(connection: WhatsAppConnectionDto): { text: string; color: string } {
  if (connection.status === "DISCONNECTED") return { text: "Disconnected", color: colors.muted };
  if (connection.status === "BANNED") return { text: "Banned by Meta", color: colors.bad };
  if (connection.status === "TOKEN_EXPIRED") return { text: "Needs reconnecting", color: colors.bad };
  if (!connection.isActive) return { text: "Paused", color: colors.muted };
  return { text: "Connected", color: colors.ok };
}

/** Mobile counterpart to the web Settings modal's WhatsApp card (src/components/app/
 * whatsapp-connect-panel.tsx) — status, the seller's own Live/Paused toggle, and Disconnect.
 * Connecting/reconnecting a number opens Meta's Embedded Signup in an in-app browser rather than
 * reimplementing that OAuth flow natively (see the API route's own doc comment for why it has to
 * be a full-page browser redirect) — the user finishes that step on the web, signing in there if
 * they aren't already, then comes back here and pulls to refresh. */
export default function WhatsAppChannelScreen() {
  const { botId } = useLocalSearchParams<{ botId: string }>();
  const router = useRouter();

  const [configured, setConfigured] = useState(true);
  const [connection, setConnection] = useState<WhatsAppConnectionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglePending, setTogglePending] = useState(false);
  const [disconnectPending, setDisconnectPending] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await getWhatsAppConnection(botId);
      setConfigured(response.configured);
      setConnection(response.connection);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Can't reach Chatmeo — check your connection.");
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleToggle(nextActive: boolean) {
    if (!connection || togglePending) return;
    setTogglePending(true);
    const result = await setWhatsAppActive(botId, nextActive);
    setTogglePending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setConnection((prev) => (prev ? { ...prev, isActive: nextActive } : prev));
  }

  async function handleDisconnect() {
    setDisconnectPending(true);
    const result = await disconnectWhatsApp(botId);
    setDisconnectPending(false);
    setConfirmVisible(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setConnection((prev) => (prev ? { ...prev, status: "DISCONNECTED", isActive: false } : prev));
  }

  async function handleConnect() {
    setOpening(true);
    try {
      await WebBrowser.openBrowserAsync(`${API_BASE_URL}/api/whatsapp/connect/start?botId=${encodeURIComponent(botId)}`);
    } finally {
      setOpening(false);
      load();
    }
  }

  const isRevoked = !connection || connection.status === "DISCONNECTED";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <NavBackIcon size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>WhatsApp</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.orange2} />
        </View>
      ) : !configured ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            WhatsApp connect isn&apos;t set up on this deployment yet — ask an admin to configure it.
          </Text>
        </View>
      ) : (
        <View style={styles.body}>
          {isRevoked ? (
            <Text style={styles.hint}>
              We recommend linking your existing WhatsApp Business App number (Coexistence) rather than
              starting fresh — you&apos;ll keep your chat history.
            </Text>
          ) : (
            connection && (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardTopLeft}>
                    <View style={styles.iconBadge}>
                      <ChannelsWhatsappIcon size={16} color="#25D366" />
                    </View>
                    <View>
                      <Text style={styles.phoneNumber}>{connection.displayPhoneNumber}</Text>
                      <Text style={styles.connectedAt}>
                        Connected {new Date(connection.connectedAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.statusPill, { color: statusLabel(connection).color }]}>
                    {statusLabel(connection).text}
                  </Text>
                </View>

                {connection.status === "TOKEN_EXPIRED" && (
                  <View style={styles.warningRow}>
                    <Text style={styles.warningIcon}>⚠</Text>
                    <Text style={styles.warningText}>
                      Meta says this connection needs reauthorizing — reconnect below to restore it.
                    </Text>
                  </View>
                )}

                {connection.status === "BANNED" && (
                  <View style={styles.warningRow}>
                    <Text style={styles.warningIcon}>⚠</Text>
                    <Text style={styles.warningText}>
                      Meta has disabled this number — the bot is paused. Check WhatsApp Manager on the web
                      for details.
                    </Text>
                  </View>
                )}

                <View style={styles.divider} />

                <View style={styles.toggleRow}>
                  <View style={styles.toggleTextWrap}>
                    <Text style={styles.toggleTitle}>{connection.isActive ? "Live" : "Paused"}</Text>
                    <Text style={styles.toggleSubtitle}>
                      {connection.isActive
                        ? "The bot replies automatically to incoming messages."
                        : "Messages still land in your Inbox, but the bot stays silent."}
                    </Text>
                  </View>
                  {togglePending ? (
                    <ActivityIndicator color={colors.muted} size="small" />
                  ) : (
                    <Switch
                      value={connection.isActive}
                      onValueChange={handleToggle}
                      trackColor={{ false: colors.card2, true: colors.orange }}
                      thumbColor={colors.white}
                    />
                  )}
                </View>

                <View style={styles.divider} />

                <Pressable onPress={() => setConfirmVisible(true)} style={styles.disconnectButton}>
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </Pressable>
              </View>
            )
          )}

          {isRevoked && (
            <Pressable style={styles.connectButton} onPress={handleConnect} disabled={opening}>
              {opening ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <ChannelsWhatsappIcon size={14} color={colors.white} />
                  <Text style={styles.connectButtonText}>
                    {connection ? "Reconnect WhatsApp" : "Connect WhatsApp"}
                  </Text>
                </>
              )}
            </Pressable>
          )}
          <Text style={styles.browserHint}>
            Opens in your browser — sign in there if asked, finish linking your number, then come back
            here.
          </Text>

          {error ? <Text style={styles.inlineError}>{error}</Text> : null}
        </View>
      )}

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Disconnect WhatsApp?</Text>
            <Text style={styles.modalBody}>
              This revokes Chatmeo&apos;s access to {connection?.displayPhoneNumber} and clears the stored
              connection. You&apos;ll need to redo Embedded Signup to reconnect.
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setConfirmVisible(false)} style={styles.modalCancel} disabled={disconnectPending}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleDisconnect} style={styles.modalConfirm} disabled={disconnectPending}>
                <Text style={styles.modalConfirmText}>{disconnectPending ? "Disconnecting…" : "Disconnect"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    color: colors.bad,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    textAlign: "center",
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  hint: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card2,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cardTopLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flexShrink: 1,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(37,211,102,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  phoneNumber: {
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
  },
  connectedAt: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    marginTop: 2,
  },
  statusPill: {
    fontFamily: fontFamily.semiBold,
    fontSize: 11,
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    marginTop: spacing.sm + 2,
  },
  warningIcon: {
    color: colors.bad,
    fontSize: 12,
    lineHeight: 16,
  },
  warningText: {
    flex: 1,
    color: colors.bad,
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: spacing.md,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  toggleTextWrap: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 13,
  },
  toggleSubtitle: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  disconnectButton: {
    alignSelf: "flex-start",
  },
  disconnectText: {
    color: colors.bad,
    fontFamily: fontFamily.semiBold,
    fontSize: 12.5,
  },
  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.orange,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
  },
  connectButtonText: {
    color: colors.white,
    fontFamily: fontFamily.semiBold,
    fontSize: 13.5,
  },
  browserHint: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  inlineError: {
    color: colors.bad,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    width: "100%",
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  modalTitle: {
    color: colors.text,
    fontFamily: fontFamily.bold,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  modalBody: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalCancel: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.card2,
  },
  modalCancelText: {
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 12.5,
  },
  modalConfirm: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.bad,
  },
  modalConfirmText: {
    color: colors.white,
    fontFamily: fontFamily.semiBold,
    fontSize: 12.5,
  },
});
