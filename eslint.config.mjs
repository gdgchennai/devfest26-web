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
    // Cloudflare/OpenNext build output (created by `npm run preview` / `deploy`) and
    // local Wrangler state. Bundled JS, not source: linting it runs Node out of memory.
    ".open-next/**",
    ".wrangler/**",
    // Standalone workers — not part of the app, linted/typechecked on their own.
    "workers/**",
  ]),
]);

export default eslintConfig;
