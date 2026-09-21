// Site-wide public search against a real MariaDB (ADR-108).
//
// Integration rather than unit, and not negotiable for this module: the whole
// claim being tested is that search sees exactly what the pages see, and that
// claim is made of `where` clauses. A mocked Prisma would confirm the shape of
// an object we wrote and prove nothing about which rows come back — the
// failure testing.md warns about by name.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { db as DbClient } from "@repo/db";
import type * as PublicSearch from "./public-search.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let search: typeof PublicSearch;

const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_test")
    .withUsername("test")
    .withUserPassword("test")
    .start();

  const url = container.getConnectionUri().replace(/^mariadb:/, "mysql:");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: dbPackageRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  process.env.DATABASE_URL = url;
  db = (await import("@repo/db")).db;
  search = await import("./public-search.ts");

  const category = await db.articleCategory.create({
    data: {
      sortOrder: 1,
      translations: { create: { locale: "en", name: "Market News", slug: "market-news" } },
    },
  });

  // Four articles that differ ONLY in the thing being tested: one published,
  // one draft, one scheduled for tomorrow, one scheduled for yesterday.
  const article = (
    status: "PUBLISHED" | "DRAFT" | "SCHEDULED",
    title: string,
    slug: string,
    scheduledFor: Date | null,
    kind: "NEWS" | "ANALYSIS" = "NEWS",
  ) =>
    db.article.create({
      data: {
        kind,
        status,
        scheduledFor,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        isActive: true,
        categoryId: category.id,
        translations: {
          create: {
            locale: "en",
            title,
            slug,
            excerpt: "An excerpt about pipvalue.",
            translationStatus: "TRANSLATED",
          },
        },
      },
    });

  await article("PUBLISHED", "Zephyr published news", "zephyr-published", null);
  await article("DRAFT", "Zephyr draft news", "zephyr-draft", null);
  await article("SCHEDULED", "Zephyr future news", "zephyr-future", new Date(Date.now() + DAY));
  await article("SCHEDULED", "Zephyr due news", "zephyr-due", new Date(Date.now() - DAY));
  await article("PUBLISHED", "Zephyr analysis piece", "zephyr-analysis", null, "ANALYSIS");

  await db.glossaryTerm.create({
    data: {
      status: "PUBLISHED",
      translations: {
        create: {
          locale: "en",
          term: "Zephyr spread",
          slug: "zephyr-spread",
          simpleExplanation: "<p>The gap between <em>bid</em> and ask.</p>",
          translationStatus: "TRANSLATED",
        },
      },
    },
  });

  // A private course: PUBLISHED but not PUBLIC, so it must not surface.
  await db.course.create({
    data: {
      track: "forex",
      status: "PUBLISHED",
      visibility: "AUTHENTICATED",
      translations: {
        create: { locale: "en", title: "Zephyr gated course", slug: "zephyr-gated" },
      },
    },
  });
  await db.course.create({
    data: {
      track: "forex",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      translations: {
        create: {
          locale: "en",
          title: "Zephyr open course",
          slug: "zephyr-open",
          summary: "Learn.",
        },
      },
    },
  });
}, 180_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

describe("searchPublicContent — visibility (ADR-108 #2)", () => {
  it("returns a published article and hides the draft and the not-yet-due schedule", async () => {
    const { hits } = await search.searchPublicContent("en", "Zephyr");
    const slugs = hits.filter((h) => h.kind === "article").map((h) => h.href);

    expect(slugs).toContain("/news/zephyr-published");
    // ADR-071: SCHEDULED and due IS public, which is why the query decides
    // rather than the sweep.
    expect(slugs).toContain("/news/zephyr-due");
    expect(slugs).not.toContain("/news/zephyr-draft");
    expect(slugs).not.toContain("/news/zephyr-future");
  });

  it("sends an ANALYSIS article to /analysis, not /news", async () => {
    // Getting this wrong 404s a hit that exists — the two public surfaces
    // filter on `kind` (ADR-015).
    const { hits } = await search.searchPublicContent("en", "analysis piece");
    expect(hits.map((h) => h.href)).toContain("/analysis/zephyr-analysis");
  });

  it("hides a course that is published but not PUBLIC", async () => {
    const { hits } = await search.searchPublicContent("en", "Zephyr");
    const courses = hits.filter((h) => h.kind === "course").map((h) => h.href);
    expect(courses).toContain("/learn/forex/zephyr-open");
    expect(courses).not.toContain("/learn/forex/zephyr-gated");
  });
});

describe("searchPublicContent — the query itself", () => {
  it("returns nothing below the minimum length rather than everything", async () => {
    expect((await search.searchPublicContent("en", "Z")).hits).toEqual([]);
    expect((await search.searchPublicContent("en", " ")).hits).toEqual([]);
  });

  it("treats a lone wildcard as no query, not as `match everything`", async () => {
    // `%` is a wildcard to MariaDB inside a `contains`. One typed character
    // must not turn the palette into a table dump.
    expect((await search.searchPublicContent("en", "%")).hits).toEqual([]);
    expect((await search.searchPublicContent("en", "%%%%")).hits).toEqual([]);
  });

  it("shows a term's rich-text explanation as plain text, and does not search it", async () => {
    const { hits } = await search.searchPublicContent("en", "Zephyr spread");
    const term = hits.find((hit) => hit.kind === "glossary");
    expect(term?.href).toBe("/glossary/zephyr-spread");
    // `simpleExplanation` is rich text (ADR-069). A palette row showing `<p>`
    // is the bug that made the glossary A–Z match tag names.
    expect(term?.excerpt).toBe("The gap between bid and ask.");
    expect(term?.excerpt).not.toContain("<");
  });

  it("does not match a tag name inside a rich-text field", async () => {
    // The other half of the same decision: the stored explanation contains
    // `<em>`, and a reader typing "em" is looking for a word, not for markup.
    const { hits } = await search.searchPublicContent("en", "em>");
    expect(hits.filter((hit) => hit.kind === "glossary")).toEqual([]);
  });

  it("returns a locale-less href, so the caller owns the prefix", async () => {
    const { hits } = await search.searchPublicContent("en", "Zephyr");
    for (const hit of hits) {
      expect(hit.href.startsWith("/")).toBe(true);
      expect(hit.href.startsWith("/en/")).toBe(false);
    }
  });

  it("finds nothing in a locale that has no translations", async () => {
    // ADR-007: search finds what THIS locale can show, never a silently
    // English row inside another language's page.
    expect((await search.searchPublicContent("ar", "Zephyr")).hits).toEqual([]);
  });

  it("honours `kinds`, so a route can drop a flagged-off section", async () => {
    const { hits } = await search.searchPublicContent("en", "Zephyr", { kinds: ["glossary"] });
    expect(hits.every((hit) => hit.kind === "glossary")).toBe(true);
  });

  it("reports truncation instead of silently capping", async () => {
    const wide = await search.searchPublicContent("en", "Zephyr", { perSection: 1 });
    expect(wide.truncated).toBe(true);
    expect(wide.hits.filter((hit) => hit.kind === "article")).toHaveLength(1);
  });

  it("finds a row by its words, not only by the exact phrase (changes-36)", async () => {
    // "open Zephyr" appears nowhere as a substring; "Zephyr open course" has
    // both words. The old single-LIKE search returned nothing here.
    const { hits } = await search.searchPublicContent("en", "open Zephyr");
    const courses = hits.filter((hit) => hit.kind === "course");
    expect(courses[0]?.href).toBe("/learn/forex/zephyr-open");
  });

  it("ignores filler words once the query has a real one", async () => {
    const { hits } = await search.searchPublicContent("en", "what is a zephyr spread");
    expect(hits.find((hit) => hit.kind === "glossary")?.href).toBe("/glossary/zephyr-spread");
  });

  it("still applies visibility when matching by words", async () => {
    const { hits } = await search.searchPublicContent("en", "draft Zephyr");
    expect(hits.map((hit) => hit.href)).not.toContain("/news/zephyr-draft");
  });

  it("matches a static page the caller supplied, and only when it matches", async () => {
    const pages = [
      { id: "pip-value", title: "Pip value", excerpt: null, href: "/tools/pip-value" },
    ];
    const hit = await search.searchPublicContent("en", "pip", { staticPages: pages });
    expect(hit.hits.map((h) => h.href)).toContain("/tools/pip-value");

    const miss = await search.searchPublicContent("en", "Zephyr", { staticPages: pages });
    expect(miss.hits.map((h) => h.href)).not.toContain("/tools/pip-value");
  });
});
