import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Resolves once React has attached to `selector`.
 *
 * ─── WHY EVERY SPEC NEEDS THIS ─────────────────────────────────────────────
 *
 * Playwright's actionability checks are about the DOM: visible, stable,
 * enabled, receiving events. A server-rendered React page satisfies all four
 * before a single line of JavaScript has run, so `fill` and `click` are
 * "actionable" against markup nothing is listening to yet. What follows is
 * quietly wrong rather than loud:
 *
 *   - `click` on a control whose handler is not attached does nothing — or
 *     submits the form natively. The staff sign-in setup spent months marked
 *     `fixme` over this, under the diagnosis "React never hydrates under
 *     Playwright". React hydrates fine; it was being typed into first, the
 *     controlled email field emptied on the click's re-render, and the
 *     browser's own `required` validation then blocked the submit.
 *   - `fill` on a controlled field can CONCATENATE. Playwright's fill sets the
 *     value to `""`, then inserts the text at the caret. Hydrate between those
 *     two steps and React restores its own state into the node, so the insert
 *     lands in front of the original value instead of replacing it. The tools
 *     admin saved `"Work out the other two (…)Tell us one of the three
 *     figures…"` — a save that looked like a bug in the action, in a field
 *     nothing was wrong with.
 *
 * `networkidle` is not the signal: it says requests stopped, not that
 * hydration finished. React attaching its fiber to the node IS the signal, so
 * that is what this waits for.
 */
export async function waitForHydration(page: Page, selector = "main"): Promise<void> {
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return !!el && Object.keys(el).some((key) => key.startsWith("__react"));
  }, selector);
}

/**
 * Open an admin screen and wait until it can actually be driven.
 *
 * Every admin spec should navigate through this rather than `page.goto`, and
 * that includes after a `page.reload()`. The admin surface is fully dynamic and
 * its forms are controlled components, so it is exactly the surface where
 * acting too early is silent.
 */
export async function openAdminScreen(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await waitForHydration(page);
}

/** Reload, then wait to be able to drive the page again. */
export async function reloadAdminScreen(page: Page): Promise<void> {
  await page.reload();
  await waitForHydration(page);
}

/**
 * Type into a controlled field and prove the value took.
 *
 * `waitForHydration` on `main` is not enough on its own: with Cache Components
 * the page streams, so an island deeper in the tree can still be hydrating
 * after `main` has its fiber. This waits for React to own THIS node, then
 * re-fills until the field actually reads back what was asked for — which
 * turns the concatenation described above from a confusing assertion failure
 * three steps later into no failure at all.
 *
 * Use it for every value an admin spec types and later asserts on.
 */
export async function fillField(field: Locator, value: string): Promise<void> {
  await expect(async () => {
    const owned = await field.evaluate((el) =>
      Object.keys(el).some((key) => key.startsWith("__react")),
    );
    expect(owned, "React has not attached to this field yet").toBe(true);
    await field.fill(value);
    await expect(field).toHaveValue(value);
  }).toPass({ timeout: 20_000 });
}
