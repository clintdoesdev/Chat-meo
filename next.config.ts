import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The widget page is *meant* to be iframed by arbitrary third-party sites — Next sets
        // no X-Frame-Options by default, but we say so explicitly rather than relying on that
        // absence. Framing policy for the rest of the app is unaffected; this only applies here.
        source: "/widget/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
      {
        // Cached hard by every embedding site's browser and any CDN in front of us. Safe
        // because the embed snippet pins a ?v= query param (see WIDGET_SCRIPT_VERSION in
        // src/lib/embed-snippet.ts) — shipping a new loader means bumping that constant, which
        // is a new URL as far as caches are concerned, not overwriting a cached one in place.
        source: "/widget.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Browsers already re-check a service worker's byte-for-byte contents on every
        // navigation regardless of headers, but a stale cached copy served in between (a CDN,
        // an aggressive browser disk cache) delays that check — no-cache forces the freshness
        // check itself to always hit the origin, so a new sw.js (see public/sw.js) takes effect
        // on the very next page load instead of whenever the cached copy happens to expire.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        // The WhatsApp "Connect WhatsApp" button (bot settings → Deploy & channels) opens
        // Meta's Embedded Signup as a popup via the Facebook JS SDK, which needs a live
        // window.opener reference back to this tab to hand over the result — the default
        // Cross-Origin-Opener-Policy some hosts/security presets apply ("same-origin") silently
        // severs that link, so the popup finishes but this tab never hears about it.
        // "same-origin-allow-popups" keeps the isolation for same-origin cases while explicitly
        // permitting popups we open ourselves to retain that reference.
        source: "/app/:path*",
        headers: [{ key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }],
      },
    ];
  },
};

export default nextConfig;
