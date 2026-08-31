# Monorepo configuration

> Revised 2026-08-31 per ADR-006 (single-app) and the Day-1 version sweep.

The mechanical setup. The non-obvious part is getting shadcn/ui to install
components into a shared package rather than into the app — covered in §4.
There is **one** app (`apps/web`, carrying both `(public)` and `(admin)`), so
anything below that used to be written twice is now written once.

---

## 1. `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"

# Hoist nothing implicitly. Every package declares what it uses, so moving a
# package to a mobile app later does not reveal hidden dependencies.

# pnpm 11 moved workspace-level settings out of package.json's "pnpm" field
# and into this file. Build scripts are opt-in: only these packages may run
# postinstall. Everything else is blocked, which is the default worth keeping.
onlyBuiltDependencies:
  - "@prisma/client"
  - "@prisma/engines"
  - "prisma"
  - "@node-rs/argon2"
  - "esbuild"
  - "sharp"

# Supply-chain hardening: refuse versions published less than a day ago.
minimumReleaseAge: 1440
```

`.npmrc` keeps only what pnpm 11 still reads from it — registry and auth
settings. If you find yourself adding behaviour flags there, they almost
certainly belong in this file now.

## 2. Root `package.json`

```jsonc
{
  "name": "forex-portal",
  "private": true,
  "packageManager": "pnpm@11.24.0",
  "engines": { "node": ">=24.0.0" }, // Node 24 LTS "Krypton"; 22 is maintenance-only
  "scripts": {
    // One app. `turbo dev` boots it on :3000 — public at /, admin at /admin.
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "format": "prettier --write \"**/*.{ts,tsx,md,json,mdx,css}\" --ignore-unknown",
    "format:check": "prettier --check \"**/*.{ts,tsx,md,json,mdx,css}\" --ignore-unknown",

    // Governance gates, run in CI and cheap enough to run locally.
    "governance:check": "node scripts/governance-check.mjs",
    "check:phantom-deps": "node scripts/check-phantom-deps.mjs",

    "db:generate": "pnpm --filter @repo/db generate",
    "db:migrate": "pnpm --filter @repo/db migrate:dev",
    "db:deploy": "pnpm --filter @repo/db migrate:deploy",
    "db:seed": "pnpm --filter @repo/db seed",
    "db:studio": "pnpm --filter @repo/db studio",
    "db:reset": "pnpm --filter @repo/db reset",

    "ui:add": "pnpm --filter @repo/ui shadcn:add",
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "turbo": "^2.10.12",
    "prettier": "^3.9.6",
    "eslint": "^10.9.1",
    "typescript": "6.0.3",
    "vitest": "^4.1.11",
  },
}
```

Two notes on that block.

**There is no `dev:admin`.** Under ADR-006 the admin is a route group in the
same app, not a second dev server. `pnpm dev` gives you both surfaces on one
port; `--filter` is still useful for package-level tasks, just not for
splitting web from admin.

**TypeScript is pinned exactly, not caret-ranged.** 6.0.3 is deliberate: TS 7's
native Go compiler has no stable programmatic API yet and breaks
typescript-eslint, so a caret range that drifts into 7.x would take the lint
pipeline down. The forthcoming ADR-010 records the reasoning and the exit
condition.

## 3. `turbo.json`

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "globalEnv": ["NODE_ENV"],
  "tasks": {
    "build": {
      // db#generate must finish before anything imports the Prisma client.
      "dependsOn": ["^build", "@repo/db#generate"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"],
      "env": [
        "DATABASE_URL",
        "REDIS_URL",
        "BETTER_AUTH_SECRET",
        "BETTER_AUTH_URL",
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GITHUB_CLIENT_ID",
        "GITHUB_CLIENT_SECRET",
        "NEXT_PUBLIC_SITE_URL",
        "NEXT_PUBLIC_ADMIN_URL",
        "S3_BUCKET",
        "S3_REGION",
        "MARKET_DATA_PROVIDER",
        "MARKET_DATA_API_KEY",
      ],
    },
    "dev": { "cache": false, "persistent": true, "dependsOn": ["@repo/db#generate"] },
    "lint": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build", "@repo/db#generate"] },
    "test": { "dependsOn": ["^build", "@repo/db#generate"], "outputs": ["coverage/**"] },
    "test:e2e": { "dependsOn": ["^build"], "cache": false },
    "@repo/db#generate": {
      "cache": true,
      "inputs": ["prisma/schema.prisma", "prisma.config.ts"],
      // Prisma 7's `prisma-client` generator writes to a custom output inside
      // the package, not to node_modules/.prisma. Point Turbo at the real path
      // or the cache will restore a build with no client in it.
      "outputs": ["src/generated/client/**"],
    },
  },
}
```

`dev`, `typecheck` and `test` all depend on `@repo/db#generate` for the same
reason `build` does: with a custom Prisma output, nothing type-checks until the
client has been written.

Remote caching (`turbo login && turbo link`) still pays off — package-level
tasks and the Prisma client generation cache cleanly across machines and CI.
What it no longer buys is app isolation: with one app (ADR-006), a change under
`(admin)` and a change under `(public)` invalidate the same `build` task. That
is the deploy-cadence cost named in `MONOREPO_ARCHITECTURE.md §1.1`.

---

## 4. shadcn/ui in a shared package

The shadcn CLI (`shadcn@latest`, v4.x) has native monorepo support and will
detect a workspace, but detection is not the same as deciding: you still have
to say _where_ components live. The answer here is once, in `packages/ui`,
consumed by both route groups of `apps/web` — and later by nothing else, since
`@repo/ui` stays web-only (§9).

### `packages/ui/components.json`

```jsonc
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "", // Tailwind v4.3 — no JS config; @theme lives in CSS
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true, // required; this is what makes theming dynamic
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@repo/ui/components",
    "utils": "@repo/ui/lib/utils",
    "ui": "@repo/ui/components/ui",
    "hooks": "@repo/ui/hooks",
    "lib": "@repo/ui/lib",
  },
}
```

Adding a component:

```bash
pnpm --filter @repo/ui dlx shadcn@latest add button dialog table
```

### `packages/ui/package.json`

```jsonc
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  // Granular exports so importing Button does not pull in the data table
  // and its TanStack dependency.
  "exports": {
    "./globals.css": "./src/styles/globals.css",
    "./lib/*": "./src/lib/*.ts",
    "./hooks/*": "./src/hooks/*.ts",
    "./*": "./src/components/*.tsx",
  },
  "scripts": {
    "shadcn:add": "pnpm dlx shadcn@latest add",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
  },
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "lucide-react": "^0.468.0",
    "@radix-ui/react-slot": "^1.1.1",
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
  },
}
```

Those granular exports are load-bearing under ADR-006, not just tidy. With one
app, `(public)` and `(admin)` share a dependency graph, so a barrel export
would let a public page importing `Button` drag TanStack Table into a bundle
judged on Core Web Vitals. One entry point per component keeps the split honest;
the ESLint import-boundary rule and the blocking Lighthouse budget catch what
slips.

Usage from either route group:

```tsx
import { Button } from "@repo/ui/button"; // (public) and (admin)
import { DataTable } from "@repo/ui/data-table"; // (admin) only, by rule
```

### Transpiling in the app

```ts
// apps/web/next.config.ts
const config: NextConfig = {
  transpilePackages: ["@repo/ui", "@repo/theme", "@repo/i18n", "@repo/settings", "@repo/rbac"],
  experimental: { optimizePackageImports: ["lucide-react"] },
  images: {
    remotePatterns: [{ protocol: "https", hostname: process.env.S3_PUBLIC_HOST! }],
  },
};
```

Tailwind must scan the package source, which is what this line in the app's
`globals.css` does — one stylesheet, imported by both root layouts:

```css
@source "../../../packages/ui/src/**/*.{ts,tsx}";
```

Without it, classes used only inside `@repo/ui` are stripped from the build
and components render unstyled.

---

## 5. `packages/db/package.json`

```jsonc
{
  "name": "@repo/db",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "generate": "prisma generate",
    "migrate:dev": "prisma migrate dev",
    "migrate:deploy": "prisma migrate deploy",
    "seed": "tsx prisma/seed.ts",
    "studio": "prisma studio",
    "reset": "prisma migrate reset --force",
  },
  // No "prisma" field here. In Prisma 7 the seed command and datasource wiring
  // move to prisma.config.ts (below); a leftover package.json block is ignored.
  "dependencies": {
    "@prisma/client": "^7.10.0",
    "@prisma/adapter-mariadb": "^7.10.0",
    "@node-rs/argon2": "^2.0.2",
  },
  "devDependencies": {
    "prisma": "^7.10.0",
    "tsx": "^4.19.0",
  },
}
```

### Prisma 7 schema and config

Three things changed shape in Prisma 7 and all three bite if you carry a v6
schema forward.

```prisma
// packages/db/prisma/schema.prisma
generator client {
  provider = "prisma-client"              // not "prisma-client-js"
  output   = "../src/generated/client"    // required — no implicit node_modules
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
  // relationMode = "prisma" is REMOVED. This is self-hosted MariaDB, so real
  // foreign keys are available and the database should enforce them.
}
```

```ts
// packages/db/prisma.config.ts
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { seed: "tsx prisma/seed.ts" },
});
```

The custom `output` is what Turbo's `@repo/db#generate` outputs glob has to
match (§3). Emitting into the package rather than into `node_modules` is the
better default anyway: the generated client is a build artifact of _this_
package, and treating it as one makes caching and `.gitignore` obvious.

### Client singleton

```ts
// packages/db/src/index.ts
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/client/client.js";

// Next.js dev server hot-reloads modules; without this you exhaust the
// connection pool within a few saves.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaMariaDb({ connectionString: process.env.DATABASE_URL! });

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Types and enums come from the generated output now, not from "@prisma/client".
export * from "./generated/client/client.js";
```

Everything else in the repo imports `@repo/db` and never the generated path
directly, so moving the output later is a one-file change.

---

## 6. i18n routing

```ts
// packages/i18n/src/routing.ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ur", "ar", "es"],
  defaultLocale: "en",
  // Default locale has no prefix: "/" not "/en". Keeps existing English URLs
  // stable and avoids a redirect hop on the highest-traffic path.
  localePrefix: "as-needed",
});
```

```ts
// apps/web/proxy.ts   ← Next.js 16 renamed middleware.ts to proxy.ts
import createMiddleware from "next-intl/middleware";
import { routing } from "@repo/i18n/routing";

const intl = createMiddleware(routing);

export default function proxy(request: Request) {
  // /admin/* is not locale-prefixed and does not go through next-intl.
  // It gets the STAFF gate instead — see MONOREPO_ARCHITECTURE.md §5.3/§6.3.
  // Both concerns live in this one file because there is one app (ADR-006).
  return intl(request);
}

export const config = {
  // Excludes /api, /_next, static files — and /admin, which must never be
  // locale-prefixed. The STAFF gate matches /admin separately, above.
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)", "/admin/:path*"],
};
```

One file, two jobs. That is a consequence of the single-app decision: the
locale rules for `(public)` and the `userType !== "STAFF"` gate for `(admin)`
are both request-time concerns on the same origin, so they are both here. The
gate runs before any route or layout, and the `(admin)` layout re-checks it —
the proxy is a gate, not the boundary.

The active locale list is seeded in the database so an admin can enable one
without a deploy. `routing` reads the build-time list; a locale enabled at
runtime is served dynamically until the next build folds it into static
generation. That trade-off is worth naming: enabling a locale is instant, but
its pages are dynamic until redeployed.

---

## 7. Environment

`.env.example`, committed. Real values never are.

```bash
DATABASE_URL="mysql://user:pass@localhost:3306/forex_portal"
REDIS_URL="redis://localhost:6379"

BETTER_AUTH_SECRET=""             # openssl rand -base64 32
BETTER_AUTH_URL="http://localhost:3000"

GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

NEXT_PUBLIC_SITE_URL="http://localhost:3000"
# Admin is a path on the same origin, not a second host (ADR-006). Override
# only if a reverse proxy later fronts the same app at admin.<domain>.
NEXT_PUBLIC_ADMIN_URL="http://localhost:3000/admin"

S3_BUCKET=""
S3_REGION=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_PUBLIC_HOST=""

MARKET_DATA_PROVIDER="alphavantage"
MARKET_DATA_API_KEY=""

# Seed only. Omit in production and force a reset on first login instead.
SEED_ADMIN_EMAIL="admin@mbxpro.com"
SEED_ADMIN_PASSWORD=""
```

---

## 8. First run

```bash
pnpm install                  # pnpm 11.24, Node 24 LTS
cp .env.example .env          # fill in DATABASE_URL and BETTER_AUTH_SECRET
pnpm db:generate              # writes packages/db/src/generated/client
pnpm db:migrate
pnpm db:seed
pnpm dev                      # one app on :3000 — public at /, admin at /admin
```

There is no second port to remember. If you were expecting `:3001`, that was
the two-app layout; see ADR-006.

---

## 9. Adding mobile later

`apps/web` is not touched. Mobile arrives as a **sibling**, not as a change to
the existing app — which is the whole reason the packages-first structure
survived the single-app decision intact.

```
apps/
├── web/                # unchanged
├── mobile/             # Expo
│     └── imports: @repo/contracts, @repo/i18n, @repo/theme (tokens only),
│                  @repo/core (via the API), packages/ui-native
│         talks to: /api/v1/* with bearer tokens from @repo/auth
└── desktop/            # later still — Tauri or Electron, same package diet
```

The theme package exports raw token objects alongside the CSS serialiser, so
React Native reads the same `BrandTokens` and applies them through its own
styling layer. One source of brand truth, two renderers.

`@repo/ui` is web-only by design — sharing component code across web and
native produces the worst of both. Sharing tokens, contracts, and translations
is where the actual leverage is.

React Native components therefore go in a **new** package, `packages/ui-native`,
sitting beside `@repo/ui` and consuming the same `@repo/theme` tokens. The rule
that makes this work is negative: never make a shared package depend on Next.js
to serve the web app, and never bend `@repo/ui` toward React Native to serve
mobile. A shared package that imports `next/*` is a package mobile cannot use,
and that is how the second platform turns back into a rewrite.
