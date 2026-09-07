import { expect, test } from "@playwright/test";
import { seededArticle } from "../db.ts";

// changes-07 plan criterion 19, as an anonymous visitor. ADR-006's
// learner-session probe against /admin rides along here because this is the
// only project in the suite that runs unauthenticated.

test("emits both the article and FAQPage JSON-LD graphs", async ({ page }) => {
  const article = seededArticle();
  await page.goto(`/news/${article.slug}`);

  const graphs = await page.locator('script[type="application/ld+json"]').allTextContents();
  const parsed = graphs.map((g) => JSON.parse(g) as { "@type": string; mainEntity?: unknown[] });
  const types = parsed.map((g) => g["@type"]);

  expect(types).toContain("AnalysisNewsArticle");
  expect(types).toContain("FAQPage");

  // The FAQPage mirrors the stored rows — the whole admin → DB → public path.
  const faq = parsed.find((g) => g["@type"] === "FAQPage");
  const questions = (faq?.mainEntity as { name: string }[]).map((q) => q.name);
  expect(questions).toEqual(article.faqItems.map((f) => f.question));
});

test("renders the FAQ accordion and the article body", async ({ page }) => {
  const article = seededArticle();
  await page.goto(`/news/${article.slug}`);

  await expect(page.getByRole("heading", { name: "Frequently asked questions" })).toBeVisible();
  for (const item of article.faqItems) {
    await expect(page.getByText(item.question, { exact: true })).toBeVisible();
  }
});

test("omits the robots meta when indexing and following are both allowed", async ({ page }) => {
  const article = seededArticle();
  await page.goto(`/news/${article.slug}`);

  // noIndex and noFollow are independent since changes-07; with both allowed
  // the tag should be absent entirely rather than emitted as "index, follow".
  expect(article.noIndex).toBe(false);
  expect(article.noFollow).toBe(false);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    /summary(_large_image)?/,
  );
});

test("ADR-006 — an anonymous visitor cannot reach any /admin route", async ({ page }) => {
  for (const path of ["/admin", "/admin/articles", "/admin/users", "/admin/settings"]) {
    const response = await page.goto(path);
    // Either bounced to sign-in by the proxy, or refused outright. What must
    // never happen is a 200 that renders admin content.
    const url = page.url();
    const redirectedToSignIn = url.includes("/sign-in");
    const refused = (response?.status() ?? 200) >= 400;
    expect(redirectedToSignIn || refused, `${path} was reachable anonymously`).toBe(true);
  }
});
