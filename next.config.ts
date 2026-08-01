import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse's pdfjs-dist dependency does top-level work that webpack's bundling of server
  // actions/RSC doesn't tolerate ("Object.defineProperty called on non-object"). Keeping it
  // external makes Next require() it directly at runtime instead of bundling it.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],

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
    ];
  },
};

export default nextConfig;
