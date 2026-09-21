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
  redirectTo = "/admin",
): Promise<void> {
  await page.goto(`/admin/sign-in?redirect=${encodeURIComponent(redirectTo)}`);
  await waitForHydration(page, "#admin-signin-email");

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);

  // Pairing the click with waitForResponse is what makes a form that did not
  // post loud rather than silent.
  const [credentialResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/sign-in/email")),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
  expect(credentialResponse.status()).toBe(200);
}
