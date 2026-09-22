import { expect, test as setup } from "@playwright/test";
import { STORAGE_STATE } from "../playwright.config.ts";
import { ADMIN_EMAIL, adminPassword } from "./accounts.ts";
import { signInAsStaff } from "./sign-in.ts";

// Signs in once as the seeded super admin and saves the session cookie, so the
// admin specs start authenticated instead of driving this form every time.
//
// This was `fixme` for months, under a diagnosis that read: the server is
// fine, but React never hydrates this page under Playwright, so the click
// produces a native form submit and no credential request. Every admin spec
// in the suite was blocked behind it.
//
// The diagnosis was of a symptom. Nothing was wrong with hydration — the
// harness never got as far as serving a working page:
//
//   - Playwright starts `webServer` BEFORE `globalSetup` (plugin setup tasks
//     come first), and `globalSetup` was what created the E2E database. So on
//     any machine without a leftover `mbfx_e2e`, `next dev` came up against a
//     database that did not exist. Provisioning now runs from the server's own
//     command — see `e2e/provision.mts`.
//   - Creating that database needs a privilege the compose file's app user did
//     not have, so it could not have existed on a fresh machine either
//     (`docker/mariadb-init/10-e2e-grants.sql`).
//   - Next 16 takes a dev lock per `distDir` and refuses a second dev server
//     sharing one, so the suite could not run while `pnpm dev` was up. The
//     E2E server now builds into `.next-e2e`.
//
// With those three fixed, the page hydrates like any other: React attaches,
// the password toggle flips, and the form posts. Measured, not assumed.
setup("authenticate as the seeded admin", async ({ page }) => {
  // `?redirect=` hands the form its own destination; it navigates with
  // `window.location.assign` the moment the credential POST resolves.
  await signInAsStaff(page, ADMIN_EMAIL, adminPassword(), "/keystone/articles");

  // Arriving here proves both locks passed: a real session AND the STAFF gate
  // in proxy.ts (security.md #3).
  await page.waitForURL("**/keystone/articles", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "News & Analysis", level: 1 })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
