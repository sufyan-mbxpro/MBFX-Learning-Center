import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Next.js only auto-loads .env from this app's OWN directory
// (apps/web/.env), not the monorepo root — but every package in this repo
// (packages/db's prisma.config.ts, vitest setups, etc.) reads the ONE root
// .env by convention. Loaded explicitly here, and early (next.config.ts
// runs before most of the rest of Next's startup), so BETTER_AUTH_SECRET
// and friends are actually present — confirmed the hard way: a build
// without this silently ran with Better Auth's insecure default secret.
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

// Next 16 auto-optimizes lucide-react and other known packages, and
// Turbopack is the default bundler — no optimizePackageImports or
// webpack-specific config needed (see docs/memory/decisions).
const nextConfig: NextConfig = {
  transpilePackages: [
    "@repo/ui",
    "@repo/theme",
    "@repo/i18n",
    "@repo/settings",
    "@repo/rbac",
    "@repo/auth",
    "@repo/db",
    "@repo/core",
    "@repo/utils",
  ],
  images: {
    // YouTube thumbnails for the video facade (ADR-015 #9) go through the
    // optimizer; admin-entered cover URLs render `unoptimized` instead of
    // allowlisting arbitrary hosts here.
    remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com" }],
  },
  // ADR-004: required for "use cache"/cacheTag/cacheLife (packages/theme,
  // packages/rbac) to do anything at all — without this flag they're a
  // build-time no-op, not an error, so it's easy to silently ship uncached.
  cacheComponents: true,
  experimental: {
    // ADR-017: image uploads arrive as Server Action FormData. Next's default
    // cap is 1 MB; MAX_UPLOAD_BYTES (@repo/core media) is 5 MB, plus the
    // multipart overhead the installed docs say to leave room for.
    serverActions: { bodySizeLimit: "6mb" },
    // ADR-006 (multiple root layouts) + Module 06's root layout living at a
    // dynamic [locale] segment are exactly the two cases Next's own
    // internationalization/not-found docs name as unable to compose a
    // consistent app/not-found.tsx from layouts alone — app/global-not-
    // found.tsx (self-contained, its own <html>) is the documented fix.
    globalNotFound: true,
  },
};

// Points at @repo/i18n's request config (packages/i18n/src/request.ts).
// Must be a relative path, not absolute — Turbopack's next-intl support
// rejects an absolute path here even though it resolves correctly.
const withNextIntl = createNextIntlPlugin("../../packages/i18n/src/request.ts");

export default withNextIntl(nextConfig);
