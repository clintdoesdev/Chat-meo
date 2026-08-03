import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig.json sets "jsx": "preserve" since Next's own SWC compiler does the real transform
  // for the app — Vite 8's default oxc transformer reads that same tsconfig and, seeing
  // "preserve", passes JSX through untouched instead of compiling it. Overriding it here just
  // for the test run is what actually lets .test.tsx files compile (the `esbuild` option is
  // ignored in this Vite version since oxc is the active transformer).
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
