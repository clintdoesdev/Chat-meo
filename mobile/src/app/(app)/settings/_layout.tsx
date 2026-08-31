import { Stack } from "expo-router";
import { colors } from "@/theme/tokens";

/** Scopes settings/index.tsx and the whole settings/whatsapp/* subtree into one Stack under the
 * Settings tab — see inbox/_layout.tsx for why this is required, not optional: without it,
 * settings/whatsapp/index and settings/whatsapp/[botId] each surface as their own extra,
 * undeclared tab instead of screens pushed onto Settings' own back history. */
export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
