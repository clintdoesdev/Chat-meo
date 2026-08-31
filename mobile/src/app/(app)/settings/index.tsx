import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "@/components/avatar";
import { ChannelsWhatsappIcon } from "@/components/icons";
import { sendTestPush as sendTestPushRequest, type PushTestResult } from "@/lib/api/endpoints";
import type { PushTestResponse } from "@/lib/api/types";
import {
  registerForPushNotifications,
  unregisterForPushNotifications,
  type PushRegistrationStatus,
} from "@/lib/push/notifications";
import { useAuthStore } from "@/store/auth";
import { colors, radius, spacing } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

type ToggleState = PushRegistrationStatus | { state: "disabled" };
type CardState = { loading: boolean; result: ToggleState | null };

function describeTestResult(result: PushTestResponse): string {
  const fcm = !result.fcm.configured
    ? result.fcm.configError
      ? `FCM: Firebase key is set but invalid — ${result.fcm.configError}`
      : "FCM: server has no Firebase key configured."
    : result.fcm.tokenCount === 0
      ? "FCM: no device token on file for this account."
      : result.fcm.sent > 0
        ? `FCM: sent to ${result.fcm.sent}/${result.fcm.tokenCount} device(s).`
        : `FCM: send failed — ${result.fcm.failed.map((f) => `${f.code ?? "error"}: ${f.message}`).join("; ")}`;

  const web = !result.webPush.configured
    ? result.webPush.configError
      ? `Web push: VAPID keys are set but invalid — ${result.webPush.configError}`
      : "Web push: server has no VAPID keys configured."
    : result.webPush.subscriptionCount === 0
      ? "Web push: no browser subscription on file for this account."
      : result.webPush.sent > 0
        ? `Web push: sent to ${result.webPush.sent}/${result.webPush.subscriptionCount} subscription(s).`
        : `Web push: send failed — ${result.webPush.failed.map((f) => `${f.statusCode ?? "error"}: ${f.message}`).join("; ")}`;

  return `${fcm}\n${web}`;
}

const STATUS_COPY: Record<ToggleState["state"], { label: string; tone: "ok" | "bad" | "neutral" }> = {
  registered: { label: "New messages will alert this device.", tone: "ok" },
  disabled: { label: "Notifications are off for this device.", tone: "neutral" },
  "not-a-device": { label: "Push tokens don't exist on emulators — this only works on a real phone.", tone: "bad" },
  "permission-denied": {
    label: "Notification permission is off. Enable it for Chatmeo in your phone's system Settings, then try again.",
    tone: "bad",
  },
  "token-failed": { label: "Couldn't get a push token from this device.", tone: "bad" },
  "register-failed": { label: "Got a push token, but couldn't save it to your account.", tone: "bad" },
};

const TONE_COLOR: Record<"ok" | "bad" | "neutral", string> = {
  ok: colors.ok,
  bad: colors.bad,
  neutral: colors.muted,
};

/** A real, working piece of Settings landing ahead of the rest of the screen (#18) — pulled
 * forward because "notifications don't work" is undiagnosable from outside the device without it.
 * The switch is the user's own on/off control (mirrors the web app's bell-menu toggle) rather
 * than the previous auto-register-only behavior; every failure mode still gets its own
 * plain-language line plus the raw error text underneath. */
function NotificationsCard() {
  const [state, setState] = useState<CardState>({ loading: true, result: null });
  const [testState, setTestState] = useState<{ loading: boolean; text: string | null }>({
    loading: false,
    text: null,
  });

  const check = useCallback(() => {
    setState({ loading: true, result: null });
    registerForPushNotifications().then((result) => setState({ loading: false, result }));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState only runs after check()'s internal await, same pattern as inbox/index.tsx's fetch-on-mount effect
    check();
  }, [check]);

  function handleToggle(value: boolean) {
    if (state.loading) return;
    if (value) {
      check();
      return;
    }
    setState({ loading: true, result: null });
    unregisterForPushNotifications().then((result) => {
      setState({ loading: false, result: result.ok ? { state: "disabled" } : { state: "register-failed", message: result.message ?? "Couldn't turn off notifications." } });
    });
  }

  function runTest() {
    setTestState({ loading: true, text: null });
    sendTestPushRequest()
      .then((response: PushTestResult) => {
        if (response.ok) {
          setTestState({ loading: false, text: describeTestResult(response.result) });
        } else {
          const snippet = response.bodyText.slice(0, 300);
          setTestState({ loading: false, text: `HTTP ${response.status} — ${snippet}` });
        }
      })
      .catch((error) => setTestState({ loading: false, text: `Request failed — ${error instanceof Error ? error.message : String(error)}` }));
  }

  const copy = state.result ? STATUS_COPY[state.result.state] : null;
  const errorDetail =
    state.result && (state.result.state === "token-failed" || state.result.state === "register-failed")
      ? state.result.message
      : null;
  const isOn = state.result?.state === "registered";

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>Notifications</Text>
        {state.loading ? (
          <ActivityIndicator color={colors.muted} size="small" />
        ) : (
          <Switch
            value={isOn}
            onValueChange={handleToggle}
            trackColor={{ false: colors.card2, true: colors.orange }}
            thumbColor={colors.white}
          />
        )}
      </View>
      {!state.loading && copy ? (
        <>
          <Text style={[styles.rowText, { color: TONE_COLOR[copy.tone] }]}>{copy.label}</Text>
          {errorDetail ? <Text style={styles.errorDetail}>{errorDetail}</Text> : null}
        </>
      ) : null}

      <View style={styles.divider} />

      <Pressable style={styles.retryButton} onPress={runTest} disabled={testState.loading}>
        <Text style={styles.retryLabel}>{testState.loading ? "Sending…" : "Send test push"}</Text>
      </Pressable>
      {testState.text ? <Text style={styles.errorDetail}>{testState.text}</Text> : null}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [confirmVisible, setConfirmVisible] = useState(false);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.body}>
        {user && (
          <View style={styles.accountCard}>
            <Avatar label={user.name || user.email} size={44} />
            <View style={styles.accountText}>
              <Text style={styles.accountName} numberOfLines={1}>
                {user.name || "Your account"}
              </Text>
              <Text style={styles.accountEmail} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
          </View>
        )}

        <NotificationsCard />

        <Pressable style={styles.linkCard} onPress={() => router.push("/settings/whatsapp")}>
          <View style={styles.linkIconBadge}>
            <ChannelsWhatsappIcon size={16} color="#25D366" />
          </View>
          <View style={styles.linkTextWrap}>
            <Text style={styles.linkTitle}>WhatsApp channels</Text>
            <Text style={styles.linkSubtitle}>Connect, pause, or disconnect a bot&apos;s WhatsApp number</Text>
          </View>
          <Text style={styles.linkChevron}>›</Text>
        </Pressable>

        <Pressable style={styles.signOutButton} onPress={() => setConfirmVisible(true)}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sign out?</Text>
            <Text style={styles.modalBody}>You&apos;ll need to sign in again to access your bots and inbox.</Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setConfirmVisible(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setConfirmVisible(false);
                  logout();
                }}
                style={styles.modalConfirm}
              >
                <Text style={styles.modalConfirmText}>Sign out</Text>
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
  title: {
    color: colors.text,
    fontFamily: fontFamily.bold,
    fontSize: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowText: {
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    flexShrink: 1,
  },
  errorDetail: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: spacing.xs,
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.cardSm,
    backgroundColor: colors.card2,
  },
  retryLabel: {
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 13,
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  accountText: {
    flex: 1,
    gap: 2,
  },
  accountName: {
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 15,
  },
  accountEmail: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
  },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  linkIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(37,211,102,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  linkTextWrap: {
    flex: 1,
    gap: 2,
  },
  linkTitle: {
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
  },
  linkSubtitle: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    lineHeight: 15,
  },
  linkChevron: {
    color: colors.muted,
    fontSize: 20,
  },
  signOutButton: {
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: "rgba(255,87,87,0.3)",
  },
  signOutText: {
    color: colors.bad,
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
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
