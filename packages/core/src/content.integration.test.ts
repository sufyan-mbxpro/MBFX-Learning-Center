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

// ─── ADR-069: the editor's data layer ────────────────────────

describe("loadGlossaryTermAdminDetail — the prefill regression", () => {
  // The bug this closes: `loadGlossaryAdminList` never selected a body field,
  // so the inline form it fed opened BLANK on a term written months earlier.
  // The only way to fix a typo was to retype the whole definition.
  it("returns every stored field, so the editor opens populated", async () => {
    const termId = await content.createGlossaryTerm(actor);
    await content.saveGlossaryTerm(actor, {
      termId,
      meta: { difficulty: "ADVANCED", formula: "pip = 0.0001", track: "forex" },
      translation: {
        locale: "en",
        term: "Pip A069",
        slug: "pip-a069",
        simpleExplanation: "<p>Smallest price move.</p>",
        detailedExplanation: "<p>Detailed.</p>",
        advancedExplanation: "<p>Advanced.</p>",
        exampleScenario: "<p>Example.</p>",
        faq: [{ question: "Why?", answer: "Because." }],
        seoTitle: "Pip definition",
        seoDescription: "What a pip is.",
      },
    });

    const detail = await content.loadGlossaryTermAdminDetail(termId);
    expect(detail).not.toBeNull();
    expect(detail!.difficulty).toBe("ADVANCED");
    expect(detail!.formula).toBe("pip = 0.0001");
    expect(detail!.track).toBe("forex");

    const en = detail!.translations.find((t) => t.locale === "en")!;
    expect(en.term).toBe("Pip A069");
    expect(en.slug).toBe("pip-a069");
    // The four bodies — none of these had a read path before ADR-069.
    expect(en.simpleExplanation).toContain("Smallest price move");
    expect(en.detailedExplanation).toContain("Detailed");
    expect(en.advancedExplanation).toContain("Advanced");
    expect(en.exampleScenario).toContain("Example");
    expect(en.faq).toEqual([{ question: "Why?", answer: "Because." }]);
    expect(en.seoTitle).toBe("Pip definition");
    expect(en.seoDescription).toBe("What a pip is.");
  });

  it("returns null for an id that does not exist", async () => {
    expect(await content.loadGlossaryTermAdminDetail("nope")).toBeNull();
  });

  it("drops malformed FAQ rows rather than throwing on a content screen", async () => {
    const termId = await content.createGlossaryTerm(actor);
    await content.saveGlossaryTerm(actor, {
      termId,
      meta: {},
      translation: { locale: "en", term: "Spread A069", simpleExplanation: "<p>x</p>" },
    });
    // Written straight to the Json column, bypassing the schema — this is the
    // shape a pre-ADR-069 row or a hand-edited row can hold.
    await db.glossaryTermTranslation.update({
      where: { termId_locale: { termId, locale: "en" } },
      data: { faq: [{ question: "ok", answer: "yes" }, null, { question: "no answer" }, "junk"] },
    });

    const detail = await content.loadGlossaryTermAdminDetail(termId);
    expect(detail!.translations[0]!.faq).toEqual([{ question: "ok", answer: "yes" }]);
  });
});

describe("saveGlossaryTerm — ADR-069 §2, the source hash covers all four bodies", () => {
  it("flips a sibling OUTDATED when only the WORKED EXAMPLE changed", async () => {
    // Before ADR-069 the hash covered simple + detailed only, so this edit
    // left every translation claiming to be current.
    const termId = await content.createGlossaryTerm(actor);
    const base = {
      locale: "en" as const,
      term: "Leverage A069",
      simpleExplanation: "<p>Borrowed capital.</p>",
      detailedExplanation: "<p>Unchanged.</p>",
    };
    await content.saveGlossaryTerm(actor, {
      termId,
      meta: {},
      translation: { ...base, exampleScenario: "<p>1:10 on 1,000 units.</p>" },
    });
    await content.saveGlossaryTranslation(actor, {
      termId,
      locale: "es",
      term: "Apalancamiento A069",
      simpleExplanation: "<p>Capital prestado.</p>",
    });
    expect(
      (
        await db.glossaryTermTranslation.findUniqueOrThrow({
          where: { termId_locale: { termId, locale: "es" } },
        })
      ).translationStatus,
    ).toBe("TRANSLATED");

    await content.saveGlossaryTerm(actor, {
      termId,
      meta: {},
      translation: { ...base, exampleScenario: "<p>1:30 on 1,000 units — corrected.</p>" },
    });

    expect(
      (
        await db.glossaryTermTranslation.findUniqueOrThrow({
          where: { termId_locale: { termId, locale: "es" } },
        })
      ).translationStatus,
    ).toBe("OUTDATED");
  });

  it("sanitizes each body separately (security.md #8)", async () => {
    const termId = await content.createGlossaryTerm(actor);
    await content.saveGlossaryTerm(actor, {
      termId,
      meta: {},
      translation: {
        locale: "en",
        term: "XSS A069",
        simpleExplanation: "<p>ok</p><script>alert(1)</script>",
        advancedExplanation: "<p>fine</p><img src=x onerror=alert(2)>",
        exampleScenario: "<p>safe</p><iframe src='javascript:alert(3)'></iframe>",
      },
    });
    const row = await db.glossaryTermTranslation.findUniqueOrThrow({
      where: { termId_locale: { termId, locale: "en" } },
    });
    expect(row.simpleExplanation).not.toContain("<script");
    expect(row.advancedExplanation ?? "").not.toContain("onerror");
    expect(row.exampleScenario ?? "").not.toContain("javascript:");
  });
});

describe("term filing — the two nulls (ADR-069 §3)", () => {
  it("round-trips topicId, and null means unfiled", async () => {
    const topic = await db.glossaryTopic.create({
      data: {
        translations: { create: { locale: "en", name: "Risk", slug: "risk" } },
      },
    });
    const termId = await content.createGlossaryTerm(actor, { topicId: topic.id });
    expect((await content.loadGlossaryTermAdminDetail(termId))!.topicId).toBe(topic.id);

    await content.saveGlossaryTerm(actor, {
      termId,
      meta: { topicId: null },
      translation: { locale: "en", term: "Margin A069", simpleExplanation: "<p>x</p>" },
    });
    expect((await content.loadGlossaryTermAdminDetail(termId))!.topicId).toBeNull();
  });

  it("round-trips track, and null means EVERY school — not unfiled", async () => {
    const termId = await content.createGlossaryTerm(actor, { track: "crypto" });
    expect((await content.loadGlossaryTermAdminDetail(termId))!.track).toBe("crypto");

    await content.saveGlossaryTerm(actor, {
      termId,
      meta: { track: null },
      translation: { locale: "en", term: "Volatility A069", simpleExplanation: "<p>x</p>" },
    });
    expect((await content.loadGlossaryTermAdminDetail(termId))!.track).toBeNull();
  });

  it("leaves a meta field alone when it is omitted rather than nulling it", async () => {
    // `undefined` = untouched, `null` = cleared. Conflating them would mean
    // saving the English body silently unfiled the term.
    const termId = await content.createGlossaryTerm(actor, { track: "forex" });
    await content.saveGlossaryTerm(actor, {
      termId,
      meta: {},
      translation: { locale: "en", term: "Basis Point A069", simpleExplanation: "<p>x</p>" },
    });
    expect((await content.loadGlossaryTermAdminDetail(termId))!.track).toBe("forex");
  });
});

// ─── ADR-071: scheduling stops parking content ───────────────

describe("scheduled publishing (ADR-071)", () => {
  const HOUR = 60 * 60 * 1000;
  const future = () => new Date(Date.now() + HOUR);

  /** Walk a fresh term to APPROVED — the one state SCHEDULED is reachable from. */
  async function approvedTerm(term: string): Promise<string> {
    const termId = await content.createGlossaryTerm(actor);
    await content.saveGlossaryTranslation(actor, {
      termId,
      locale: "en",
      term,
      simpleExplanation: "<p>x</p>",
    });
    await content.transitionContentStatus(actor, "glossary", termId, "IN_REVIEW");
    await content.transitionContentStatus(actor, "glossary", termId, "SEO_REVIEW");
    await content.transitionContentStatus(actor, "glossary", termId, "APPROVED");
    return termId;
  }

  async function visibleAt(termId: string, now: Date): Promise<boolean> {
    const { publicGlossaryTermWhere } = await import("./public-content.ts");
    const count = await db.glossaryTerm.count({
      where: { id: termId, ...publicGlossaryTermWhere(now) },
    });
    return count === 1;
  }

  it("refuses SCHEDULED with no date — the parked state this ADR ends", async () => {
    const termId = await approvedTerm("Carry Trade A071");

    await expect(
      content.transitionContentStatus(actor, "glossary", termId, "SCHEDULED"),
    ).rejects.toThrow(content.ScheduleInPastError);

    // Refused, not defaulted to "now": the row has not moved.
    const row = await db.glossaryTerm.findUniqueOrThrow({ where: { id: termId } });
    expect(row.status).toBe("APPROVED");
    expect(row.scheduledFor).toBeNull();
  });

  it("refuses a date in the past", async () => {
    const termId = await approvedTerm("Slippage A071");
    await expect(
      content.transitionContentStatus(
        actor,
        "glossary",
        termId,
        "SCHEDULED",
        new Date(Date.now() - HOUR),
      ),
    ).rejects.toThrow(content.ScheduleInPastError);
  });

  it("requires the publish permission, exactly as PUBLISHED does", async () => {
    // SCHEDULED puts content in front of readers on a timer, so it is a
    // publishing move — gating it any lower would be a way around `*.publish`.
    const termId = await approvedTerm("Rollover A071");
    const noPublishActor: Subject = { ...actor, allowed: new Set() };
    await expect(
      content.transitionContentStatus(noPublishActor, "glossary", termId, "SCHEDULED", future()),
    ).rejects.toThrow(content.PublishPermissionError);
  });

  it("stays invisible until its moment, then goes public BEFORE any sweep runs", async () => {
    // The load-bearing property (ADR-071 #1): visibility is decided by the
    // QUERY, so a sweep that is late, failed or never configured delays
    // nothing. Nothing is swept anywhere in this test.
    const termId = await approvedTerm("Basis A071");
    const when = future();
    await content.transitionContentStatus(actor, "glossary", termId, "SCHEDULED", when);

    const row = await db.glossaryTerm.findUniqueOrThrow({ where: { id: termId } });
    expect(row.status).toBe("SCHEDULED");
    expect(row.scheduledFor?.getTime()).toBe(when.getTime());
    expect(row.publishedAt).toBeNull();

    expect(await visibleAt(termId, new Date(when.getTime() - 1000))).toBe(false);
    expect(await visibleAt(termId, new Date(when.getTime() + 1000))).toBe(true);
  });

  it("reports the promised time as the publish time while it is still unswept", async () => {
    const termId = await approvedTerm("Contango A071");
    const when = future();
    await content.transitionContentStatus(actor, "glossary", termId, "SCHEDULED", when);
    const row = await db.glossaryTerm.findUniqueOrThrow({ where: { id: termId } });

    expect(content.effectivePublishedAt(row)?.getTime()).toBe(when.getTime());
  });

  it("the sweep flips a due row once, stamping the PROMISED time, not the sweep's", async () => {
    const termId = await approvedTerm("Backwardation A071");
    const when = future();
    await content.transitionContentStatus(actor, "glossary", termId, "SCHEDULED", when);

    const sweptAt = new Date(when.getTime() + 30 * 60 * 1000);
    expect(await content.publishDueContent(sweptAt)).toBeGreaterThanOrEqual(1);

    const published = await db.glossaryTerm.findUniqueOrThrow({ where: { id: termId } });
    expect(published.status).toBe("PUBLISHED");
    // Half an hour late, and "published at" still reads the promised minute.
    expect(published.publishedAt?.getTime()).toBe(when.getTime());
    expect(published.scheduledFor).toBeNull();

    // Idempotent: a second sweep finds nothing to do on this row and must not
    // restamp it — the row no longer matches `status: SCHEDULED`.
    await content.publishDueContent(sweptAt);
    const again = await db.glossaryTerm.findUniqueOrThrow({ where: { id: termId } });
    expect(again.publishedAt?.getTime()).toBe(when.getTime());
  });

  it("leaves an un-due row alone", async () => {
    const termId = await approvedTerm("Vega A071");
    const when = future();
    await content.transitionContentStatus(actor, "glossary", termId, "SCHEDULED", when);

    await content.publishDueContent(new Date(when.getTime() - 60 * 1000));
    expect((await db.glossaryTerm.findUniqueOrThrow({ where: { id: termId } })).status).toBe(
      "SCHEDULED",
    );
  });

  it("sweeps every entity on the machine, not only the one it was written against", async () => {
    // `publishDueContent` loops five delegates. A test against glossary alone
    // would pass with four of them missing from that map.
    const { createCourse } = await import("./courses.ts");
    const publisher: Subject = {
      ...actor,
      allowed: new Set(["glossary.publish", "courses.publish"]),
    };
    const courseId = await createCourse(publisher, { track: "forex", title: "Scheduled A071" });
    await content.transitionContentStatus(publisher, "courses", courseId, "IN_REVIEW");
    await content.transitionContentStatus(publisher, "courses", courseId, "SEO_REVIEW");
    await content.transitionContentStatus(publisher, "courses", courseId, "APPROVED");

    const when = future();
    await content.transitionContentStatus(publisher, "courses", courseId, "SCHEDULED", when);
    await content.publishDueContent(new Date(when.getTime() + 1000));

    const course = await db.course.findUniqueOrThrow({ where: { id: courseId } });
    expect(course.status).toBe("PUBLISHED");
    expect(course.publishedAt?.getTime()).toBe(when.getTime());
  });

  it("clears the date on every move that is not itself a schedule", async () => {
    // The seven-state machine allows SCHEDULED → APPROVED, which the article
    // machine does not. Enumerating the destinations that clear (PUBLISHED and
    // DRAFT — the article rule, copied) left an APPROVED row carrying a date
    // that would never fire, and the editor's panel renders that verbatim as
    // "Scheduled: …" on a row that is not scheduled.
    const pulled = await approvedTerm("Gamma A071");
    await content.transitionContentStatus(actor, "glossary", pulled, "SCHEDULED", future());
    await content.transitionContentStatus(actor, "glossary", pulled, "APPROVED");
    expect(
      (await db.glossaryTerm.findUniqueOrThrow({ where: { id: pulled } })).scheduledFor,
    ).toBeNull();

    // Publishing early clears it too, and stamps the real moment rather than
    // the abandoned promise.
    const early = await approvedTerm("Theta A071");
    const when = future();
    await content.transitionContentStatus(actor, "glossary", early, "SCHEDULED", when);
    await content.transitionContentStatus(actor, "glossary", early, "PUBLISHED");
    const row = await db.glossaryTerm.findUniqueOrThrow({ where: { id: early } });
    expect(row.scheduledFor).toBeNull();
    expect(row.publishedAt!.getTime()).toBeLessThan(when.getTime());
  });
});
