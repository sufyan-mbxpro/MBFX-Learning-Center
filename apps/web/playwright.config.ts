import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";

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

/** The isolated E2E database URL, derived from DATABASE_URL. */
export function e2eDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set — E2E needs it to derive its own database.");
  const url = new URL(raw);
  url.pathname = `/${process.env.E2E_DATABASE_NAME ?? "mbfx_e2e"}`;
  return url.toString();
}

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
      testMatch: /admin\/.*\.spec\.ts/,
    },
    {
      // No storageState: the public surface is tested as an anonymous
      // visitor, which is also what makes the /admin probe meaningful.
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
    command: `pnpm exec next dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      // `process.env` must be spread explicitly: Playwright REPLACES the
      // child's environment with this object rather than merging, so omitting
      // it starts the server without BETTER_AUTH_SECRET — public pages render
      // fine and every sign-in silently fails, which is a confusing way to
      // spend an afternoon.
      ...(process.env as Record<string, string>),
      DATABASE_URL: e2eDatabaseUrl(),
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      BETTER_AUTH_URL: BASE_URL,
    },
  },
});
