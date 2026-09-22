import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { e2eDatabaseUrl, SOURCE_URL_VAR } from "./e2e/database.ts";

// E2E harness (testing.md: "Playwright — E2E for both surfaces of the single
// app"). This is the first Playwright setup in the repo; every module until
// now has said "E2E deferred".
//
// ISOLATION IS THE POINT. These tests run against their own database
// (`E2E_DATABASE_NAME`, default `mbfx_e2e`), created, migrated and seeded by
// `e2e/global-setup.ts`. They never touch the development database — a suite
// that truncates the DB you were working in is worse than no suite.
//
// The web server is started by Playwright itself on a separate port with that
// DATABASE_URL injected, so a dev server already running on :3000 against the
// dev database is unaffected and can stay up.

// Playwright transpiles this config to CommonJS, so `import.meta` is not
// available here — `__dirname` is.
loadEnv({ path: path.resolve(__dirname, "../../.env") });

const PORT = Number(process.env.E2E_PORT ?? 3100);
// `localhost`, not `127.0.0.1`: Next dev treats the two as different origins
// and BLOCKS its own /_next/static chunks when the browser uses the IP form,
// so the page loads without JavaScript and every form silently does nothing.
export const BASE_URL = `http://localhost:${PORT}`;

export const STORAGE_STATE = path.resolve(__dirname, "e2e/.auth/admin.json");

export default defineConfig({
  testDir: "./e2e",
  // Serial by default: these tests share one database and several of them
  // assert on DB side effects, so parallel workers would race each other.
  // Speed is not what this suite is for.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    // Signs in once and saves the cookie; every admin test reuses it rather
    // than driving the sign-in form 20 times.
    { name: "auth", testMatch: /auth\.setup\.ts/ },
    {
      name: "admin",
      dependencies: ["auth"],
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      testMatch: /keystone\/.*\.spec\.ts/,
    },
    {
      // No storageState: the public surface is tested as an anonymous
      // visitor, which is also what makes the /keystone probe meaningful.
      name: "public",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /public\/.*\.spec\.ts/,
    },
  ],

  webServer: {
    // `next dev`, not `next start`. A production build INLINES environment
    // values into the middleware bundle at build time, so a build made against
    // the dev .env keeps reading the DEV database from proxy.ts even when
    // `next start` is handed a different DATABASE_URL. The symptom is nasty:
    // sign-in succeeds and writes a session to the E2E database, then the
    // proxy looks for it in the dev database, finds nothing, and bounces you
    // back to /sign-in with valid cookies in hand.
    //
    // Dev mode reads the environment at runtime, so there is no skew. The
    // cost is first-hit compilation, covered by the timeouts below.
    // Provision, THEN serve — one command, because the server's command is the
    // only hook that runs before the server. Playwright's plugin setup (where
    // `webServer` lives) precedes `globalSetup`, so a provisioning step there
    // could never beat the server to the database: `next dev` came up against
    // a database that did not exist, every request sat in the Prisma pool
    // until it timed out, and the run died on this very timeout with the
    // script that creates the database still queued behind it. `globalSetup`
    // now verifies what this produced. `.mts`, so Node reads it as ESM without
    // warning that apps/web declares no `"type": "module"`.
    command: `node --experimental-strip-types e2e/provision.mts && pnpm exec next dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // Covers BOTH halves of the command above: a full drop/migrate/seed of the
    // E2E database (~85s here) and then `next dev`'s first-hit compilation of
    // the route the URL check asks for. 240s covered only the second and this
    // run died on the timeout with a healthy server seconds away.
    timeout: 480_000,
    env: {
      // `process.env` must be spread explicitly: Playwright REPLACES the
      // child's environment with this object rather than merging, so omitting
      // it starts the server without BETTER_AUTH_SECRET — public pages render
      // fine and every sign-in silently fails, which is a confusing way to
      // spend an afternoon.
      ...(process.env as Record<string, string>),
      DATABASE_URL: e2eDatabaseUrl(),
      // The DEV url travels separately because the line above has taken its
      // usual name: `provision.mts` issues CREATE DATABASE through the
      // connection that is known to work, and needs the dev database's name
      // to refuse to drop it.
      [SOURCE_URL_VAR]: process.env.DATABASE_URL ?? "",
      // Its own build directory, so this server can run alongside `pnpm dev`
      // — Next 16's dev lock lives at `<distDir>/lock` (see next.config.ts).
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      BETTER_AUTH_URL: BASE_URL,
    },
  },
});
