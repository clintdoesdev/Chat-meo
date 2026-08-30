import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { sendTestPush as sendTestPushRequest, type PushTestResult } from "@/lib/api/endpoints";
import type { PushTestResponse } from "@/lib/api/types";
import { registerForPushNotifications, type PushRegistrationStatus } from "@/lib/push/notifications";
import { colors, radius, spacing } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

type CardState = { loading: boolean; result: PushRegistrationStatus | null };

function describeTestResult(result: PushTestResponse): string {
  const fcm = !result.fcm.configured
    ? "FCM: server has no Firebase key configured."
    : result.fcm.tokenCount === 0
      ? "FCM: no device token on file for this account."
      : result.fcm.sent > 0
        ? `FCM: sent to ${result.fcm.sent}/${result.fcm.tokenCount} device(s).`
        : `FCM: send failed — ${result.fcm.failed.map((f) => `${f.code ?? "error"}: ${f.message}`).join("; ")}`;

  const web = !result.webPush.configured
    ? "Web push: server has no VAPID keys configured."
    : result.webPush.subscriptionCount === 0
      ? "Web push: no browser subscription on file for this account."
      : result.webPush.sent > 0
        ? `Web push: sent to ${result.webPush.sent}/${result.webPush.subscriptionCount} subscription(s).`
        : `Web push: send failed — ${result.webPush.failed.map((f) => `${f.statusCode ?? "error"}: ${f.message}`).join("; ")}`;

  return `${fcm}\n${web}`;
}

const STATUS_COPY: Record<PushRegistrationStatus["state"], { label: string; ok: boolean }> = {
  registered: { label: "Notifications are on — new messages will alert this device.", ok: true },
  "not-a-device": { label: "Push tokens don't exist on emulators — this only works on a real phone.", ok: false },
  "permission-denied": {
    label: "Notification permission is off. Enable it for Chatmeo in your phone's system Settings, then try again.",
    ok: false,
  },
  "token-failed": { label: "Couldn't get a push token from this device.", ok: false },
  "register-failed": { label: "Got a push token, but couldn't save it to your account.", ok: false },
};

/** A real, working piece of Settings landing ahead of the rest of the screen (#18) — pulled
 * forward because "notifications don't work" is undiagnosable from outside the device without it.
 * Every failure mode registerForPushNotifications can return gets its own plain-language line
 * plus the raw error text, so the next report is a specific error instead of "not working." */
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

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Notifications</Text>
      {state.loading ? (
        <View style={styles.row}>
          <ActivityIndicator color={colors.muted} size="small" />
          <Text style={styles.rowText}>Checking…</Text>
        </View>
      ) : (
        <>
          <Text style={[styles.rowText, { color: copy?.ok ? colors.ok : colors.bad }]}>{copy?.label}</Text>
          {errorDetail ? <Text style={styles.errorDetail}>{errorDetail}</Text> : null}
          <Pressable style={styles.retryButton} onPress={check}>
            <Text style={styles.retryLabel}>Check again</Text>
          </Pressable>
        </>
      )}

      <View style={styles.divider} />

      <Pressable style={styles.retryButton} onPress={runTest} disabled={testState.loading}>
        <Text style={styles.retryLabel}>{testState.loading ? "Sending…" : "Send test push"}</Text>
      </Pressable>
      {testState.text ? <Text style={styles.errorDetail}>{testState.text}</Text> : null}
    </View>
  );
}

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.body}>
        <NotificationsCard />
        <Text style={styles.note}>Account, WhatsApp channel management, and sign out are coming next.</Text>
      </View>
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
  note: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    textAlign: "center",
  },
});
