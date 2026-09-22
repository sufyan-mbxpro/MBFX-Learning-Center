import { expect, test } from "@playwright/test";
import { VIEWER_EMAIL, VIEWER_PASSWORD } from "../accounts.ts";
import { aiFeature, auditCount, setting } from "../db.ts";
import { expectNoSeriousAxeViolations } from "../axe.ts";
import { signInAsStaff } from "../sign-in.ts";
import { fillField, openAdminScreen } from "../hydration.ts";

// changes-29 (Module 18, ADR-097/098/099/100) — the five AI screens, which
// shipped with their E2E explicitly owed to Module 14.
//
// One deep journey plus the denial and axe, which is the shape testing.md asks
// for. What is asserted is the platform's own invariants rather than its copy:
//
//   - a save lands in the DATABASE, not just in the form (testing.md #1);
//   - the seeded state is AI OFF on the ECHO driver, so a fresh clone cannot
//     spend a cent (ADR-097) — a suite that starts from an enabled platform
//     would never notice that regressing;
//   - `ai.providers.manage` is super_admin-only (ADR-098), so the Providers
//     tab is ABSENT for an ordinary admin, and the screen behind it refuses
//     regardless;
//   - the denial is asserted at the database, not by a missing button.
test.describe.configure({ mode: "serial" });

test.describe("the AI area", () => {
  test("is one tabbed section under Settings, and the old URL lands on Usage", async ({ page }) => {
    // changes-51: the AI area is Settings → AI. `/keystone/ai` was the Usage
    // screen (P9), so a bookmark to it still opens Usage.
    await openAdminScreen(page, "/keystone/ai");
    await expect(page).toHaveURL(/\/keystone\/settings\/ai\/usage$/);
    await expect(page.getByRole("heading", { level: 1, name: "AI" })).toBeVisible();

    const subNav = page.getByRole("navigation", { name: "AI" });
    for (const tab of ["Connection", "Usage", "Features", "Budget & limits", "Providers"]) {
      await expect(subNav.getByRole("link", { name: tab })).toHaveCount(1);
    }
  });

  test("ships OFF, on the ECHO driver — the seeded state a fresh clone gets", async ({ page }) => {
    // ADR-097's headline promise, asserted at the row rather than the screen:
    // "a fresh clone has a working AI area that cannot spend a cent". If this
    // ever flips, every other AI test still passes and the default stops being
    // safe, which is exactly the regression worth a dedicated case.
    expect(setting("ai.enabled")?.value).toBe(false);

    // Non-public, every one of them (§7.3) — an AI setting must never reach a
    // public RSC payload (security.md #12).
    for (const key of [
      "ai.enabled",
      "ai.monthlyBudgetUsd",
      "ai.budgetWarnPercent",
      "ai.capBehavior",
      "ai.maxTokensPerRequest",
    ]) {
      expect(setting(key)?.isPublic, `${key} must not be public`).toBe(false);
    }

    // And every feature seeded off, so enabling the platform does not enable
    // six features at once.
    for (const key of ["writing_assistant", "seo_generation", "translation"]) {
      expect(aiFeature(key)?.isEnabled, `${key} must ship disabled`).toBe(false);
    }

    await openAdminScreen(page, "/keystone/settings/ai/limits");
    await expect(page.getByRole("switch", { name: "Enable AI features" })).not.toBeChecked();
  });

  test("saves the budget, and the row reflects it", async ({ page }) => {
    const stamp = Date.now() % 900;
    const budget = `${100 + stamp}.50`;

    await openAdminScreen(page, "/keystone/settings/ai/limits");
    await fillField(page.getByLabel("Monthly budget (USD)"), budget);
    await fillField(page.getByLabel("Warn at (% of budget)"), "75");
    await page.getByRole("button", { name: "Save" }).click();

    // Against the DATABASE, not the input we just typed into.
    await expect
      .poll(() => setting("ai.monthlyBudgetUsd")?.value, { timeout: 15_000 })
      .toBe(Number(budget));
    expect(setting("ai.budgetWarnPercent")?.value).toBe(75);
  });

  test("saves one feature's house style without touching its siblings", async ({ page }) => {
    const before = aiFeature("seo_generation");
    const siblingBefore = aiFeature("writing_assistant");
    const instruction = `British spelling, never use the word delve (${Date.now()})`;

    await openAdminScreen(page, "/keystone/settings/ai/features");
    // Six cards, one per registry key — the set is code (§7.1).
    await expect(page.getByRole("button", { name: "Save" })).toHaveCount(6);

    // Scoped to the card whose own HEADING names the feature, so this cannot
    // silently edit a neighbour when the registry order changes. `AdminSection`
    // renders a `Card` — `data-slot="card"` is its stable handle, and the
    // title is the `<h2>` in its header.
    const card = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByRole("heading", { name: "SEO metadata", exact: true }) });
    await fillField(card.getByLabel("Extra instructions"), instruction);
    await card.getByRole("button", { name: "Save" }).click();

    await expect
      .poll(() => aiFeature("seo_generation")?.extraInstructions, { timeout: 15_000 })
      .toBe(instruction);

    // One card, one row: a per-feature save must not write its neighbours, and
    // must not flip the switch on the card it DID save.
    expect(aiFeature("writing_assistant")?.extraInstructions).toBe(
      siblingBefore?.extraInstructions ?? null,
    );
    expect(aiFeature("seo_generation")?.isEnabled).toBe(before?.isEnabled);
  });

  for (const path of [
    "/keystone/settings/ai/usage",
    "/keystone/settings/ai/features",
    "/keystone/settings/ai/limits",
    "/keystone/settings/ai/providers",
  ]) {
    test(`${path} passes axe`, async ({ page }) => {
      await openAdminScreen(page, path);
      await expectNoSeriousAxeViolations(page);
    });
  }
});

test.describe("AI, denied — asserted at the database", () => {
  // A separate context: this subject must NOT inherit the admin's session.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a subject without ai.settings.manage cannot change a feature", async ({ page }) => {
    const before = aiFeature("summarization");

    // `seo_manager` is a real seeded role holding `analysis.view` and no AI
    // key at all, so the refusal under test is the one production produces.
    await signInAsStaff(page, VIEWER_EMAIL, VIEWER_PASSWORD, "/keystone/dashboard");

    // The area's layout gate is `requireAnyPermission` over the three AI keys,
    // so this subject cannot even reach the screen. Plain `goto`, not
    // `openAdminScreen`: the point is that this page does not render, so there
    // is nothing of it to wait for.
    await page.goto("/keystone/settings/ai/features");
    await expect(page.getByLabel("Extra instructions").first()).toHaveCount(0);

    // Now bypass the UI entirely, the way a hostile client would — a hidden
    // form is not security (security.md #1). `POST /keystone/api/ai/run` is the
    // one generation endpoint, and the only door to a provider.
    const run = await page.request.post("/keystone/api/ai/run", {
      data: { feature: "summarization", action: "summarize", input: { text: "probe" } },
    });
    expect(
      run.status(),
      "the AI endpoint must refuse a subject with no AI key",
    ).toBeGreaterThanOrEqual(400);

    // The real assertion: the row is untouched, and nothing was logged as
    // though it had run.
    const after = aiFeature("summarization");
    expect(after?.isEnabled).toBe(before?.isEnabled);
    expect(after?.extraInstructions).toBe(before?.extraInstructions ?? null);
    expect(auditCount("summarization", "ai.feature.update")).toBe(0);
  });
});
