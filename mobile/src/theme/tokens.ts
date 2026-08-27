/**
 * Design tokens mirrored exactly from the web app's own CSS custom properties
 * (src/app/globals.css in the main repo) — not approximated, so the mobile app reads as the same
 * product rather than a "mobile-native reinterpretation." Chatmeo is dark-only by design (no
 * light theme toggle anywhere in the product), so these are the only palette this app needs.
 */
export const colors = {
  bg: "#0a0a0a",
  card: "#141414",
  card2: "#1b1b1b",
  line: "rgba(255, 255, 255, 0.07)",
  line2: "rgba(255, 255, 255, 0.12)",
  orange: "#ff5c16",
  orange2: "#ff8a3c",
  text: "#f5f5f5",
  muted: "#8f8f8f",
  ok: "#4ed88e",
  bad: "#ff5757",
  white: "#ffffff",
} as const;

export const radius = {
  card: 18,
  cardSm: 16,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/** The brand's orange gradient (CTA buttons, avatar-initial fallbacks) — used via
 * <LinearGradient colors={[...orangeGradient]} start={...} end={...}> from expo-linear-gradient.
 * Not in the brief's explicit dependency list; added anyway (flagged here) since faking a
 * signature brand element as a flat color would be a more obvious design regression than one
 * extra first-party Expo SDK package. */
export const orangeGradient = [colors.orange, colors.orange2] as const;

