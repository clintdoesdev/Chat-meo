import type { Metadata } from "next";
import "./widget.css";

// A separate root layout (Next.js route groups support multiple parallel roots) — deliberately
// skips the dashboard's root layout.tsx: no next/font weights, no Lenis smooth-scroll, no
// ClickFeedback, no shared SVG defs. This is the public embed surface; its first paint
// shouldn't wait on any of that. System font stack instead of next/font for the same reason —
// one less network round trip on a page a stranger's browser is loading for the first time.
export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
