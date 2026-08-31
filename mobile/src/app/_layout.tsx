import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { OfflineBanner } from "@/components/offline-banner";
import { registerForPushNotifications } from "@/lib/push/notifications";
import { colors } from "@/theme/tokens";
import { useAppFonts } from "@/theme/fonts";
import { useAuthStore } from "@/store/auth";

SplashScreen.preventAutoHideAsync();

/** Root layout: holds the splash screen up until both fonts and the persisted session
 * (SecureStore, via the auth store's hydrate()) are ready, then routes to either the login screen
 * or the authenticated tab shell via Stack.Protected's guard prop — the current, stable
 * expo-router pattern for this (declarative, and it cleans up navigation history automatically
 * when a screen's guard flips, unlike a manual <Redirect> effect). */
export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded] = useAppFonts();
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const token = useAuthStore((state) => state.token);
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const ready = fontsLoaded && isHydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Covers a device token issued (or refreshed) while the app had no active session to register
  // it against yet — cheap no-op otherwise. Login itself registers again right after success,
  // same two-call-site pattern the Kotlin app used for the same reason.
  useEffect(() => {
    if (ready && token) registerForPushNotifications();
  }, [ready, token]);

  // Tapping a notification just opens the Inbox — no deep-link to the specific conversation yet,
  // same deliberately-scoped choice the Kotlin app made.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      router.push("/inbox");
    });
    return () => subscription.remove();
  }, [router]);

  if (!ready) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="light" />
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Protected guard={!token}>
            <Stack.Screen name="login" />
          </Stack.Protected>
          <Stack.Protected guard={!!token}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
        </Stack>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
