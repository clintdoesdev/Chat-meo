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

/** Requests permission (if needed) and registers this device's FCM token with the backend via
 * the existing POST /api/v1/push/register — same endpoint the Kotlin app used, same DeviceToken
 * table, same src/lib/push/fcm.ts send path server-side. Called on startup for an already-signed-
 * in user and right after a successful login, since a token can exist before either of those
 * (Android issues one at install time). Best-effort throughout: a declined permission or a failed
 * registration call just means no push notifications, never a broken app. */
export async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) return; // Emulators/simulators don't have real push tokens.

  await ensureNotificationChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  const { data: token } = await Notifications.getDevicePushTokenAsync();
  await registerPushToken(token).catch(() => {
    // Fire-and-forget, same as every other push-registration path in this app.
  });
}
