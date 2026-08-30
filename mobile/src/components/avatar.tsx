import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text } from "react-native";
import { orangeGradient } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

/** No customer-photo field exists anywhere in the schema (a WhatsApp visitorId is just a phone
 * number, a widget visitorId a generated id) — so this is always the orange-gradient
 * initials fallback the brief describes, never a real photo. Takes whatever identifying string
 * the row has (name, phone number, visitor id) and shows its first couple of characters. */
export function Avatar({ label, size = 44 }: { label: string; size?: number }) {
  const initials = label.replace(/^\+/, "").slice(0, 2).toUpperCase();
  return (
    <LinearGradient
      colors={orangeGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.label, { fontSize: size * 0.36 }]}>{initials}</Text>
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
