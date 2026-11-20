import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    // Audited upstream sources; checked by the mobile provenance verifier.
    "apps/mobile/vendor/**",
    "node_modules/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);
