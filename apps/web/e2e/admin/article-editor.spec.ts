import { expect, test } from "@playwright/test";
import { auditCount, seededArticle } from "../db.ts";

// changes-07 plan criteria 14–16, live at last: these were `fixme` behind the
// auth setup, which was itself blocked on a harness bug rather than on the
// hydration failure it was diagnosed as (see e2e/auth.setup.ts).
test.describe.configure({ mode: "serial" });
import { VIEWER_EMAIL, VIEWER_PASSWORD } from "../accounts.ts";
import { signInAsStaff } from "../sign-in.ts";
import { fillField, openAdminScreen, reloadAdminScreen } from "../hydration.ts";

// changes-07 plan criteria 14–16. One deep journey plus the denial, rather
// than five shallow clicks (testing.md "Judgment calls").

/**
 * The editor header's primary button says what the click will do: "Publish"
 * while the post is a draft the actor may publish, "Update" once it is live.
 * Anchored so it never matches the publish panel's "Publish now" — which runs
 * the same save-then-publish operation, but is a different button.
 */
const HEADER_SAVE = /^(Publish|Update)$/;

test.describe("article editor v2", () => {
  test("criterion 14 — edit every panel, save once, and the DB reflects all of it", async ({
    page,
  }) => {
    const before = seededArticle();
    await openAdminScreen(page, `/admin/articles/${before.articleId}`);

    const stamp = Date.now();
    const newSeoTitle = `Forex Risk Management Guide ${stamp}`;
    const newQuestion = `How much should I risk per trade? (${stamp})`;

    // Per-translation field (SEO tab) …
    await page.getByRole("tab", { name: "Basic SEO" }).click();
    await fillField(page.getByLabel("SEO title"), newSeoTitle);
    await fillField(page.getByLabel("Focus Keywords"), "risk management, position sizing");

    // … a FAQ row, which is edited in a DIALOG since ADR-046 rather than
    // through inline `#faq-q-N` inputs. The pencil on row 0 opens it; the
    // dialog's own Save only stages the row, and the editor's Save is what
    // commits it with everything else.
    await page.getByRole("button", { name: "Edit question" }).first().click();
    const faqDialog = page.getByRole("dialog");
    // NOT `{ exact: true }`. The field is `<Field required>`, and the asterisk
    // it draws is part of the label's text content — `aria-hidden` keeps a
    // screen reader from saying "star", but `getByLabel` reads the text, so an
    // exact "Question" matches nothing. Worth knowing before writing the next
    // admin spec: exact label matching and ADR-077's required marker do not
    // mix.
    await fillField(faqDialog.getByLabel("Question"), newQuestion);
    await faqDialog.getByRole("button", { name: "Save question" }).click();
    await expect(faqDialog).toHaveCount(0);

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
    await openAdminScreen(page, `/admin/articles/${article.articleId}`);
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
    await openAdminScreen(page, "/admin/articles");

    // The seeded article's OWN row, by its title. `.first()` was what this
    // said, and it happened to be the right row — the tools spec had the same
    // line and flipped the wrong record, which is the more likely outcome the
    // moment a fixture is added above it.
    const row = page.getByRole("row").filter({ hasText: before.title });
    await row.getByRole("button", { name: "Open actions" }).click();
    await page
      .getByRole("menuitem", {
        name: before.article.isFeatured ? "Unset Featured" : "Set Featured",
      })
      .click();

    await expect
      .poll(() => seededArticle().article.isFeatured, { timeout: 15_000 })
      .toBe(!before.article.isFeatured);

    // Put it back. `reloadAdminScreen`, not `page.reload()`: a reload lands on
    // un-hydrated markup exactly like a navigation does, and the menu trigger
    // clicked before its handler existed simply did nothing.
    await reloadAdminScreen(page);
    await row.getByRole("button", { name: "Open actions" }).click();
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

test.describe("criterion 15 — permission denied, asserted at the DB", () => {
  // A separate context: this user must NOT inherit the admin's storageState.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a read-only subject cannot change an article, and nothing is written", async ({ page }) => {
    const before = seededArticle();
    const hijackedTitle = `HIJACKED ${Date.now()}`;
    // The count BEFORE, not zero: criterion 14 runs earlier in this serial
    // file and saves the same article, so a zero here asserts that the
    // previous test failed.
    const auditsBefore = auditCount(before.articleId, "articles.save");

    // The STAFF credential screen (ADR-052) — this subject IS staff, just
    // staff without article write permission.
    await signInAsStaff(page, VIEWER_EMAIL, VIEWER_PASSWORD, `/admin/articles/${before.articleId}`);

    // `seo_manager` holds `analysis.view`, and the page gate is
    // `requireAnyPermission(["analysis.view", "news.manage"])` — so the editor
    // IS reachable. That is the case worth testing: the screen opens, the
    // form fills, and `saveArticleAction`'s own
    // `requireAnyPermission(["analysis.update", "news.manage"])` is the thing
    // standing between this subject and the row (security.md #1).
    await openAdminScreen(page, `/admin/articles/${before.articleId}`);
    // Anchored: a loose "Title" also matches "SEO title", and both fields are
    // in the DOM at once (the SEO panel is a tab, not a separate page). The
    // optional `*` is ADR-077's required marker, which lives in the label's
    // text.
    await fillField(page.getByLabel(/^Title\s*\*?$/), hijackedTitle);
    await page.getByRole("button", { name: HEADER_SAVE }).click();

    // A real hostile client, too: a POST straight at the route, no UI.
    //
    // Its STATUS is deliberately not asserted. A server action is a POST
    // carrying Next's own `Next-Action` header; without it this is an ordinary
    // page request, and Next answers 200 with the rendered page. The old
    // version of this test asserted `status >= 400` and would have "passed"
    // on any hole it was pointed at — what it actually measured was whether
    // the page renders. The database below is the assertion.
    await page.evaluate(async (articleId) => {
      try {
        await fetch(`/admin/articles/${articleId}`, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: JSON.stringify([{ articleId, meta: {}, translation: {} }]),
        });
      } catch {
        // A refused request is one of the acceptable outcomes.
      }
    }, before.articleId);

    // The real assertion: the database is untouched, by either route.
    await expect.poll(() => seededArticle().title, { timeout: 15_000 }).toBe(before.title);
    const after = seededArticle();
    expect(after.title).not.toContain(hijackedTitle);
    expect(after.seoTitle).toBe(before.seoTitle);
    expect(after.article.isFeatured).toBe(before.article.isFeatured);
    // And no NEW audit row claiming a save happened.
    expect(auditCount(before.articleId, "articles.save")).toBe(auditsBefore);
  });
});
