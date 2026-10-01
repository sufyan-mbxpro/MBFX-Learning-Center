import { expect, type Page } from "@playwright/test";
import { waitForHydration } from "./hydration.ts";

/**
 * Drives the staff credential screen (ADR-052) and returns once the portal has
 * loaded.
 *
 * Both fields are CONTROLLED, so this waits for hydration before typing —
 * `hydration.ts` has the full account of what typing early does, and this form
 * is where it was first found: the email field emptied on the click's
 * re-render, the browser's own `required` validation blocked the submit, and
 * the page sat there having sent no request at all.
 */
export async function signInAsStaff(
  page: Page,
  email: string,
  password: string,
  redirectTo = "/keystone/dashboard",
): Promise<void> {
  await page.goto(`/keystone?redirect=${encodeURIComponent(redirectTo)}`);
  await waitForHydration(page, "#admin-signin-email");

  // By the form's own ids, not its words. The screen's copy was rewritten
  // ("Admin Email", "Sign In to Admin") while the admin project matched no spec
  // (see playwright.config.ts), so a label-based helper broke with nobody
  // running it. The ids are the form's structure; the words are catalog data.
  const form = page.locator("form").filter({ has: page.locator("#admin-signin-email") });
  await form.locator("#admin-signin-email").fill(email);
  await form.locator("#admin-signin-password").fill(password);

  // Pairing the click with waitForResponse is what makes a form that did not
  // post loud rather than silent.
  const [credentialResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/sign-in/email")),
    form.locator('button[type="submit"]').click(),
  ]);
  expect(credentialResponse.status()).toBe(200);
}
