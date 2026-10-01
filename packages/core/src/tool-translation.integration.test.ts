// Phase 5, tool pages on a real MariaDB with Google faked (MSW): the words are
// translated, the highlight icons are not, the page is served `noindex` and
// kept out of the sitemap until a person saves, and a person's save records
// the hash it was made from (it used to copy the English row's stored hash,
// which a seeded row does not have).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  startTranslationTestDb,
  useFakeGoogle,
  type TranslationTestContext,
} from "./test-utils/translation-container.ts";
import type * as ToolsModule from "./tools.ts";
import type * as RunnerModule from "./translation-runner.ts";

let ctx: TranslationTestContext;
let tools: typeof ToolsModule;
let runner: typeof RunnerModule;

beforeAll(async () => {
  ctx = await startTranslationTestDb("mbfx_tool_translation", ["tools.update"]);
  tools = await import("./tools.ts");
  runner = await import("./translation-runner.ts");
}, 180_000);

afterAll(async () => {
  await ctx?.stop();
});

beforeEach(() => {
  useFakeGoogle(ctx.server);
});

function saveInput(translation: Record<string, unknown>) {
  return {
    key: "gain-loss",
    isEnabled: true,
    sortOrder: 0,
    coverAssetId: null,
    relatedCount: 6,
    showRelated: true,
    config: { defaultStartBalance: 10000, decimals: 2 },
    related: [],
    translation,
  } as never;
}

const english = {
  locale: "en",
  title: "Gain & loss",
  tagline: "Work out a trade's result.",
  intro: "<p>What is a gain?</p>",
  body: "<p>Enter 2 prices.</p>",
  faq: [{ question: "Is it free?", answer: "<p>Yes.</p>" }],
  highlights: [{ icon: "calculator", title: "Fast", text: "One click." }],
};

describe("tool pages", () => {
  it("translates the words and keeps the icons", async () => {
    const toolId = await tools.saveTool(ctx.editor, saveInput(english));
    await runner.drainTranslationQueue();
    const es = await ctx.db.toolTranslation.findFirstOrThrow({ where: { toolId, locale: "es" } });
    expect(es).toMatchObject({
      title: "[es] Gain & loss",
      tagline: "[es] Work out a trade's result.",
      translationStatus: "MACHINE_TRANSLATED",
      highlights: [{ icon: "calculator", title: "[es] Fast", text: "[es] One click." }],
    });
    expect((es.faq as Array<{ answer: string }>)[0]!.answer).toContain("[es]");
  });

  it("is noindex and out of the sitemap until a person saves it", async () => {
    const toolId = await tools.saveTool(ctx.editor, saveInput(english));
    await runner.drainTranslationQueue();
    expect((await tools.getToolPage("es", "gain-loss"))?.noIndex).toBe(true);
    let entries = await tools.loadToolSitemapEntries();
    expect(entries.filter((e) => e.key === "gain-loss").map((e) => e.locale)).toEqual(["en"]);

    await tools.saveTool(ctx.editor, saveInput({ locale: "es", title: "Ganancia y pérdida" }));
    const es = await ctx.db.toolTranslation.findFirstOrThrow({ where: { toolId, locale: "es" } });
    expect(es.translationStatus).toBe("TRANSLATED");
    expect(es.sourceHash).toMatch(/^[0-9a-f]{64}$/);
    entries = await tools.loadToolSitemapEntries();
    expect(
      entries
        .filter((e) => e.key === "gain-loss")
        .map((e) => e.locale)
        .sort(),
    ).toEqual(["en", "es"]);
  });

  it("an English edit flags a person's translation rather than overwriting it", async () => {
    const toolId = await tools.saveTool(ctx.editor, saveInput(english));
    await tools.saveTool(ctx.editor, saveInput({ locale: "es", title: "Ganancia" }));
    // An unchanged English save leaves the person's row current…
    await tools.saveTool(ctx.editor, saveInput(english));
    await runner.drainTranslationQueue();
    let es = await ctx.db.toolTranslation.findFirstOrThrow({ where: { toolId, locale: "es" } });
    expect(es.translationStatus).toBe("TRANSLATED");
    // …and a changed one marks it OUTDATED, words untouched.
    await tools.saveTool(ctx.editor, saveInput({ ...english, tagline: "New tagline." }));
    await runner.drainTranslationQueue();
    es = await ctx.db.toolTranslation.findFirstOrThrow({ where: { toolId, locale: "es" } });
    expect(es).toMatchObject({ title: "Ganancia", translationStatus: "OUTDATED" });
  });

  // ADR-168: tools resolve through the fallback chain. `es` falls back to
  // `en` in this database; with the fallback cleared it models ADR-007's
  // Arabic rule — `title: null`, never the registry key, and not indexed at
  // its own address.
  it("an untranslated locale with no fallback has no title, not the registry key, and is noindex", async () => {
    const toolId = await tools.saveTool(ctx.editor, saveInput(english));
    await ctx.db.toolTranslation.deleteMany({ where: { toolId, locale: "es" } });
    await ctx.db.locale.update({ where: { code: "es" }, data: { fallbackCode: null } });
    try {
      const page = await tools.getToolPage("es", "gain-loss");
      expect(page).toMatchObject({
        title: null,
        tagline: null,
        intro: null,
        faq: [],
        noIndex: true,
      });
      const listed = (await tools.getEnabledTools("es")).find((t) => t.key === "gain-loss");
      expect(listed?.title).toBeNull();

      // The default locale is unaffected.
      expect(await tools.getToolPage("en", "gain-loss")).toMatchObject({
        title: "Gain & loss",
        noIndex: false,
      });
    } finally {
      await ctx.db.locale.update({ where: { code: "es" }, data: { fallbackCode: "en" } });
    }
  });

  it("a locale WITH a fallback shows the fallback's words, still noindex at its own URL", async () => {
    const toolId = await tools.saveTool(ctx.editor, saveInput(english));
    await ctx.db.toolTranslation.deleteMany({ where: { toolId, locale: "es" } });
    expect(await tools.getToolPage("es", "gain-loss")).toMatchObject({
      title: "Gain & loss",
      noIndex: true,
    });
    const listed = (await tools.getEnabledTools("es")).find((t) => t.key === "gain-loss");
    expect(listed?.title).toBe("Gain & loss");
  });
});
