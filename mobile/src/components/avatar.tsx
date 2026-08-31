import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text } from "react-native";
import { ActionsContactIcon } from "@/components/icons";
import { orangeGradient } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

/** No customer-photo field exists anywhere in the schema, so this is always the orange-gradient
 * fallback — either initials (for a real name, like a bot's) or a generic contact glyph (for a
 * WhatsApp visitorId, which is just the customer's raw phone number — slicing "2349035162263"
 * down to "23" isn't an initial, it's the country code, and it reads like an unread-count badge
 * next to one). Pass `isPhoneNumber` for any label that's an identifier rather than a name. */
export function Avatar({
  label,
  size = 44,
  isPhoneNumber = false,
}: {
  label: string;
  size?: number;
  isPhoneNumber?: boolean;
}) {
  const initials = label.replace(/^\+/, "").slice(0, 2).toUpperCase();
  return (
    <LinearGradient
      colors={orangeGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
    >
      {isPhoneNumber ? (
        <ActionsContactIcon size={size * 0.5} color="#ffffff" />
      ) : (
        <Text style={[styles.label, { fontSize: size * 0.36 }]}>{initials}</Text>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: "#ffffff",
    fontFamily: fontFamily.semiBold,
  },
});
