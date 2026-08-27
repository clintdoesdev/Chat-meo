import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { login as loginRequest } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { GradientButton } from "@/components/gradient-button";
import { MeoMark } from "@/components/meo-mark";
import { useAuthStore } from "@/store/auth";
import { colors, radius, spacing } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

type Step = "credentials" | "twoFactor";

/** Same two-step flow (credentials, then a 2FA code if the account has it enabled) as the Kotlin
 * app's LoginScreen/LoginViewModel and the web sign-in form — all three talk to the exact same
 * POST /api/v1/auth/login, so the account-level behavior (lockout, TOTP vs. email code) is
 * identical everywhere, only the UI differs. */
export default function LoginScreen() {
  const setSession = useAuthStore((state) => state.setSession);

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [twoFactorMethod, setTwoFactorMethod] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await loginRequest(
        email.trim(),
        password,
        step === "twoFactor" ? code.trim() : undefined,
      );
      if (response.token && response.user) {
        await setSession(response.token, response.user);
      } else if (response.requiresTwoFactor) {
        setStep("twoFactor");
        setTwoFactorMethod(response.method ?? "EMAIL");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <MeoMark size={40} />
          <Text style={styles.title}>Chatmeo</Text>
          <Text style={styles.subtitle}>
            {step === "credentials" ? "Sign in to keep building." : "Enter the code we sent you."}
          </Text>

          {step === "credentials" ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                style={styles.input}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={colors.muted}
                secureTextEntry
                autoComplete="password"
                style={styles.input}
              />
            </>
          ) : (
            <>
              <Text style={styles.hint}>
                {twoFactorMethod === "TOTP"
                  ? "Open your authenticator app for the code."
                  : "Check your email for the code."}
              </Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="Code"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                style={styles.input}
              />
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <GradientButton
            label={step === "credentials" ? "Sign in" : "Verify"}
            onPress={submit}
            loading={loading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamily.bold,
    fontSize: 24,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  hint: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 13,
  },
  input: {
    height: 50,
    borderRadius: radius.cardSm,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: 15,
  },
  error: {
    color: colors.bad,
    fontFamily: fontFamily.regular,
    fontSize: 13,
  },
});
