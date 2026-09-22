import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Next/React Compiler rule flags normal mount loaders (void load() in useEffect).
      // Keep as warning until pages migrate to data libraries / Suspense patterns.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
