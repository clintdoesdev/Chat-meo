import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, orangeGradient, radius } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

type GradientButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

/** The one CTA style used everywhere Chatmeo needs a primary action button — orange gradient,
 * matching the web app's .btn-primary / the Kotlin app's bg-grad-orange. */
export function GradientButton({ label, onPress, loading, disabled }: GradientButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable onPress={onPress} disabled={isDisabled} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
      <LinearGradient
        colors={orangeGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.button, isDisabled && styles.disabled]}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    color: colors.white,
    fontFamily: fontFamily.semiBold,
    fontSize: 15,
  },
});
