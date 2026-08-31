import { Tabs } from "expo-router";
import { NavDashboardIcon, NavInboxIcon, NavSettingsIcon } from "@/components/icons";
import { colors } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

/** Standard (non-native) Tabs from expo-router — not the SDK 57 default template's experimental
 * NativeTabs, which renders platform-native chrome and can't be skinned with our own SVG icons or
 * exact brand colors. Three destinations: Overview, Inbox, Settings. Flow Studio is a real,
 * working route (studio/index.tsx, studio/[botId].tsx) but is deliberately kept off the tab bar
 * for now via href: null below rather than deleted — editing a bot's flow works fine from the web
 * Studio in the meantime, and this app has nothing that links into the mobile one anymore either. */
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
      <Tabs.Screen name="studio" options={{ href: null }} />
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
