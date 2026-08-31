import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { reactInternalConfig } from "./react-internal.js";

/**
 * Shared Next.js app config. eslint-config-next ships native flat-config
 * arrays as of Next 16 — no FlatCompat bridge needed.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nextConfig = defineConfig([
  ...reactInternalConfig,
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default nextConfig;
