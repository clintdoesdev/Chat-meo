import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/generated/**",
      // Separate self-contained projects with their own tooling (mobile/'s own ESLint config via
      // `expo lint`, android/ has no JS/TS at all) — same reasoning as excluding them from
      // tsconfig.json above.
      "android/**",
      "mobile/**",
    ],
  },
];

export default eslintConfig;
