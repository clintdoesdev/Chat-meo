import { StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOnlineStatus } from "@/lib/net/use-online-status";
import { colors } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

/** A thin banner pinned under the status bar whenever the device has no usable connection —
 * this app has no offline cache or queued-write story, so every screen's data silently stops
 * updating and every action silently fails while offline with nothing else telling the user why. */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const insets = useSafeAreaInsets();
  if (isOnline) return null;

  return (
    <Text style={[styles.banner, { paddingTop: insets.top + 6 }]} pointerEvents="none">
      You&rsquo;re offline — some actions won&rsquo;t work
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: colors.bad,
    color: colors.white,
    fontFamily: fontFamily.semiBold,
    fontSize: 12,
    textAlign: "center",
    paddingBottom: 6,
  },
});
