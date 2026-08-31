import type { NextConfig } from "next";

// Next 16 auto-optimizes lucide-react and other known packages, and
// Turbopack is the default bundler — no optimizePackageImports or
// webpack-specific config needed (see docs/memory/decisions).
const nextConfig: NextConfig = {
  transpilePackages: ["@repo/ui", "@repo/theme", "@repo/i18n", "@repo/settings", "@repo/rbac"],
};

export default nextConfig;
