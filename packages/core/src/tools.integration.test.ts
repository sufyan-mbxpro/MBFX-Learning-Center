// The tools service against real MariaDB (ADR-086).
//
// Four properties, and the first two are the ones that would be silently wrong
// without a test: that saving is ONE transaction, and that the source hash
// covers `faq` — question and answer — so an FAQ-only edit flips sibling
// translations OUTDATED exactly as a body edit does. ADR-069 records the
// glossary learning that lesson the hard way.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type * as ToolsModule from "./tools.ts";
import type * as RelationsModule from "./content-relations.ts";
import type { db as DbClient } from "@repo/db";
import type { Subject } from "@repo/rbac";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let tools: typeof ToolsModule;
let relations: typeof RelationsModule;

const subject: Subject = {
  id: "actor-1",
  userType: "STAFF",
  roleKeys: [],
  maxRoleLevel: 100,
  allowed: new Set(),
  denied: new Set(),
};

const GAIN_LOSS_CONFIG = { defaultStartBalance: 10000, decimals: 2 };

function saveInput(overrides: Record<string, unknown> = {}) {
  return {
    key: "gain-loss",
    isEnabled: true,
    sortOrder: 0,
    coverAssetId: null,
    relatedCount: 6,
    showRelated: true,
    config: GAIN_LOSS_CONFIG,
    translation: { locale: "en", title: "Gain & loss", tagline: "Work it out." },
    related: [],
    ...overrides,
  } as never;
}

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
  tools = await import("./tools.ts");
  relations = await import("./content-relations.ts");

  await db.locale.createMany({
    data: [
      {
        code: "en",
        name: "English",
        nativeName: "English",
        direction: "LTR",
        isDefault: true,
        isActive: true,
        sortOrder: 1,
      },
      {
        code: "es",
        name: "Spanish",
        nativeName: "Español",
        direction: "LTR",
        isDefault: false,
        isActive: true,
        sortOrder: 2,
      },
    ],
  });
  await db.user.create({
    data: { id: "actor-1", email: "a@b.test", name: "A", userType: "STAFF" },
  });
}, 180_000);

afterAll(async () => {
  await db.$disconnect();
  await container.stop();
});

afterEach(async () => {
  await db.contentRelation.deleteMany();
  await db.toolTranslation.deleteMany();
  await db.tool.deleteMany();
  await db.auditLog.deleteMany();
});

describe("saveTool", () => {
  it("creates the tool, its translation and its relations together", async () => {
    await tools.saveTool(
      subject,
      saveInput({ related: [{ targetType: "lesson", targetId: "l1" }] }),
    );

    expect(await db.tool.count()).toBe(1);
    expect(await db.toolTranslation.count()).toBe(1);
    expect(await db.contentRelation.count()).toBe(1);
  });

  it("writes NOTHING when the config does not match the key", async () => {
    // One transaction, and the config check runs before it opens: a rejected
    // save must not leave a tool row behind for the next save to update.
    await expect(
      tools.saveTool(subject, saveInput({ config: { windows: ["30d"] } })),
    ).rejects.toThrow(/not valid/);

    expect(await db.tool.count()).toBe(0);
    expect(await db.toolTranslation.count()).toBe(0);
  });

  it("refuses a key the registry does not know", async () => {
    await expect(tools.saveTool(subject, saveInput({ key: "not-a-tool" }))).rejects.toThrow(
      /not a registered tool/,
    );
  });

  it("sanitises rich text on SAVE, not only on render", async () => {
    await tools.saveTool(
      subject,
      saveInput({
        translation: {
          locale: "en",
          title: "Gain & loss",
          intro: "<p>ok</p><script>alert(1)</script>",
          body: '<p onclick="steal()">body</p>',
        },
      }),
    );
    const row = await db.toolTranslation.findFirst();
    expect(row!.intro).not.toContain("<script");
    expect(row!.body).not.toContain("onclick");
    expect(row!.intro).toContain("ok");
  });

  it("sanitises FAQ answers too", async () => {
    await tools.saveTool(
      subject,
      saveInput({
        translation: {
          locale: "en",
          title: "T",
          faq: [{ question: "Why?", answer: "<p>because</p><script>x()</script>" }],
        },
      }),
    );
    const row = await db.toolTranslation.findFirst();
    expect(JSON.stringify(row!.faq)).not.toContain("<script");
  });

  it("writes an empty FAQ array rather than leaving the column alone", async () => {
    // `undefined` means "don't touch" to Prisma. An empty array is the honest
    // representation of "the author removed every question", and conflating
    // them makes a deletion impossible.
    await tools.saveTool(
      subject,
      saveInput({
        translation: { locale: "en", title: "T", faq: [{ question: "Q", answer: "A" }] },
      }),
    );
    await tools.saveTool(
      subject,
      saveInput({ translation: { locale: "en", title: "T", faq: [] } }),
    );

    const row = await db.toolTranslation.findFirst();
    expect(row!.faq).toEqual([]);
  });
});

describe("the source hash (ADR-069's rule, applied here)", () => {
  async function seedTranslated() {
    await tools.saveTool(
      subject,
      saveInput({
        translation: {
          locale: "en",
          title: "T",
          body: "<p>body</p>",
          faq: [{ question: "Q", answer: "<p>A</p>" }],
        },
      }),
    );
    const tool = (await db.tool.findFirst())!;
    // A sibling that claims to be current against the hash just written.
    const en = (await db.toolTranslation.findFirst({ where: { locale: "en" } }))!;
    await db.toolTranslation.create({
      data: {
        toolId: tool.id,
        locale: "es",
        title: "T (es)",
        sourceHash: en.sourceHash,
        translationStatus: "TRANSLATED",
      },
    });
    return tool;
  }

  it("flips a sibling OUTDATED when the BODY changes", async () => {
    await seedTranslated();
    await tools.saveTool(
      subject,
      saveInput({
        translation: {
          locale: "en",
          title: "T",
          body: "<p>different</p>",
          faq: [{ question: "Q", answer: "<p>A</p>" }],
        },
      }),
    );
    const es = await db.toolTranslation.findFirst({ where: { locale: "es" } });
    expect(es!.translationStatus).toBe("OUTDATED");
  });

  it("flips a sibling OUTDATED when only an FAQ ANSWER changes", async () => {
    // The exact bug ADR-069 found in the glossary: a hash that covers some of
    // the prose lets an edit to the rest ship while translations claim to be
    // current.
    await seedTranslated();
    await tools.saveTool(
      subject,
      saveInput({
        translation: {
          locale: "en",
          title: "T",
          body: "<p>body</p>",
          faq: [{ question: "Q", answer: "<p>DIFFERENT</p>" }],
        },
      }),
    );
    const es = await db.toolTranslation.findFirst({ where: { locale: "es" } });
    expect(es!.translationStatus).toBe("OUTDATED");
  });

  it("flips a sibling OUTDATED when only an FAQ QUESTION changes", async () => {
    await seedTranslated();
    await tools.saveTool(
      subject,
      saveInput({
        translation: {
          locale: "en",
          title: "T",
          body: "<p>body</p>",
          faq: [{ question: "DIFFERENT?", answer: "<p>A</p>" }],
        },
      }),
    );
    const es = await db.toolTranslation.findFirst({ where: { locale: "es" } });
    expect(es!.translationStatus).toBe("OUTDATED");
  });

  it("leaves a sibling alone when nothing in the prose changed", async () => {
    await seedTranslated();
    await tools.saveTool(
      subject,
      saveInput({
        sortOrder: 3,
        translation: {
          locale: "en",
          title: "T",
          body: "<p>body</p>",
          faq: [{ question: "Q", answer: "<p>A</p>" }],
        },
      }),
    );
    const es = await db.toolTranslation.findFirst({ where: { locale: "es" } });
    expect(es!.translationStatus).toBe("TRANSLATED");
  });

  it("does not recompute the hash from a NON-source locale", async () => {
    await seedTranslated();
    const before = (await db.toolTranslation.findFirst({ where: { locale: "en" } }))!.sourceHash;
    await tools.saveTool(
      subject,
      saveInput({ translation: { locale: "es", title: "Totalmente distinto" } }),
    );
    const after = (await db.toolTranslation.findFirst({ where: { locale: "en" } }))!.sourceHash;
    expect(after).toBe(before);
  });
});

describe("mixed relations (ADR-086 #4)", () => {
  it("keeps ORDER ACROSS types, not within each one", async () => {
    // The reason `replaceMixedRelations` exists. Running the per-type helper
    // once per type restarts sortOrder at zero for each, so this list would
    // come back grouped rather than interleaved.
    const ordered = [
      { targetType: "lesson", targetId: "l1" },
      { targetType: "article", targetId: "a1" },
      { targetType: "lesson", targetId: "l2" },
      { targetType: "glossary", targetId: "g1" },
    ];
    await tools.saveTool(subject, saveInput({ related: ordered }));
    const tool = (await db.tool.findFirst())!;

    const loaded = await relations.loadMixedRelationTargets({
      sourceType: relations.TOOL,
      sourceId: tool.id,
      relationType: relations.RELATED,
    });
    expect(loaded).toEqual(ordered);
  });

  it("replaces rather than merges", async () => {
    await tools.saveTool(
      subject,
      saveInput({ related: [{ targetType: "lesson", targetId: "l1" }] }),
    );
    await tools.saveTool(
      subject,
      saveInput({ related: [{ targetType: "article", targetId: "a1" }] }),
    );

    const tool = (await db.tool.findFirst())!;
    const loaded = await relations.loadMixedRelationTargets({
      sourceType: relations.TOOL,
      sourceId: tool.id,
      relationType: relations.RELATED,
    });
    expect(loaded).toEqual([{ targetType: "article", targetId: "a1" }]);
  });

  it("deduplicates on the PAIR, so the same id under two types both survive", async () => {
    // A lesson and an article may genuinely share an id across tables;
    // collapsing on id alone would silently drop one.
    await tools.saveTool(
      subject,
      saveInput({
        related: [
          { targetType: "lesson", targetId: "same" },
          { targetType: "article", targetId: "same" },
          { targetType: "lesson", targetId: "same" },
        ],
      }),
    );
    const tool = (await db.tool.findFirst())!;
    const loaded = await relations.loadMixedRelationTargets({
      sourceType: relations.TOOL,
      sourceId: tool.id,
      relationType: relations.RELATED,
    });
    expect(loaded).toHaveLength(2);
  });
});

describe("getToolRelated only links what a reader can open (changes-46)", () => {
  // The owner found "More about this" on /tools/pivot-points linking to a
  // "Page not found": the list built `/analysis/<slug>` (there is no such
  // route — every article is at /news/[slug]) and the curated half checked
  // `deletedAt` alone, so an unpublished or switched-off target stayed listed.
  afterEach(async () => {
    await db.articleTranslation.deleteMany();
    await db.article.deleteMany();
    await db.articleCategory.deleteMany();
    await db.glossaryTermTranslation.deleteMany();
    await db.glossaryTerm.deleteMany();
  });

  async function seedArticles() {
    const category = await db.articleCategory.create({
      data: {
        sortOrder: 1,
        translations: { create: { locale: "en", name: "Risk", slug: "risk" } },
      },
    });
    const article = (slug: string, data: Record<string, unknown>) =>
      db.article.create({
        data: {
          kind: "ANALYSIS",
          status: "PUBLISHED",
          publishedAt: new Date(),
          isActive: true,
          categoryId: category.id,
          ...data,
          translations: {
            create: { locale: "en", title: slug, slug, translationStatus: "TRANSLATED" },
          },
        },
      });
    return {
      live: await article("live-analysis", {}),
      draft: await article("draft-analysis", { status: "DRAFT", publishedAt: null }),
      inactive: await article("inactive-analysis", { isActive: false }),
      future: await article("future-analysis", {
        status: "SCHEDULED",
        publishedAt: null,
        scheduledFor: new Date(Date.now() + 86_400_000),
      }),
    };
  }

  it("drops a curated target that is unpublished, inactive or not yet due", async () => {
    const rows = await seedArticles();
    const term = await db.glossaryTerm.create({
      data: {
        status: "DRAFT",
        translations: {
          create: {
            locale: "en",
            term: "Hidden",
            slug: "hidden",
            simpleExplanation: "<p>x</p>",
            translationStatus: "TRANSLATED",
          },
        },
      },
    });
    await tools.saveTool(
      subject,
      saveInput({
        relatedCount: 1,
        related: [
          { targetType: "article", targetId: rows.draft.id },
          { targetType: "article", targetId: rows.inactive.id },
          { targetType: "article", targetId: rows.future.id },
          { targetType: "glossary", targetId: term.id },
          { targetType: "article", targetId: rows.live.id },
        ],
      }),
    );

    const items = await tools.getToolRelated("en", "gain-loss", 1);
    expect(items.map((item) => item.title)).toEqual(["live-analysis"]);
  });

  it("links an ANALYSIS article at /news/[slug], the route that serves it", async () => {
    const rows = await seedArticles();
    await tools.saveTool(
      subject,
      saveInput({ related: [{ targetType: "article", targetId: rows.live.id }] }),
    );
    const [item] = await tools.getToolRelated("en", "gain-loss", 1);
    expect(item?.href).toBe("/news/live-analysis");
    // The page drops it when `analysis` is off — the flag /news/[slug] checks.
    expect(item?.feature).toBe("analysis");
  });

  it("tops up from public rows only", async () => {
    await seedArticles();
    await tools.saveTool(subject, saveInput({ related: [] }));
    const items = await tools.getToolRelated("en", "gain-loss", 6);
    const titles = items.map((item) => item.title);
    expect(titles).toContain("live-analysis");
    expect(titles).not.toContain("draft-analysis");
    expect(titles).not.toContain("inactive-analysis");
    expect(titles).not.toContain("future-analysis");
    expect(items.every((item) => !item.href.startsWith("/analysis/"))).toBe(true);
  });
});

describe("reads", () => {
  it("lists a tool with its curated count", async () => {
    await tools.saveTool(
      subject,
      saveInput({
        related: [
          { targetType: "lesson", targetId: "l1" },
          { targetType: "article", targetId: "a1" },
        ],
      }),
    );
    const rows = await tools.listTools();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.curatedCount).toBe(2);
    expect(rows[0]!.icon).toBe("percent");
    expect(rows[0]!.needs).toBe("none");
  });

  it("DROPS a row whose key the registry does not know", async () => {
    // It has no route, no config schema and no island, so listing it would
    // give an editor a link into a 404 from inside the admin.
    await db.tool.create({ data: { key: "retired-tool", config: {} } });
    const rows = await tools.listTools();
    expect(rows.map((r) => r.key)).not.toContain("retired-tool");
  });

  it("refuses to load an unregistered key rather than returning null", async () => {
    // null means "no row"; an unknown key is a programming error one level up.
    await expect(tools.loadTool("not-a-tool")).rejects.toThrow(/not a registered tool/);
  });

  it("returns null for a registered key with no row yet", async () => {
    expect(await tools.loadTool("gain-loss")).toBeNull();
  });

  it("writes an audit row for every save", async () => {
    await tools.saveTool(subject, saveInput());
    const audit = await db.auditLog.findFirst({ where: { action: "tool.update" } });
    expect(audit).not.toBeNull();
    expect(audit!.userId).toBe("actor-1");
  });

  it("setToolEnabled flips the switch and audits it", async () => {
    await tools.saveTool(subject, saveInput());
    await tools.setToolEnabled(subject, "gain-loss", false);
    expect((await db.tool.findUnique({ where: { key: "gain-loss" } }))!.isEnabled).toBe(false);
    expect(await db.auditLog.findFirst({ where: { action: "tool.disable" } })).not.toBeNull();
  });
});
