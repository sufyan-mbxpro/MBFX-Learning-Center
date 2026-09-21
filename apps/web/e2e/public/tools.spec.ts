import { expect, test } from "@playwright/test";
import { expectNoSeriousAxeViolations } from "../axe.ts";
import { activeLocales } from "../db.ts";
import { waitForHydration } from "../hydration.ts";

// changes-25 T10 — the tools as an anonymous visitor (ADR-086/087/088; three
// more since changes-41, ADR-135).
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
  "/tools/margin",
  "/tools/profit-loss",
  "/tools/risk-reward",
  "/tools/gain-loss",
  "/tools/pivot-points",
  "/tools/market-hours",
  "/tools/currency-converter",
  "/tools/correlation",
  "/tools/risk-sentiment",
];

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
    // A `next/link` clicked BEFORE hydration does nothing at all: Next's own
    // handler intercepts the click and the router is not initialised yet, so
    // the navigation is swallowed (the dev server logs "Router action
    // dispatched before initialization"). The page simply stays where it was,
    // which is how this read — a card that would not open.
    await waitForHydration(page);
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

test.describe("changes-41: risk from three prices, and the reviews band", () => {
  test("the risk calculator states the amount at risk and the ratio with no market data", async ({
    page,
  }) => {
    await page.goto("/tools/risk-reward");
    await waitForHydration(page);

    // 1% of 5,000 is 50 and a 30/60-pip stop/target is 1 : 2.00 — both are
    // pure arithmetic on what was typed, so they hold on the E2E database,
    // which has no provider and therefore no default prices.
    const atRisk = page.getByText("50.00 USD", { exact: false }).first();
    const ratio = page.getByText("1 : 2.00").first();
    await expect(async () => {
      await page.getByLabel(/Account balance/).fill("5000");
      await page.getByLabel("Risk per trade (%)").fill("1");
      await page.getByLabel("Entry price").fill("1.10000");
      await page.getByLabel("Stop loss").fill("1.09700");
      await page.getByLabel("Take profit").fill("1.10600");
      await expect(atRisk).toBeVisible({ timeout: 2000 });
      await expect(ratio).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30_000 });

    // A take profit on the wrong side is named, never a negative ratio.
    await page.getByLabel("Take profit").fill("1.09000");
    await expect(page.getByText("needs to be above the entry")).toBeVisible();
  });

  test("links to the review page in a new tab, without an opener", async ({ page }) => {
    await page.goto("/tools/margin");
    const link = page.getByRole("link", { name: /Review us on Trustpilot/ });
    await expect(link).toHaveAttribute("href", /^https:\/\//);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
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
  // `/tools/profit-loss` joined in changes-41: its reference copy said
  // "Real-Time Results", and the seed renames it. This is what keeps it renamed.
  for (const path of ["/tools/correlation", "/tools/risk-sentiment", "/tools/profit-loss"]) {
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
  // Turns itself on with the locale — see the same note in
  // `about-section.spec.ts`. Hard-coded `/ar/...` had been failing since
  // ADR-091 made only an ACTIVE locale servable.
  test("the widest surfaces do not push the page sideways in Arabic", async ({ page }) => {
    // Inside the test — see the same note in `about-section.spec.ts`.
    const rtl = activeLocales().find((locale) => locale.isRtl);
    test.skip(
      rtl === undefined,
      "no RTL locale is active (ADR-091) — this runs on the PR that activates one",
    );
    // The pivot table and the market-hours timeline are the two bands wider
    // than a phone; both scroll inside their own container instead.
    await page.setViewportSize({ width: 400, height: 900 });
    for (const path of [`/${rtl!.code}/tools/pivot-points`, `/${rtl!.code}/tools/market-hours`]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });
});
