import { Tabs } from "expo-router";
import { NavDashboardIcon, NavFlowsIcon, NavInboxIcon, NavSettingsIcon } from "@/components/icons";
import { colors } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

/** Standard (non-native) Tabs from expo-router — not the SDK 57 default template's experimental
 * NativeTabs, which renders platform-native chrome and can't be skinned with our own SVG icons or
 * exact brand colors. Same four destinations as the web app's own shell (Overview/Studio/Inbox,
 * plus Settings — the web app moves Settings behind the profile menu instead, but mobile has no
 * such menu yet, so it stays a tab for now). */
export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.orange2,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.line,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamily.medium,
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Overview",
          tabBarIcon: ({ color, size }) => <NavDashboardIcon size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="studio"
        options={{
          title: "Studio",
          tabBarIcon: ({ color, size }) => <NavFlowsIcon size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color, size }) => <NavInboxIcon size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <NavSettingsIcon size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
