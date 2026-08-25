import type { CapacitorConfig } from "@capacitor/cli";

// Chatmeo relies on server-side rendering and API routes (auth, Prisma, the WhatsApp webhook,
// the AI/Logic engine, etc.) that can't be shipped as a static bundle inside the native app the
// way a fully client-rendered SPA could — so this points the native shell at the live deployed
// server instead of loading anything from webDir (see www/index.html's own comment). Every
// screen the app renders is really the deployed site, just inside a native WebView frame.
const config: CapacitorConfig = {
  appId: "app.chatmeo.mobile",
  appName: "Chatmeo",
  webDir: "www",
  server: {
    // TODO: confirm this is the actual production domain before shipping a release build —
    // inferred from this deployment's own URLs (chatmeo.app), not independently verified.
    url: "https://chatmeo.app",
    cleartext: false,
  },
};

export default config;
