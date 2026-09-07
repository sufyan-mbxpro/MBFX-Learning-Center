import { expect, test as setup } from "@playwright/test";
import { STORAGE_STATE } from "../playwright.config.ts";

// Signs in once as the seeded super admin and saves the session cookie, so the
// admin specs start authenticated instead of driving this form every time.
//
// ─── BLOCKED, and deliberately marked so rather than skipped quietly ────────
//
// `fixme` (not `skip`) because this is a known defect in the harness, not an
// intentional exclusion: Playwright reports it distinctly, so `pnpm e2e`
// passing can never be mistaken for admin coverage existing.
//
// What is established, by direct measurement:
//   - The SERVER is fine. Driving the same flow through Playwright's `request`
//     API (no browser) gives sign-in 200, /api/auth/get-session 200 with a real
//     session, and `GET /admin/articles` → 200 with NO redirect. So the
//     credential, the session, proxy.ts's STAFF gate and the admin layout's
//     re-check all work correctly against the E2E database.
//   - The BROWSER never runs the form's JavaScript. `sign-in-form.tsx` handles
//     submit in React (fetch + window.location.assign); in the Playwright
//     browser the click produces NO request to /api/auth/sign-in/email and the
//     page reloads /sign-in with the fields cleared — the signature of a native
//     form submit, i.e. the handler was never attached.
//   - It is not a resource-loading failure: zero console errors, zero page
//     errors and zero failed requests across the whole page load, and
//     `networkidle` is reached before the click.
//   - Two red herrings already eliminated: Next dev blocks its own
//     /_next/static chunks when the browser uses `127.0.0.1` (fixed by using
//     `localhost` — see playwright.config.ts), and Playwright REPLACES rather
//     than merges `webServer.env` (fixed by spreading `process.env`).
//
// The remaining question is narrow: why React does not hydrate this page under
// Playwright when it hydrates fine in a normal browser against a dev server.
// Worth checking the `instant = false` / Cache Components interaction on the
// public layout, and whether the RSC payload is fetched at all.
//
// Until that is answered the `admin` project has no session and cannot run.
setup.fixme("authenticate as the seeded admin", async ({ page }) => {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@mbxpro.com";
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    throw new Error("SEED_ADMIN_PASSWORD is not set — the seeded admin has no credential to use.");
  }

  // The STAFF credential screen lives under /admin, not on the public site
  // (ADR-052). Hand the form its own destination via `?redirect=`; it
  // navigates with `window.location.assign` the moment the credential POST
  // resolves, so anything this test does to the page in between races that
  // navigation.
  await page.goto("/admin/sign-in?redirect=%2Fadmin%2Farticles");

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);

  // Pairing the click with waitForResponse is what makes the hydration failure
  // described above loud instead of silent.
  await page.waitForLoadState("networkidle");
  const [credentialResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/sign-in/email")),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
  expect(credentialResponse.status()).toBe(200);

  // Arriving here proves both locks passed: a real session AND the STAFF gate
  // in proxy.ts (security.md #3).
  await page.waitForURL("**/admin/articles", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "News & Analysis", level: 1 })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
