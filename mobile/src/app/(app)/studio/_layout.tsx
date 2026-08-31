import { Stack } from "expo-router";
import { colors } from "@/theme/tokens";

/** Scopes studio/index.tsx and studio/[botId].tsx into one Stack — same reason as
 * inbox/_layout.tsx and settings/_layout.tsx. The Studio tab itself is currently hidden from the
 * tab bar (see the parent (app)/_layout.tsx's href: null on this route), but the nested Stack
 * still has to exist so studio/[botId] doesn't leak out as its own ghost tab regardless. */
export default function StudioLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
