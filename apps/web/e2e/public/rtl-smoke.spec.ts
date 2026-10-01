import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxeViolations } from "../axe.ts";
import { activeLocales } from "../db.ts";

// Phase 6 — the RTL smoke suite testing.md #4 names: "public suite runs `en`
// and `ar`, asserts `dir=rtl` and no horizontal overflow", plus axe on every
// template in Arabic.
//
// It turns itself on with an RTL locale, like the RTL cases in
// `about-section.spec.ts` and `tools.spec.ts`; the E2E fixtures switch `ar`
// on, so in this suite it runs. A template here is a ROUTE FILE, not a piece
// of content: the pages listed are the ones that answer in every served
// locale whatever has been translated, which is what makes them the smoke set.

const TEMPLATES = [
  "/",
  "/news",
  "/glossary",
  "/learn",
  "/learn/forex",
  "/learn/forex/quizzes",
  "/learn/forex/videos",
  "/tools",
  "/tools/pip-value",
  "/tools/market-hours",
  "/support",
  "/sitemap",
];

/** Desktop, and a phone — the width RTL overflow shows up at first. */
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

function rtlLocale() {
  return activeLocales().find((locale) => locale.isRtl);
}

async function overflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe("every template, both directions", () => {
  // Twelve pages per test, each compiled on first visit by `next dev`: the
  // suite-wide 60s is a per-PAGE budget here, not a per-test one.
  test.describe.configure({ timeout: 300_000 });

  for (const viewport of VIEWPORTS) {
    test(`English is ltr and does not scroll sideways (${viewport.name})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      for (const path of TEMPLATES) {
        const response = await page.goto(path);
        expect(response?.status(), path).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        expect(await overflow(page), `${path} overflows`).toBeLessThanOrEqual(1);
      }
    });

    test(`Arabic is rtl and does not scroll sideways (${viewport.name})`, async ({ page }) => {
      const rtl = rtlLocale();
      test.skip(rtl === undefined, "no RTL locale is active (ADR-091)");
      await page.setViewportSize(viewport);
      for (const template of TEMPLATES) {
        const path = template === "/" ? `/${rtl!.code}` : `/${rtl!.code}${template}`;
        const response = await page.goto(path);
        expect(response?.status(), path).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
        await expect(page.locator("html")).toHaveAttribute("lang", rtl!.code);
        expect(await overflow(page), `${path} overflows`).toBeLessThanOrEqual(1);
      }
    });
  }

  test("Arabic passes axe on every template", async ({ page }) => {
    const rtl = rtlLocale();
    test.skip(rtl === undefined, "no RTL locale is active (ADR-091)");
    for (const template of TEMPLATES) {
      await page.goto(template === "/" ? `/${rtl!.code}` : `/${rtl!.code}${template}`);
      await expectNoSeriousAxeViolations(page);
    }
  });
});

test.describe("a second language is visible to readers and crawlers", () => {
  test("the header offers the language", async ({ page }) => {
    const rtl = rtlLocale();
    test.skip(rtl === undefined, "no RTL locale is active (ADR-091)");
    await page.goto("/support");
    // The switcher renders only with two served locales (`LocaleSwitcher`).
    await expect(page.locator("header").getByRole("button", { name: /language/i })).toBeVisible();
  });

  test("a catalog page declares its Arabic twin, and back", async ({ page }) => {
    const rtl = rtlLocale();
    test.skip(rtl === undefined, "no RTL locale is active (ADR-091)");
    for (const path of ["/support", `/${rtl!.code}/support`]) {
      await page.goto(path);
      const hreflang = page.locator('link[rel="alternate"][hreflang]');
      await expect(hreflang.and(page.locator(`[hreflang="${rtl!.code}"]`))).toHaveAttribute(
        "href",
        new RegExp(`/${rtl!.code}/support$`),
      );
      await expect(hreflang.and(page.locator('[hreflang="x-default"]'))).toHaveAttribute(
        "href",
        /\/support$/,
      );
    }
  });

  test("an untranslated tool keeps its calculator, a real name, and noindex (ADR-168)", async ({
    page,
  }) => {
    const rtl = rtlLocale();
    test.skip(rtl === undefined, "no RTL locale is active (ADR-091)");
    await page.goto(`/${rtl!.code}/tools/pip-value`);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    // The registry key is never a reader's title.
    await expect(heading).not.toHaveText("pip-value");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    // No hreflang: no person has approved an Arabic version yet.
    await expect(page.locator(`link[rel="alternate"][hreflang="${rtl!.code}"]`)).toHaveCount(0);
  });
});
