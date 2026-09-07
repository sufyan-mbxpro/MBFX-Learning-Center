import { expect, test } from "@playwright/test";

// changes-09 PR 9 — the About section (ADR-047) and the mega menu (ADR-048),
// as an anonymous visitor.
//
// What these assert, deliberately, is the behaviour that unit tests cannot
// reach: that the panel opens from a real pointer and a real keyboard, that
// the five routes exist and answer, that the sub-nav tracks the route, and
// that an RTL locale mirrors without overflowing. Copy is NOT asserted
// word-for-word — that belongs to the catalog and would make every editorial
// change a red build.

const PAGES = [
  { path: "/about", heading: "Learn the markets with MBFX", nav: "About MBFX" },
  { path: "/about/why-us", heading: "Why learn the markets here", nav: "Why MBFX" },
  { path: "/about/transparency", heading: "How we operate", nav: "How we operate" },
  { path: "/about/security", heading: "Security and trust", nav: "Security & trust" },
  { path: "/about/support", heading: "How we support you", nav: "Support" },
];

test.describe("the five About pages", () => {
  for (const page_ of PAGES) {
    test(`${page_.path} renders its h1 and highlights its sub-nav entry`, async ({ page }) => {
      const response = await page.goto(page_.path);
      expect(response?.status()).toBe(200);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(page_.heading);

      // The strip is a <nav> of its own, so this cannot accidentally match
      // the header's primary navigation.
      const sectionNav = page.getByRole("navigation", { name: "About MBFX" });
      await expect(sectionNav.getByRole("link", { name: page_.nav })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
  }

  test("every sub-nav destination is reachable from every page", async ({ page }) => {
    await page.goto("/about");
    const sectionNav = page.getByRole("navigation", { name: "About MBFX" });
    await expect(sectionNav.getByRole("link")).toHaveCount(PAGES.length);

    await sectionNav.getByRole("link", { name: "Support" }).click();
    await expect(page).toHaveURL(/\/about\/support$/);
  });

  // ADR-051 §1 replaced this test's premise, and the replacement is the
  // point. It used to assert that the data-gated sections left NO trace,
  // because ABOUT_FACTS was empty. A placeholder dataset now fills them, so
  // the thing worth asserting is no longer "they are absent" — it is that
  // WHICH dataset is live is visible in the DOM, and that the gated sections
  // agree with it.
  //
  // The absent-when-empty behaviour ADR-047 §2 specified did not go away; it
  // moved to a unit test that can flip the environment variable
  // (`_content/about-content.test.ts`), which an E2E run against a already-
  // started server cannot do.
  test("declares which dataset is live, and renders the gated sections to match", async ({
    page,
  }) => {
    await page.goto("/about");
    const mode = await page.locator("main[data-about-content]").getAttribute("data-about-content");
    expect(mode).toMatch(/^(demo|real)$/);

    const gated = [
      page.getByRole("heading", { name: "Recognition" }),
      page.getByRole("heading", { name: "How we got here" }),
      page.getByRole("heading", { name: "Deposit and withdrawal options" }),
    ];
    for (const heading of gated) {
      await expect(heading).toHaveCount(mode === "demo" ? 1 : 0);
    }

    await page.goto("/about/security");
    await expect(page.getByRole("heading", { name: "Where our people are" })).toHaveCount(
      mode === "demo" ? 1 : 0,
    );
  });

  // ADR-051 §3. The visible copy may be placeholder; the machine-readable
  // graph may not be, because it is syndicated and cached out of the context
  // that would let a reader discount it.
  test("keeps placeholder facts out of the Organization graph", async ({ page }) => {
    await page.goto("/about");
    const graphs = await page.locator('script[type="application/ld+json"]').allTextContents();
    for (const raw of graphs) {
      const graph = JSON.parse(raw) as Record<string, unknown>;
      if (graph["@type"] !== "Organization") continue;
      expect(graph).not.toHaveProperty("foundingDate");
      expect(graph).not.toHaveProperty("award");
      expect(graph).not.toHaveProperty("numberOfEmployees");
      expect(graph).not.toHaveProperty("address");
    }
  });

  // The hover state the panel rows carry is the one piece of this work a
  // visitor meets before anything else, and it is easy to lose to a class
  // merge. Asserting the computed background rather than a class name keeps
  // the test about the effect, not the implementation.
  test("gives a mega-menu panel row a visible hover state", async ({ page }) => {
    await page.goto("/about");
    await page.getByRole("button", { name: "About", exact: true }).first().hover();
    const panel = page.locator("[data-slot=mega-menu-panel]");
    await expect(panel).toBeVisible();

    const row = panel.getByRole("link").first();
    const resting = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
    await row.hover();
    await expect
      .poll(async () => row.evaluate((el) => getComputedStyle(el).backgroundColor))
      .not.toBe(resting);
  });

  test("emits one Organization graph for the section, from the layout", async ({ page }) => {
    await page.goto("/about");
    const graphs = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = graphs.map((g) => (JSON.parse(g) as { "@type": string })["@type"]);
    expect(types.filter((t) => t === "Organization")).toHaveLength(1);
  });

  test("lists all five paths in the sitemap", async ({ page, baseURL }) => {
    const response = await page.request.get(`${baseURL}/sitemap.xml`);
    const xml = await response.text();
    for (const entry of PAGES) expect(xml).toContain(`${entry.path}`);
  });
});

test.describe("the mega menu (ADR-048)", () => {
  test("opens on hover, shows the panel's columns, and navigates", async ({ page }) => {
    await page.goto("/about");

    const trigger = page.getByRole("button", { name: "About" });
    await trigger.hover();

    // Column headings come from the registry's catalog keys; the rows come
    // from the database menu. Seeing both proves the two halves are bound.
    await expect(page.getByText("COMPANY")).toBeVisible();
    await expect(page.getByText("HOW WE WORK")).toBeVisible();

    await page
      .getByRole("link", { name: /Security & trust/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/about\/security$/);
  });

  // `toPass` around the interaction, not around an assertion: in dev the
  // first keypress can land before React has hydrated the trigger, and a
  // keypress that nothing is listening for is simply lost. Retrying the
  // press is what a person does too.
  test("opens from the keyboard and closes on Escape", async ({ page }) => {
    await page.goto("/about");

    const trigger = page.getByRole("button", { name: "About" });
    await expect(async () => {
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByText("HELP")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30_000 });

    await page.keyboard.press("Escape");
    await expect(page.getByText("HELP")).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("the mobile sheet carries the same destinations as the desktop panel", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/about");

    const sheet = page.getByRole("dialog");
    await expect(async () => {
      await page.getByRole("button", { name: "Open menu" }).click();
      await expect(sheet).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30_000 });

    await sheet.getByRole("button", { name: "About", exact: true }).click();

    for (const entry of PAGES) {
      await expect(sheet.getByRole("link", { name: new RegExp(entry.nav) })).toBeVisible();
    }
  });
});

test.describe("RTL", () => {
  test("an RTL locale mirrors the section without horizontal overflow", async ({ page }) => {
    await page.goto("/ar/about");

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
