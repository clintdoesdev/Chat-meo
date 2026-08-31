const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    ignores: ["dist/**"],
  },
  {
    // React Compiler's hooks rules assume every hook-returned value is an immutable,
    // compiler-managed snapshot and every ref is render-only — both false for
    // react-native-reanimated's SharedValue.value (the library's whole API is mutating it from
    // gesture worklets/event handlers) and for a plain ref used the same way alongside it. Scoped
    // to the one file that currently uses Reanimated's Gesture API rather than disabled
    // project-wide.
    files: ["src/components/studio/flow-canvas.tsx"],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
    },
  },
];
