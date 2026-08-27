import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/dm-sans";

/** DM Sans is the web app's own font (next/font/google in src/app/(main)/layout.tsx) — loaded
 * here via @expo-google-fonts rather than bundling .ttf files by hand, same font family and the
 * same weight range the web app actually uses (400/500/600/700/800). */
export const fontFamily = {
  regular: "DMSans_400Regular",
  medium: "DMSans_500Medium",
  semiBold: "DMSans_600SemiBold",
  bold: "DMSans_700Bold",
  extraBold: "DMSans_800ExtraBold",
} as const;

export function useAppFonts() {
  return useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
  });
}
