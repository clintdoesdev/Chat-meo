import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse's pdfjs-dist dependency does top-level work that webpack's bundling of server
  // actions/RSC doesn't tolerate ("Object.defineProperty called on non-object"). Keeping it
  // external makes Next require() it directly at runtime instead of bundling it.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
