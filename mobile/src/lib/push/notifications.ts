import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken } from "@/lib/api/endpoints";
import { colors } from "@/theme/tokens";

const CHANNEL_ID = "chatmeo_messages";

// Foreground presentation — without this, a notification arriving while the app is open never
// shows anything (expo-notifications requires an explicit handler; there's no default).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  // Same channel id/importance as the retired Kotlin app and the web app's own push registration
  // — one consistent "Messages" channel across every Chatmeo surface that sends this kind of push.
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Messages",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: colors.orange,
  });
}

/** Every place this can stop short, reported back instead of swallowed — the original
 * implementation caught nothing, so a device-token or registration failure looked identical to
 * "working fine" from the app's own point of view. Surfaced on the Settings screen's
 * notifications card so a failure is visible without needing a computer + adb logcat. */
export type PushRegistrationStatus =
  | { state: "not-a-device" }
  | { state: "permission-denied" }
  | { state: "token-failed"; message: string }
  | { state: "register-failed"; message: string }
  | { state: "registered" };

export async function registerForPushNotifications(): Promise<PushRegistrationStatus> {
  if (!Device.isDevice) return { state: "not-a-device" }; // Emulators/simulators don't have real push tokens.

  await ensureNotificationChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return { state: "permission-denied" };

  let token: string;
  try {
    token = (await Notifications.getDevicePushTokenAsync()).data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[push] failed to get device token", { error });
    return { state: "token-failed", message };
  }

  try {
    await registerPushToken(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[push] failed to register token with server", { error });
    return { state: "register-failed", message };
  }

  return { state: "registered" };
}
