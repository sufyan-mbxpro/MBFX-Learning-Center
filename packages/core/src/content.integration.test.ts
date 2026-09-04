// Module 11 required tests: status-machine illegal transitions, publish
// permission, the XSS regression suite (server-side sanitize on save),
// translation OUTDATED lifecycle on REAL rows, slug change → 301 redirect
// row, soft delete + restore round trip.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { db as DbClient } from "@repo/db";
import type { Subject } from "@repo/rbac";
import type * as ContentModule from "./content.ts";
import { assertTransition, sanitizeRichText, slugify, IllegalTransitionError } from "./content.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let content: typeof ContentModule;
let actor: Subject;

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
  content = await import("./content.ts");

  const user = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      email: "content-actor@x.com",
      name: "A",
      status: "ACTIVE",
      userType: "STAFF",
    },
  });
  actor = {
    id: user.id,
    userType: "STAFF",
    roleKeys: [],
    maxRoleLevel: 50,
    allowed: new Set(["glossary.publish"]),
    denied: new Set(),
  };

  await db.locale.create({
    data: {
      code: "en",
      name: "English",
      nativeName: "English",
      direction: "LTR",
      isDefault: true,
      isActive: true,
      sortOrder: 1,
    },
  });
  await db.locale.create({
    data: {
      code: "es",
      name: "Spanish",
      nativeName: "Español",
      direction: "LTR",
      isActive: false,
      sortOrder: 2,
      fallbackCode: "en",
    },
  });
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

// ─── Pure: status machine + sanitize + slugify ───────────────

describe("status machine", () => {
  it("rejects DRAFT → PUBLISHED outright (must pass review)", () => {
    expect(() => assertTransition("DRAFT", "PUBLISHED")).toThrow(IllegalTransitionError);
  });

  it("rejects IN_REVIEW → APPROVED (SEO review is not skippable)", () => {
    expect(() => assertTransition("IN_REVIEW", "APPROVED")).toThrow(IllegalTransitionError);
  });

  it("accepts the full happy path DRAFT → IN_REVIEW → SEO_REVIEW → APPROVED → PUBLISHED → ARCHIVED → DRAFT", () => {
    expect(() => {
      assertTransition("DRAFT", "IN_REVIEW");
      assertTransition("IN_REVIEW", "SEO_REVIEW");
      assertTransition("SEO_REVIEW", "APPROVED");
      assertTransition("APPROVED", "PUBLISHED");
      assertTransition("PUBLISHED", "ARCHIVED");
      assertTransition("ARCHIVED", "DRAFT");
    }).not.toThrow();
  });
});

describe("sanitizeRichText — XSS regression suite (security.md #8)", () => {
  it("strips script tags and their content", () => {
    expect(sanitizeRichText('<p>hi</p><script>alert("xss")</script>')).toBe("<p>hi</p>");
  });

  it("strips inline event handlers", () => {
    expect(sanitizeRichText('<img src="https://x.com/a.png" onerror="alert(1)" alt="a" />')).toBe(
      '<img src="https://x.com/a.png" alt="a" />',
    );
  });

  it("strips javascript: URLs but keeps https links", () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(sanitizeRichText('<a href="https://example.com">x</a>')).toBe(
      '<a href="https://example.com">x</a>',
    );
  });

  it("strips style attributes and tags (styling belongs to the theme engine)", () => {
    expect(sanitizeRichText('<p style="color:red">x</p><style>p{}</style>')).toBe("<p>x</p>");
  });

  it("keeps the Tiptap rich-text vocabulary", () => {
    const html =
      "<h2>Title</h2><ul><li><strong>b</strong> and <em>i</em></li></ul><pre><code>x</code></pre>";
    expect(sanitizeRichText(html)).toBe(html);
  });
});

describe("slugify", () => {
  it("lowercases, strips accents, collapses separators", () => {
    expect(slugify("  Pip Value — Fórmula!  ")).toBe("pip-value-formula");
  });
});

// ─── DB-backed lifecycle ─────────────────────────────────────

describe("transitionContentStatus", () => {
  it("moves a glossary term along legal transitions, refuses illegal ones, and gates publish on glossary.publish", async () => {
    const termId = await content.createGlossaryTerm(actor);

    await expect(
      content.transitionContentStatus(actor, "glossary", termId, "PUBLISHED"),
    ).rejects.toThrow(IllegalTransitionError);

    await content.transitionContentStatus(actor, "glossary", termId, "IN_REVIEW");
    await content.transitionContentStatus(actor, "glossary", termId, "SEO_REVIEW");
    await content.transitionContentStatus(actor, "glossary", termId, "APPROVED");

    const noPublishActor: Subject = { ...actor, allowed: new Set() };
    await expect(
      content.transitionContentStatus(noPublishActor, "glossary", termId, "PUBLISHED"),
    ).rejects.toThrow(content.PublishPermissionError);

    await content.transitionContentStatus(actor, "glossary", termId, "PUBLISHED");
    const term = await db.glossaryTerm.findUniqueOrThrow({ where: { id: termId } });
    expect(term.status).toBe("PUBLISHED");
    expect(term.publishedAt).not.toBeNull();
  });
});

describe("glossary translation lifecycle — sourceHash OUTDATED flip on real rows", () => {
  it("edit EN source → ES flips OUTDATED → retranslate ES → TRANSLATED again", async () => {
    const termId = await content.createGlossaryTerm(actor);

    await content.saveGlossaryTranslation(actor, {
      termId,
      locale: "en",
      term: "Pip",
      simpleExplanation: "<p>Smallest price move v1</p>",
    });
    await content.saveGlossaryTranslation(actor, {
      termId,
      locale: "es",
      term: "Pip",
      simpleExplanation: "<p>Movimiento mínimo</p>",
    });
    let es = await db.glossaryTermTranslation.findUniqueOrThrow({
      where: { termId_locale: { termId, locale: "es" } },
    });
    expect(es.translationStatus).toBe("TRANSLATED");

    // Source edit → stale sibling flips.
    await content.saveGlossaryTranslation(actor, {
      termId,
      locale: "en",
      term: "Pip",
      simpleExplanation: "<p>Smallest price move v2 — corrected</p>",
    });
    es = await db.glossaryTermTranslation.findUniqueOrThrow({
      where: { termId_locale: { termId, locale: "es" } },
    });
    expect(es.translationStatus).toBe("OUTDATED");
    expect(await content.listOutdatedGlossaryTranslations()).toContainEqual({
      termId,
      locale: "es",
      term: "Pip",
    });

    // Retranslate → up to date again.
    await content.saveGlossaryTranslation(actor, {
      termId,
      locale: "es",
      term: "Pip",
      simpleExplanation: "<p>Movimiento mínimo v2</p>",
    });
    es = await db.glossaryTermTranslation.findUniqueOrThrow({
      where: { termId_locale: { termId, locale: "es" } },
    });
    expect(es.translationStatus).toBe("TRANSLATED");

    // Idempotent source re-save with the SAME content must NOT flip ES.
    await content.saveGlossaryTranslation(actor, {
      termId,
      locale: "en",
      term: "Pip",
      simpleExplanation: "<p>Smallest price move v2 — corrected</p>",
    });
    es = await db.glossaryTermTranslation.findUniqueOrThrow({
      where: { termId_locale: { termId, locale: "es" } },
    });
    expect(es.translationStatus).toBe("TRANSLATED");
  });

  it("content is sanitized ON SAVE — a script-tag payload never reaches the row", async () => {
    const termId = await content.createGlossaryTerm(actor);
    await content.saveGlossaryTranslation(actor, {
      termId,
      locale: "en",
      term: "XSS",
      simpleExplanation: '<p>ok</p><script>alert("boom")</script>',
    });
    const row = await db.glossaryTermTranslation.findUniqueOrThrow({
      where: { termId_locale: { termId, locale: "en" } },
    });
    expect(row.simpleExplanation).toBe("<p>ok</p>");
    expect(row.simpleExplanation).not.toContain("script");
  });

  it("a slug change writes a 301 Redirect from the old public path (locale-prefix aware)", async () => {
    const termId = await content.createGlossaryTerm(actor);
    await content.saveGlossaryTranslation(actor, {
      termId,
      locale: "en",
      term: "Spread",
      slug: "spread-old",
      simpleExplanation: "<p>x</p>",
    });
    await content.saveGlossaryTranslation(actor, {
      termId,
      locale: "en",
      term: "Spread",
      slug: "spread-new",
      simpleExplanation: "<p>x</p>",
    });

    const redirect = await db.redirect.findUniqueOrThrow({
      where: { fromPath: "/glossary/spread-old" },
    });
    expect(redirect.toPath).toBe("/glossary/spread-new");
    expect(redirect.statusCode).toBe(301);

    // Non-default locale paths keep their prefix.
    await content.saveGlossaryTranslation(actor, {
      termId,
      locale: "es",
      term: "Spread",
      slug: "diferencial",
      simpleExplanation: "<p>x</p>",
    });
    await content.saveGlossaryTranslation(actor, {
      termId,
      locale: "es",
      term: "Spread",
      slug: "diferencial-v2",
      simpleExplanation: "<p>x</p>",
    });
    await expect(
      db.redirect.findUniqueOrThrow({ where: { fromPath: "/es/glossary/diferencial" } }),
    ).resolves.toMatchObject({ toPath: "/es/glossary/diferencial-v2" });
  });
});

describe("soft delete + restore", () => {
  it("round-trips deletedAt and audits both directions", async () => {
    const termId = await content.createGlossaryTerm(actor);
    await content.setGlossaryTermDeleted(actor, termId, true);
    expect(
      (await db.glossaryTerm.findUniqueOrThrow({ where: { id: termId } })).deletedAt,
    ).not.toBeNull();

    await content.setGlossaryTermDeleted(actor, termId, false);
    expect(
      (await db.glossaryTerm.findUniqueOrThrow({ where: { id: termId } })).deletedAt,
    ).toBeNull();

    expect(
      await db.auditLog.count({
        where: { entityId: termId, action: { in: ["glossary.softDelete", "glossary.restore"] } },
      }),
    ).toBe(2);
  });
});
