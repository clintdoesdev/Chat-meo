import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { ClickFeedback } from "@/components/click-feedback";
import { SharedDefs } from "@/components/shared-defs";
import { SmoothScroll } from "@/components/smooth-scroll";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Chatmeo — Intelligent Chatbots. Powered by Meo.",
  description:
    "Chatmeo is a visual chatbot builder. Design flows, drop in AI, and ship bots your visitors actually want to talk to.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full`}>
      <body className="min-h-full bg-bg text-text antialiased">
        <SharedDefs />
        <SmoothScroll />
        {children}
        <ClickFeedback />
      </body>
    </html>
  );
}
