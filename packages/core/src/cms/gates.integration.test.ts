// Publish gates beyond Phase 1's bare schema check (plan v2.2 §10, ADR-029
// §5, ADR-032 §2, PR 3.4). Integration, not unit, because `runPublishGates`
// now reads the database unconditionally (the data-budget setting) and
// conditionally (style-preset existence) — every test here needs a real
// connection, not just the two that seed data of their own.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LayoutTree, StoredNode } from "@repo/contracts";
import type * as GatesModule from "./gates.ts";
import { startCmsTestDb, stopCmsTestDb, type CmsTestContext } from "../test-utils/cms-container.ts";

let ctx: CmsTestContext;
let gates: typeof GatesModule;

beforeAll(async () => {
  ctx = await startCmsTestDb();
  gates = await import("./gates.ts");
}, 120_000);

afterAll(async () => {
  await stopCmsTestDb(ctx);
});

function node(partial: Partial<StoredNode> & Pick<StoredNode, "type" | "id">): StoredNode {
  return { version: 1, props: {}, hidden: false, children: [], ...partial };
}

function layout(nodes: StoredNode[]): LayoutTree {
  return { version: 1, nodes };
}

describe("runPublishGates", () => {
  it("still refuses a layout that fails schema validation (Phase 1's original gate)", async () => {
    const result = await gates.runPublishGates({ not: "a valid layout" });
    expect(result.errors).toHaveLength(1);
  });

  it("blocks a heading that skips a level", async () => {
    const tree = layout([
      node({ type: "heading", id: "h1", props: { text: "Title", level: "1" } }),
      node({ type: "heading", id: "h3", props: { text: "Skipped", level: "3" } }),
    ]);
    const result = await gates.runPublishGates(tree);
    expect(result.errors.some((e) => e.includes("H3") && e.includes("H2"))).toBe(true);
  });

  it("allows headings that increase one level at a time, in any starting order", async () => {
    const tree = layout([
      node({ type: "heading", id: "h1", props: { text: "Title", level: "1" } }),
      node({ type: "heading", id: "h2a", props: { text: "Section", level: "2" } }),
      node({ type: "heading", id: "h3a", props: { text: "Sub", level: "3" } }),
      node({ type: "heading", id: "h2b", props: { text: "Back up", level: "2" } }),
    ]);
    const result = await gates.runPublishGates(tree);
    expect(result.errors).toHaveLength(0);
  });

  it("blocks an image background with no overlay when the node has text descendants (ADR-032 §2)", async () => {
    const tree = layout([
      node({
        type: "section",
        id: "s1",
        props: { spacing: "md" },
        style: {
          overrides: {
            background: {
              kind: "image",
              assetId: "asset-1",
              fit: "cover",
              position: "center",
              overlay: { tone: "none", strength: "sm" },
            },
          },
        },
        children: [node({ type: "heading", id: "h1", props: { text: "Hero", level: "1" } })],
      }),
    ]);
    const result = await gates.runPublishGates(tree);
    expect(result.errors.some((e) => e.includes("s1") && e.includes("overlay"))).toBe(true);
  });

  it("publishes the same image background with an overlay set", async () => {
    const tree = layout([
      node({
        type: "section",
        id: "s1",
        props: { spacing: "md" },
        style: {
          overrides: {
            background: {
              kind: "image",
              assetId: "asset-1",
              fit: "cover",
              position: "center",
              overlay: { tone: "dark", strength: "md" },
            },
          },
        },
        children: [node({ type: "heading", id: "h1", props: { text: "Hero", level: "1" } })],
      }),
    ]);
    const result = await gates.runPublishGates(tree);
    expect(result.errors).toHaveLength(0);
  });

  it("does not block an image background with no text descendants", async () => {
    const tree = layout([
      node({
        type: "section",
        id: "s1",
        props: { spacing: "md" },
        style: {
          overrides: {
            background: {
              kind: "image",
              assetId: "asset-1",
              fit: "cover",
              position: "center",
              overlay: { tone: "none", strength: "sm" },
            },
          },
        },
        children: [node({ type: "spacer", id: "sp1", props: { size: "md" } })],
      }),
    ]);
    const result = await gates.runPublishGates(tree);
    expect(result.errors).toHaveLength(0);
  });

  it("warns on duplicate anchors and nesting deeper than 3 levels", async () => {
    const tree = layout([
      node({ type: "section", id: "s1", props: { spacing: "md" }, anchor: "top" }),
      node({ type: "section", id: "s2", props: { spacing: "md" }, anchor: "top" }),
      node({
        type: "section",
        id: "d0",
        props: { spacing: "md" },
        children: [
          node({
            type: "container",
            id: "d1",
            props: { size: "page" },
            children: [
              node({
                type: "columns",
                id: "d2",
                props: { count: "2", gap: "md" },
                children: [
                  node({
                    type: "container",
                    id: "d3",
                    props: { size: "page" },
                    children: [
                      node({ type: "heading", id: "d4", props: { text: "Too deep", level: "2" } }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ]);
    const result = await gates.runPublishGates(tree);
    expect(result.warnings.some((w) => w.includes("Duplicate anchor"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("nested"))).toBe(true);
  });

  it("warns when a translatable prop is empty for a locale the page has started translating", async () => {
    const tree = layout([
      node({
        type: "heading",
        id: "h1",
        props: { text: "Title", level: "1" },
        translations: { es: {} }, // started ES, but never filled in `text`
      }),
    ]);
    const result = await gates.runPublishGates(tree);
    expect(result.warnings.some((w) => w.includes('locale "es"'))).toBe(true);
  });

  it("does not warn about a locale nothing has started translating", async () => {
    const tree = layout([
      node({ type: "heading", id: "h1", props: { text: "Title", level: "1" } }),
    ]);
    const result = await gates.runPublishGates(tree);
    expect(result.warnings).toHaveLength(0);
  });

  it("blocks a node whose style.presetId no longer resolves to a real StylePreset, and passes a real one", async () => {
    const preset = await ctx.db.stylePreset.create({
      data: { key: "gate-test-preset", name: "Gate test", config: {} },
    });

    const missing = layout([
      node({
        type: "section",
        id: "s1",
        props: { spacing: "md" },
        style: { presetId: "does-not-exist" },
      }),
    ]);
    const missingResult = await gates.runPublishGates(missing);
    expect(missingResult.errors.some((e) => e.includes("style preset that no longer exists"))).toBe(
      true,
    );

    const real = layout([
      node({ type: "section", id: "s2", props: { spacing: "md" }, style: { presetId: preset.id } }),
    ]);
    const realResult = await gates.runPublishGates(real);
    expect(realResult.errors).toHaveLength(0);
  });

  it("the data-budget check reads the seeded setting without crashing when there are zero collection-category nodes on this particular tree", async () => {
    await ctx.db.setting.upsert({
      where: { key: "cms.dataBudget" },
      update: {},
      create: {
        key: "cms.dataBudget",
        groupName: "cms",
        value: {
          page: { collections: { warn: 1, block: 2 }, items: { warn: 6, block: 12 } },
          part: { collections: { warn: 1, block: 2 }, items: { warn: 6, block: 12 } },
        },
        type: "JSON",
        label: "Data budget",
        description: "test",
        isPublic: false,
      },
    });
    const tree = layout([
      node({ type: "heading", id: "h1", props: { text: "Title", level: "1" } }),
    ]);
    const result = await gates.runPublishGates(tree);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("warns when a filter/search/sort/pagination block names a bindingId no collection block on the page provides (PR 4.2, ADR-022 §4)", async () => {
    const dangling = layout([
      node({ type: "collection-search", id: "search1", props: { bindingId: "main" } }),
      node({ type: "collection-pagination", id: "pager1", props: { bindingId: "does-not-exist" } }),
    ]);
    const danglingResult = await gates.runPublishGates(dangling);
    expect(danglingResult.warnings.some((w) => w.includes('bindingId "main"'))).toBe(true);
    expect(danglingResult.warnings.some((w) => w.includes('bindingId "does-not-exist"'))).toBe(
      true,
    );

    const wired = layout([
      node({ type: "collection", id: "c1", props: { contentType: "news", bindingId: "main" } }),
      node({ type: "collection-search", id: "search2", props: { bindingId: "main" } }),
      node({ type: "collection-pagination", id: "pager2", props: { bindingId: "main" } }),
    ]);
    const wiredResult = await gates.runPublishGates(wired);
    expect(wiredResult.warnings.some((w) => w.includes("bindingId"))).toBe(false);
  });
});
