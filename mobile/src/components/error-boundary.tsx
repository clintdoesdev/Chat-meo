import { Component, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Catches a React render-time crash and shows the actual error on screen instead of React
 * Native's default in a release build: the whole app process just dies with no feedback at all —
 * exactly what "the app crashes on open" looks like to a user with no way to attach a debugger or
 * pull logcat. Doesn't catch errors outside React's render cycle (a broken native module at
 * startup, an unhandled promise rejection) — only an actual crash reporting/remote logging setup
 * would cover those, which this app doesn't have yet. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[ErrorBoundary] caught a render error", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Chatmeo hit a snag</Text>
          <Text style={styles.message}>{error.message || String(error)}</Text>
          {error.stack ? <Text style={styles.stack}>{error.stack}</Text> : null}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 60,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamily.bold,
    fontSize: 20,
  },
  message: {
    color: colors.bad,
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
  },
  stack: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 16,
  },
});
