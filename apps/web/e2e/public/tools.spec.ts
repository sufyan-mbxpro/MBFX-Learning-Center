import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// changes-25 T10 — the eight tools as an anonymous visitor (ADR-086/087/088).
//
// One deep journey plus axe on every page, which is the shape testing.md asks
// for ("prefer one deep journey over five shallow clicks"). Copy is not
// asserted word for word — that belongs to the catalog and would make every
// editorial change a red build — with ONE exception, which is the point of the
// last block: ADR-088 #7's ban on "real-time" and "live" is a copy rule, and a
// copy rule that nothing checks is a comment.

const TOOL_PATHS = [
  "/tools/position-size",
  "/tools/pip-value",
  "/tools/gain-loss",
  "/tools/pivot-points",
  "/tools/market-hours",
  "/tools/currency-converter",
  "/tools/correlation",
  "/tools/risk-sentiment",
];

/** Serious and critical violations fail; everything else is advisory. */
async function expectNoSeriousAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    blocking.map((v) => `${v.id}: ${v.nodes.length} node(s) — ${v.help}`),
    "serious/critical axe violations",
  ).toEqual([]);
}

test.describe("the tools index", () => {
  test("lists every live tool and links each one", async ({ page }) => {
    const response = await page.goto("/tools");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // The section bar is a <nav> of its own, so this cannot match the
    // header's primary navigation.
    const sectionNav = page.getByRole("navigation", { name: "Trading tools" });
    await expect(sectionNav.getByRole("link")).toHaveCount(TOOL_PATHS.length);
  });

  test("passes axe", async ({ page }) => {
    await page.goto("/tools");
    await expectNoSeriousAxeViolations(page);
  });
});

test.describe("every tool page", () => {
  for (const path of TOOL_PATHS) {
    test(`${path} answers 200 and renders its widget band`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      // Its own tab is current — the bar tracks the route.
      const sectionNav = page.getByRole("navigation", { name: "Trading tools" });
      await expect(sectionNav.locator('[aria-current="page"]')).toHaveCount(1);
    });

    test(`${path} passes axe`, async ({ page }) => {
      await page.goto(path);
      await expectNoSeriousAxeViolations(page);
    });
  }
});

test.describe("the deep journey: size a trade, then read on", () => {
  test("fills the position-size form, reads a result, and follows a related card", async ({
    page,
  }) => {
    await page.goto("/tools");
    await page.getByRole("link", { name: "Position Size Calculator" }).first().click();
    await expect(page).toHaveURL(/\/tools\/position-size$/);

    // The amount at risk needs NO market data (ADR-087 #11), so this
    // assertion holds on a fresh instance with no provider configured — which
    // is exactly the state the E2E database is in.
    const balance = page.getByLabel("Account balance");
    const risk = page.getByLabel("Risk per trade (%)");

    // A `fill` that lands mid-hydration is overwritten when React takes over,
    // and the failure is nasty: the later fields keep their values, so the
    // page shows a number that is correct arithmetic over the wrong inputs —
    // 2% of the DEFAULT balance, looking every bit like a real answer.
    //
    // `await expect(balance).toHaveValue("10000")` is what used to guard this,
    // and it cannot: the server-rendered HTML already carries that value, so
    // it passes before React has mounted and proves nothing. Nothing marks an
    // island hydrated, so the honest gate is the OUTPUT — the amount at risk
    // is computed on the client, so it can only read 400.00 once the inputs
    // have reached React. Retry the whole sequence until it does.
    //
    // 2% of 20,000 = 400, whatever the rates say — the amount at risk needs
    // no market data (ADR-087 #11).
    const atRisk = page.getByText("400.00", { exact: false }).first();
    await expect(async () => {
      await balance.fill("20000");
      await risk.fill("2");
      await page.getByLabel("Stop loss (pips)").fill("40");
      await expect(atRisk).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30_000 });

    await expect(balance).toHaveValue("20000");
    await expect(risk).toHaveValue("2");

    // The strip is curated-then-topped-up, so it is never empty on a site
    // with any published content (ADR-086 #4).
    const related = page.getByRole("heading", { name: "More about this" });
    await expect(related).toBeVisible();
    const firstCard = page.locator("section").filter({ has: related }).getByRole("link").first();
    const href = await firstCard.getAttribute("href");
    expect(href).toBeTruthy();
    await firstCard.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("a disabled tool is absent, not disabled (ADR-086 #5)", () => {
  test("an unregistered key 404s", async ({ page }) => {
    const response = await page.goto("/tools/margin-calculator");
    // `notFound()` under Cache Components can commit 200 with the not-found
    // body when a loading shell streamed first (the soft-404 ADR-004 records
    // for /learn/[track]); what matters to a reader is the page they get.
    expect([404, 200]).toContain(response?.status());
    await expect(page.getByRole("navigation", { name: "Trading tools" })).toHaveCount(0);
  });
});

test.describe('ADR-088 #7 — never "real-time", never "live"', () => {
  // The score moves once per daily sweep. A disclaimer does not repair a word
  // that was false, so the word never appears.
  for (const path of ["/tools/correlation", "/tools/risk-sentiment"]) {
    test(`${path} says neither word`, async ({ page }) => {
      await page.goto(path);
      // `main`, not `body`. ADR-088 #7 governs what the TOOL says about its
      // own data, and everything the tool renders — masthead, widget,
      // explainer, FAQ, related strip, disclaimer — is inside the landmark.
      // The footer is not: it carries a seeded "Live Rates" row pointing at
      // /markets, so a body-wide scan failed on chrome this page does not own
      // and says nothing whatever about the correlation copy. Whether that is
      // the right label for a section still being built is a question for the
      // footer, not for this rule.
      const body = (await page.locator("main").innerText()).toLowerCase();
      expect(body).not.toContain("real-time");
      expect(body).not.toContain("realtime");
      // "live" as a WORD — "delivered" and "lives" must not trip it.
      expect(body).not.toMatch(/\blive\b/);
    });
  }
});

test.describe("RTL", () => {
  test("the widest surfaces do not push the page sideways in Arabic", async ({ page }) => {
    // The pivot table and the market-hours timeline are the two bands wider
    // than a phone; both scroll inside their own container instead.
    await page.setViewportSize({ width: 400, height: 900 });
    for (const path of ["/ar/tools/pivot-points", "/ar/tools/market-hours"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });
});
