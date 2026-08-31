import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { login as loginRequest } from "@/lib/api/endpoints";
import { ApiError, API_BASE_URL } from "@/lib/api/client";
import { ActionsEyeIcon, ActionsEyeOffIcon } from "@/components/icons";
import { GradientButton } from "@/components/gradient-button";
import { MeoMark } from "@/components/meo-mark";
import { registerForPushNotifications } from "@/lib/push/notifications";
import { useAuthStore } from "@/store/auth";
import { colors, radius, spacing } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

type Mode = "in" | "up";
type Step = "credentials" | "twoFactor";
type FieldErrors = { email?: string; password?: string; code?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same two-step flow (credentials, then a 2FA code if the account has it enabled) as the Kotlin
 * app's LoginScreen/LoginViewModel and the web sign-in form — all three talk to the exact same
 * POST /api/v1/auth/login, so the account-level behavior (lockout, TOTP vs. email code) is
 * identical everywhere, only the UI differs. The "Create account" mode mirrors the web app's own
 * SignInCard: Chatmeo is closed-beta right now, so it's a real, accurate message rather than a
 * signup form that goes nowhere. */
export default function LoginScreen() {
  const setSession = useAuthStore((state) => state.setSession);

  const [mode, setMode] = useState<Mode>("in");
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [twoFactorMethod, setTwoFactorMethod] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function validateCredentials(): boolean {
    const errors: FieldErrors = {};
    if (!email.trim()) errors.email = "Email is required.";
    else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Password is required.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateCode(): boolean {
    const errors: FieldErrors = code.trim() ? {} : { code: "Enter the code." };
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit() {
    if (loading) return;
    if (step === "credentials" ? !validateCredentials() : !validateCode()) return;
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
        registerForPushNotifications();
      } else if (response.requiresTwoFactor) {
        setStep("twoFactor");
        setTwoFactorMethod(response.method ?? "EMAIL");
        setFieldErrors({});
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        bottomOffset={40}
        keyboardShouldPersistTaps="handled"
      >
        <MeoMark size={40} />
        <Text style={styles.title}>Chatmeo</Text>
        <Text style={styles.subtitle}>
          {step === "twoFactor"
            ? "Enter the code we sent you."
            : mode === "in"
              ? "Sign in to keep building."
              : "Sign up is closed for now."}
        </Text>

        {step === "credentials" && (
          <View style={styles.modeSwitch}>
            <Pressable
              onPress={() => {
                setMode("in");
                setError(null);
              }}
              style={[styles.modeButton, mode === "in" && styles.modeButtonActive]}
            >
              <Text style={[styles.modeButtonText, mode === "in" && styles.modeButtonTextActive]}>Sign in</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMode("up");
                setError(null);
              }}
              style={[styles.modeButton, mode === "up" && styles.modeButtonActive]}
            >
              <Text style={[styles.modeButtonText, mode === "up" && styles.modeButtonTextActive]}>
                Create account
              </Text>
            </Pressable>
          </View>
        )}

        {step === "credentials" && mode === "up" ? (
          <View style={styles.closedBeta}>
            <Text style={styles.closedBetaText}>
              We&apos;re not letting new people in just yet — reach out if you&apos;d like early access,
              and check back once the beta opens up.
            </Text>
            <GradientButton label="Sign in instead" onPress={() => setMode("in")} />
          </View>
        ) : step === "credentials" ? (
          <>
            <View style={styles.field}>
              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }));
                }}
                placeholder="Email"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                style={[styles.input, fieldErrors.email && styles.inputError]}
              />
              {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}
            </View>

            <View style={styles.field}>
              <View style={styles.passwordRow}>
                <TextInput
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined }));
                  }}
                  placeholder="Password"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  textContentType="password"
                  style={[styles.input, styles.passwordInput, fieldErrors.password && styles.inputError]}
                />
                <Pressable
                  onPress={() => setShowPassword((value) => !value)}
                  hitSlop={10}
                  style={styles.passwordToggle}
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <ActionsEyeOffIcon size={18} color={colors.muted} />
                  ) : (
                    <ActionsEyeIcon size={18} color={colors.muted} />
                  )}
                </Pressable>
              </View>
              {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}
            </View>

            <Pressable
              onPress={() => WebBrowser.openBrowserAsync(`${API_BASE_URL}/forgot-password`)}
              style={styles.forgotLink}
            >
              <Text style={styles.forgotLinkText}>Forgot password?</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.hint}>
              {twoFactorMethod === "TOTP"
                ? "Open your authenticator app for the code."
                : "Check your email for the code."}
            </Text>
            <View style={styles.field}>
              <TextInput
                value={code}
                onChangeText={(value) => {
                  setCode(value);
                  if (fieldErrors.code) setFieldErrors((current) => ({ ...current, code: undefined }));
                }}
                placeholder="Code"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                style={[styles.input, fieldErrors.code && styles.inputError]}
              />
              {fieldErrors.code ? <Text style={styles.fieldError}>{fieldErrors.code}</Text> : null}
            </View>
            <Pressable
              onPress={() => {
                setStep("credentials");
                setCode("");
                setError(null);
                setFieldErrors({});
              }}
            >
              <Text style={styles.forgotLinkText}>Back to sign in</Text>
            </Pressable>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!(step === "credentials" && mode === "up") && (
          <GradientButton
            label={step === "credentials" ? "Sign in" : "Verify"}
            onPress={submit}
            loading={loading}
          />
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
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
  modeSwitch: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    marginBottom: spacing.sm,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: colors.card2,
  },
  modeButtonText: {
    color: colors.muted,
    fontFamily: fontFamily.semiBold,
    fontSize: 13.5,
  },
  modeButtonTextActive: {
    color: colors.text,
  },
  closedBeta: {
    gap: spacing.lg,
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  closedBetaText: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  hint: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 13,
  },
  field: {
    gap: spacing.xs,
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
  inputError: {
    borderColor: colors.bad,
  },
  fieldError: {
    color: colors.bad,
    fontFamily: fontFamily.regular,
    fontSize: 12,
  },
  passwordRow: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: spacing.xl + spacing.lg,
  },
  passwordToggle: {
    position: "absolute",
    right: spacing.lg,
  },
  forgotLink: {
    alignSelf: "flex-end",
  },
  forgotLinkText: {
    color: colors.orange2,
    fontFamily: fontFamily.semiBold,
    fontSize: 12.5,
  },
  error: {
    color: colors.bad,
    fontFamily: fontFamily.regular,
    fontSize: 13,
  },
});
