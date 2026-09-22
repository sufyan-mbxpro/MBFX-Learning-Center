import { expect, test } from "@playwright/test";
import { auditCount, seededTool } from "../db.ts";
import { fillField, openAdminScreen } from "../hydration.ts";

// changes-25 T10 — the tools admin (ADR-086), happy path and denial. These
// were `fixme` behind the auth setup; see e2e/auth.setup.ts for what was
// actually wrong with it.
//
// **The denial is asserted at the DATABASE** (testing.md #1). A test that only
// checks a button is missing proves nothing: the button could be hidden while
// the server action happily writes.
test.describe.configure({ mode: "serial" });

test.describe("the tools admin", () => {
  test("lists all eleven, and each links to its editor", async ({ page }) => {
    await openAdminScreen(page, "/keystone/tools");
    await expect(page.getByRole("heading", { level: 1, name: "Trading tools" })).toBeVisible();

    // Eleven cards (ADR-135), each with an Edit control. Counted from the page rather
    // than typed here, then compared to the registry's own count.
    //
    // `button`, not `link`, even though it is an <a href>: `Button
    // render={<Link>}` stamps `role="button"` on its anchor, which is a
    // deliberate convention here — a card whose title already links to the
    // destination should not offer it twice in the accessibility tree
    // (`course-card.test.tsx` is where that is reasoned out). Asserting the
    // role it actually has is the point; asserting the one it "should" have
    // would make this spec an opinion about @repo/ui.
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(11);
  });

  test("edits copy and configuration in ONE save, and the DB reflects both", async ({ page }) => {
    const before = seededTool("gain-loss");
    const stamp = Date.now();
    const newTagline = `Work out the other two (${stamp})`;

    await openAdminScreen(page, "/keystone/tools/gain-loss");

    // A per-TRANSLATION field …
    await fillField(page.getByLabel("Tagline"), newTagline);
    // … and a per-TOOL one, to prove the two commit together (ADR-086 #2:
    // `saveTool` writes the row, one translation and the relations in one
    // transaction).
    await fillField(page.getByLabel("Related items"), "4");

    await page.getByRole("button", { name: "Save" }).click();

    // Assert against the DATABASE, not the form we just typed into.
    await expect
      .poll(() => seededTool("gain-loss").translations[0]?.tagline, { timeout: 15_000 })
      .toBe(newTagline);
    expect(seededTool("gain-loss").relatedCount).toBe(4);

    // ONE transaction ⇒ ONE audit row for the whole screen.
    expect(auditCount("gain-loss", "tool.update")).toBe(auditCount(before.key, "tool.update"));
  });

  test("the live switch runs on its own key and writes immediately", async ({ page }) => {
    const before = seededTool("gain-loss").isEnabled;

    await openAdminScreen(page, "/keystone/tools");

    // Scoped to gain-loss's OWN card, by the one thing on it that names the
    // tool: its public path. `.first()` was what this said, and it flipped
    // whichever card `listTools()` happened to return first — the switch
    // worked perfectly and the assertion read a row nobody had touched, which
    // is the most misleading way for a test to fail.
    const card = page.locator('[data-slot="card"]').filter({ hasText: "/tools/gain-loss" });
    const live = card.getByRole("switch", { name: "Live" });

    // The switch commits on change rather than staging — it is one boolean
    // with no companion fields.
    await live.click();
    await expect.poll(() => seededTool("gain-loss").isEnabled, { timeout: 15_000 }).toBe(!before);

    // Put it back, so the rest of the suite sees the seeded state.
    await live.click();
    await expect.poll(() => seededTool("gain-loss").isEnabled, { timeout: 15_000 }).toBe(before);
  });

  test("a config that does not match the key is refused, and nothing is written", async ({
    page,
  }) => {
    const before = seededTool("risk-sentiment");

    await openAdminScreen(page, "/keystone/tools/risk-sentiment");
    // Bands that cross are refused by the CONTRACT (ADR-088 #6), which the
    // form runs before the action does — so this never reaches the service.
    await page.getByLabel("Risk-off below").fill("90");
    await page.getByLabel("Risk-on above").fill("10");
    await page.getByRole("button", { name: "Save" }).click();

    // Give a save that should not happen a chance to happen.
    await page.waitForTimeout(2000);
    const after = seededTool("risk-sentiment");
    expect(after.config).toEqual(before.config);
  });
});

test.describe("permission denied, at the database", () => {
  // `test.use`, not `browser.newContext()`.
  //
  // The old version built its own context and called it anonymous. It was not:
  // the runner applies the project's `use` options to a context created that
  // way — which is why a relative `page.goto` resolved against `baseURL` at
  // all — and `storageState` came with them. So the "anonymous" visitor was
  // the signed-in super admin, and the test reached the editor it was
  // asserting was unreachable. Declaring the empty state here is both shorter
  // and actually anonymous.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("an anonymous visitor cannot reach the editor, and no row changes", async ({ page }) => {
    const before = seededTool("gain-loss");

    // The proxy's STAFF gate (security.md #3) bounces a request with no
    // session before any action can run.
    await page.goto("/keystone/tools/gain-loss");
    await expect(page).toHaveURL(/\/keystone\/sign-in/);

    const after = seededTool("gain-loss");
    expect(after.translations[0]?.tagline).toBe(before.translations[0]?.tagline);
    expect(after.isEnabled).toBe(before.isEnabled);
  });
});

test.describe("the market admin", () => {
  test("the provider key is write-only — the form never renders it", async ({ page }) => {
    // ADR-087 #5. `MarketProviderView` has no key property, so this is the
    // TYPE holding at runtime: the field is empty and its placeholder says
    // which of the two states it is in.
    await openAdminScreen(page, "/keystone/market/provider");
    const field = page.getByLabel("API key");
    await expect(field).toHaveValue("");

    const body = await page.locator("body").innerText();
    expect(body).not.toContain("v1:");
  });

  test("instruments list with their freshness", async ({ page }) => {
    await openAdminScreen(page, "/keystone/market");
    await expect(page.getByRole("heading", { level: 1, name: "Market data" })).toBeVisible();
    // The seeded provider is MANUAL and disabled, so every instrument reads
    // "Never synced" — the correct first-run state, not an error (T4).
    await expect(page.getByText("Never synced").first()).toBeVisible();
  });
});
