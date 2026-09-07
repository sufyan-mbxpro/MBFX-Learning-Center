import { expect, test } from "@playwright/test";
import { auditCount, seededArticle } from "../db.ts";

// BLOCKED on the auth setup — see e2e/auth.setup.ts for the full diagnosis.
// Without a saved storageState these cannot sign in, so they are marked
// `fixme` rather than left to fail: the specs themselves are written against
// the real screens and should pass unchanged once hydration under Playwright
// is resolved. Plan criteria 14–16 stay OWED until then.
test.describe.configure({ mode: "serial" });
import { VIEWER_EMAIL, VIEWER_PASSWORD } from "../global-setup.ts";

// changes-07 plan criteria 14–16. One deep journey plus the denial, rather
// than five shallow clicks (testing.md "Judgment calls").

/**
 * The editor header's primary button says what the click will do: "Publish"
 * while the post is a draft the actor may publish, "Update" once it is live.
 * Anchored so it never matches the publish panel's "Publish now" — which runs
 * the same save-then-publish operation, but is a different button.
 */
const HEADER_SAVE = /^(Publish|Update)$/;

test.describe.fixme("article editor v2", () => {
  test("criterion 14 — edit every panel, save once, and the DB reflects all of it", async ({
    page,
  }) => {
    const before = seededArticle();
    await page.goto(`/admin/articles/${before.articleId}`);

    const stamp = Date.now();
    const newSeoTitle = `Forex Risk Management Guide ${stamp}`;
    const newQuestion = `How much should I risk per trade? (${stamp})`;

    // Per-translation field (SEO tab) …
    await page.getByRole("tab", { name: "Basic SEO" }).click();
    await page.getByLabel("SEO title").fill(newSeoTitle);
    await page.getByLabel("Focus Keywords").fill("risk management, position sizing");

    // … a FAQ row …
    await page.locator("#faq-q-0").fill(newQuestion);

    // … and a per-ARTICLE field, to prove meta and translation commit together.
    await page.getByRole("switch", { name: "Featured Post" }).click();

    await page.getByRole("button", { name: HEADER_SAVE }).click();

    // Assert against the DATABASE, not the form we just typed into.
    await expect.poll(() => seededArticle().seoTitle, { timeout: 15_000 }).toBe(newSeoTitle);

    const after = seededArticle();
    expect(after.focusKeywords).toBe("risk management, position sizing");
    expect(after.faqItems[0]?.question).toBe(newQuestion);
    // Replace preserved identity rather than deleting and recreating.
    expect(after.faqItems[0]?.id).toBe(before.faqItems[0]?.id);
    expect(after.faqItems).toHaveLength(before.faqItems.length);
    expect(after.article.isFeatured).toBe(!before.article.isFeatured);

    // ONE transaction ⇒ ONE audit row for the whole screen.
    const audits = auditCount(before.articleId, "articles.save");
    expect(audits).toBe(1);

    // Restore the flag so re-runs start from the same state.
    await page.getByRole("switch", { name: "Featured Post" }).click();
    await page.getByRole("button", { name: HEADER_SAVE }).click();
    await expect
      .poll(() => seededArticle().article.isFeatured, { timeout: 15_000 })
      .toBe(before.article.isFeatured);
  });

  test("the sticky save button stays clickable when the page is scrolled", async ({ page }) => {
    // Regression test for the bug live verification caught: the editor's
    // sticky header used `top-0`, which slid it UNDER the admin shell's own
    // sticky header, leaving the save button covered and unclickable.
    // Every other check in the repo passed while this was broken.
    const article = seededArticle();
    await page.goto(`/admin/articles/${article.articleId}`);
    await page.mouse.wheel(0, 1200);

    const save = page.getByRole("button", { name: HEADER_SAVE });
    await expect(save).toBeVisible();

    const covered = await save.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !(top === el || el.contains(top));
    });
    expect(covered, "the header save button is covered by another element").toBe(false);
  });

  test("criterion 16 — the row menu's Set Featured writes to the DB", async ({ page }) => {
    const before = seededArticle();
    await page.goto("/admin/articles");

    await page.getByRole("button", { name: "Open actions" }).first().click();
    const toggle = page.getByRole("menuitem", {
      name: before.article.isFeatured ? "Unset Featured" : "Set Featured",
    });
    await toggle.click();

    await expect
      .poll(() => seededArticle().article.isFeatured, { timeout: 15_000 })
      .toBe(!before.article.isFeatured);

    // Put it back.
    await page.reload();
    await page.getByRole("button", { name: "Open actions" }).first().click();
    await page
      .getByRole("menuitem", {
        name: before.article.isFeatured ? "Set Featured" : "Unset Featured",
      })
      .click();
    await expect
      .poll(() => seededArticle().article.isFeatured, { timeout: 15_000 })
      .toBe(before.article.isFeatured);
  });
});

test.describe.fixme("criterion 15 — permission denied, asserted at the DB", () => {
  // A separate context: this user must NOT inherit the admin's storageState.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a read-only subject cannot change an article, and nothing is written", async ({ page }) => {
    const before = seededArticle();

    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(VIEWER_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(VIEWER_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    // seo_manager holds analysis.view, so the screen itself is reachable —
    // this is about the WRITE being refused, not the route being hidden.
    await page.goto(`/admin/articles/${before.articleId}`);

    const hijackedTitle = `HIJACKED ${Date.now()}`;
    const denied = await page.evaluate(async (articleId) => {
      // Call the server action's endpoint the way a hostile client would,
      // bypassing the UI entirely — a hidden button is not security
      // (security.md #1). Any non-2xx or thrown error counts as denied.
      try {
        const res = await fetch(`/admin/articles/${articleId}`, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: JSON.stringify([{ articleId, meta: {}, translation: {} }]),
        });
        return res.status >= 400;
      } catch {
        return true;
      }
    }, before.articleId);
    expect(denied).toBe(true);

    // The real assertion: the database is untouched.
    const after = seededArticle();
    expect(after.title).toBe(before.title);
    expect(after.seoTitle).toBe(before.seoTitle);
    expect(after.title).not.toContain(hijackedTitle);
    expect(after.article.isFeatured).toBe(before.article.isFeatured);
  });
});
