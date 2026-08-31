import { Stack } from "expo-router";
import { colors } from "@/theme/tokens";

/** Scopes inbox/index.tsx and inbox/[id].tsx into one Stack under the Inbox tab. Without this,
 * expo-router's file-based routing surfaces inbox/[id] as its own sibling route directly under
 * the parent Tabs navigator — which the Tabs then renders as an extra, undeclared tab button
 * (no icon, raw route name) instead of a pushed screen with real back/pop history. */
export default function InboxLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
