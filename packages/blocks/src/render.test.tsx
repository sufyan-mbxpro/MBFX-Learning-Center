import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { z } from "zod";
import type { LayoutTree, StoredNode } from "@repo/contracts";
import { defineBlock, registerBlock, type BlockDataNeed } from "./registry.ts";
import { renderTree, type RenderContext } from "./render.tsx";

function node(partial: Partial<StoredNode> & Pick<StoredNode, "type" | "id">): StoredNode {
  return {
    version: 1,
    props: {},
    hidden: false,
    children: [],
    ...partial,
  };
}

function layout(nodes: StoredNode[]): LayoutTree {
  return { version: 1, nodes };
}

function baseCtx(overrides: Partial<RenderContext> = {}): RenderContext {
  return {
    locale: "en",
    draft: false,
    isVisible: () => true,
    resolveNeeds: vi.fn(async (needs: BlockDataNeed[]) => needs.map(() => null)),
    resolveLinks: vi.fn(async (targets) =>
      targets.map(() => ({ href: null, state: "missing" as const })),
    ),
    resolveMediaUrls: vi.fn(async (ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, `/uploads/${id}`])),
    ),
    widgets: {},
    resolveBindingQuery: vi.fn((input) => ({
      contentType: input.contentType,
      bindingId: input.bindingId,
      filter: input.filter,
      sort: input.sort,
      page: 0,
      limit: input.limit,
    })),
    resolveCardTemplates: vi.fn(async () => ({})),
    ...overrides,
  };
}

async function renderNodes(nodes: StoredNode[], ctx: RenderContext) {
  const elements = await renderTree(layout(nodes), ctx);
  return render(<>{elements}</>);
}

describe("renderTree — every top-level element carries a key (regression)", () => {
  // Found manually verifying the PR 2.7 homepage migration against a real
  // dev server: `wrapEnvelope`'s outer `<div>` (and the `<Reveal>` wrapper
  // around it) never carried a `key`, only the inner block `<Component>`
  // three levels down did — invisible in a single-node fixture, but React
  // warns "Each child in a list should have a unique key prop" the moment
  // `renderTree` returns more than one top-level node, which every real
  // page does. `console.error` is what React's dev-mode key warning goes
  // through, so spying on it is the actual regression signal here — a
  // passing render alone would not have caught this.
  it("logs no React key warning for a multi-node layout", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let keyWarning: unknown;
    try {
      await renderNodes(
        [
          node({ type: "heading", id: "h1", props: { text: "One", level: "1" } }),
          node({ type: "paragraph", id: "p1", props: { text: "Two" } }),
          node({ type: "section", id: "s1", props: { spacing: "md" } }),
        ],
        baseCtx(),
      );
      // Read `.mock.calls` BEFORE mockRestore() — restore also clears the
      // recorded calls, so checking after it always sees an empty array
      // regardless of whether React actually warned (the bug this test's
      // own first draft had, caught only by deliberately re-breaking the
      // fix and watching this assertion still pass when it shouldn't have).
      keyWarning = errorSpy.mock.calls.find(
        (call) => String(call[0]).includes("unique") && String(call[0]).includes("key"),
      );
    } finally {
      errorSpy.mockRestore();
    }
    expect(
      keyWarning,
      `unexpected React key warning: ${JSON.stringify(keyWarning)}`,
    ).toBeUndefined();
  });
});

describe("renderTree — registered blocks (section/heading/paragraph)", () => {
  it("renders a heading and a paragraph deterministically", async () => {
    const nodes = [
      node({ type: "heading", id: "h1", props: { text: "Hello", level: "1", align: "start" } }),
      node({
        type: "paragraph",
        id: "p1",
        props: { text: "World", align: "start", size: "default" },
      }),
    ];
    const { container: c1 } = await renderNodes(nodes, baseCtx());
    const { container: c2 } = await renderNodes(nodes, baseCtx());
    expect(c1.innerHTML).toBe(c2.innerHTML);
    expect(c1.querySelector("h1")?.textContent).toBe("Hello");
    expect(c1.querySelector("p")?.textContent).toBe("World");
  });

  it("merges the active locale's translation over base translatable props", async () => {
    const nodes = [
      node({
        type: "heading",
        id: "h1",
        props: { text: "Hello", level: "2", align: "start" },
        translations: { es: { text: "Hola" } },
      }),
    ];
    const { container } = await renderNodes(nodes, baseCtx({ locale: "es" }));
    expect(container.querySelector("h2")?.textContent).toBe("Hola");
  });

  it("renders children inside a section", async () => {
    const nodes = [
      node({
        type: "section",
        id: "s1",
        props: { spacing: "md" },
        children: [node({ type: "heading", id: "h1", props: { text: "In section", level: "2" } })],
      }),
    ];
    const { container } = await renderNodes(nodes, baseCtx());
    expect(container.querySelector("section h2")?.textContent).toBe("In section");
  });
});

describe("renderTree — envelope behaviour (ADR-032 §1)", () => {
  it("skips a hidden node and its subtree entirely", async () => {
    const nodes = [
      node({
        type: "section",
        id: "s1",
        hidden: true,
        props: { spacing: "md" },
        children: [
          node({ type: "heading", id: "h1", props: { text: "Never rendered", level: "2" } }),
        ],
      }),
    ];
    const { container } = await renderNodes(nodes, baseCtx());
    expect(container.textContent).toBe("");
  });

  it("skips a node the subject cannot see (visibility gate)", async () => {
    const nodes = [
      node({
        type: "heading",
        id: "h1",
        props: { text: "Premium", level: "2" },
        visibility: "PREMIUM",
      }),
    ];
    const { container } = await renderNodes(nodes, baseCtx({ isVisible: () => false }));
    expect(container.textContent).toBe("");
  });

  it("renders the anchor as the wrapper's id", async () => {
    const nodes = [
      node({ type: "heading", id: "h1", anchor: "faq", props: { text: "FAQ", level: "2" } }),
    ];
    const { container } = await renderNodes(nodes, baseCtx());
    expect(container.querySelector("#faq")).not.toBeNull();
  });
});

describe("renderTree — unknown type / invalid props never crash a page", () => {
  it("renders a warning FallbackBlock for an unknown type in draft mode", async () => {
    const nodes = [node({ type: "does-not-exist", id: "x1" })];
    const onWarning = vi.fn();
    const { container } = await renderNodes(nodes, baseCtx({ draft: true, onWarning }));
    expect(container.textContent).toContain("did not render");
    expect(onWarning).toHaveBeenCalledWith("x1", expect.stringContaining("unknown block type"));
  });

  it("renders nothing for an unknown type in production", async () => {
    const nodes = [node({ type: "does-not-exist", id: "x1" })];
    const { container } = await renderNodes(nodes, baseCtx({ draft: false }));
    expect(container.textContent).toBe("");
  });

  it("renders a warning FallbackBlock for props that fail schema validation", async () => {
    const nodes = [node({ type: "heading", id: "h1", props: { level: "2" } })]; // missing required `text`
    const { container } = await renderNodes(nodes, baseCtx({ draft: true }));
    expect(container.textContent).toContain("invalid props");
  });
});

describe("renderTree — block version migration", () => {
  it("runs the migrate chain from the stored version up to current", async () => {
    const schemaV2 = z.object({ title: z.string() });
    const definition = defineBlock({
      type: "migrating-fixture",
      version: 2,
      labelKey: "x",
      category: "content",
      schema: schemaV2,
      defaults: { title: "" },
      migrate: { 1: (old) => ({ title: (old as { text: string }).text }) },
      supports: {},
    });
    function FixtureBlock({ props }: { props: { title: string } }) {
      return <div data-testid="migrated">{props.title}</div>;
    }
    registerBlock(definition, FixtureBlock);

    const nodes = [
      node({ type: "migrating-fixture", id: "m1", version: 1, props: { text: "Old shape" } }),
    ];
    const { getByTestId } = await renderNodes(nodes, baseCtx());
    expect(getByTestId("migrated").textContent).toBe("Old shape");
  });
});

describe("renderTree — needs are collected, deduped, and resolved once (ADR-029 §1)", () => {
  it("resolves three identical needs with exactly one resolveNeeds call entry", async () => {
    const definition = defineBlock({
      type: "needs-fixture",
      version: 1,
      labelKey: "x",
      category: "content",
      schema: z.object({}),
      defaults: {},
      needs: () => [{ provider: "news", query: { limit: 6 }, scope: "page" }],
      supports: {},
    });
    function NeedsBlock({ resolvedData }: { resolvedData?: Record<string, unknown> }) {
      return <div data-testid="need">{String(resolvedData?.news)}</div>;
    }
    registerBlock(definition, NeedsBlock);

    const resolveNeeds = vi.fn(async (needs: BlockDataNeed[]) => needs.map(() => "resolved"));
    const nodes = [
      node({ type: "needs-fixture", id: "n1" }),
      node({ type: "needs-fixture", id: "n2" }),
      node({ type: "needs-fixture", id: "n3" }),
    ];
    await renderNodes(nodes, baseCtx({ resolveNeeds }));

    expect(resolveNeeds).toHaveBeenCalledTimes(1);
    expect(resolveNeeds.mock.calls[0]?.[0]).toHaveLength(1); // deduped to one need
  });
});

describe("renderTree — collection bindings (PR 4.2, ADR-022 §4)", () => {
  it("resolves a binding-owner node's query via resolveBindingQuery, and a second node sharing its bindingId dedupes onto the same resolved result", async () => {
    // `render.tsx` imports `blocks-list.ts` itself (so the registry is
    // always populated), which means the REAL `collection` block is
    // already registered here — used directly rather than a stand-in type
    // name, since Pass 0's BINDING_OWNER_TYPES check is on the literal
    // string "collection".
    const consumerDefinition = defineBlock<{ bindingId: string }>({
      type: "consumer-fixture",
      version: 1,
      labelKey: "x",
      category: "collection",
      schema: z.object({ bindingId: z.string() }),
      defaults: { bindingId: "main" },
      needs: (props, ctx) => {
        const binding = ctx.bindings[props.bindingId];
        return binding
          ? [
              {
                provider: binding.contentType,
                query: binding.query,
                bindingId: props.bindingId,
                scope: "page",
              },
            ]
          : [];
      },
      supports: {},
    });
    function ConsumerBlock({ resolvedData }: { resolvedData?: Record<string, unknown> }) {
      const result = resolvedData?.main as { total: number } | undefined;
      return <div data-testid="consumer">{result ? String(result.total) : "none"}</div>;
    }
    registerBlock(consumerDefinition, ConsumerBlock);

    const resolveBindingQuery = vi.fn(
      (input: Parameters<RenderContext["resolveBindingQuery"]>[0]) => ({
        contentType: input.contentType,
        bindingId: input.bindingId,
        filter: input.filter,
        sort: input.sort,
        page: 0,
        limit: input.limit,
      }),
    );
    // Shaped like a real `CollectionListResult` — the REAL `collection`
    // block component (already registered via blocks-list.ts) also
    // receives this and would throw on a bare string.
    const resolveNeeds = vi.fn(async (needs: BlockDataNeed[]) =>
      needs.map(() => ({ items: [], total: 3, page: 0, limit: 12 })),
    );

    const nodes = [
      node({ type: "collection", id: "c1", props: { contentType: "news", bindingId: "main" } }),
      node({ type: "consumer-fixture", id: "p1", props: { bindingId: "main" } }),
    ];
    const { getByTestId } = await renderNodes(
      nodes,
      baseCtx({ resolveBindingQuery, resolveNeeds }),
    );

    expect(resolveBindingQuery).toHaveBeenCalledTimes(1); // the pre-pass resolves the binding ONCE
    expect(resolveBindingQuery.mock.calls[0]?.[0]).toMatchObject({
      contentType: "news",
      bindingId: "main",
    });
    expect(resolveNeeds).toHaveBeenCalledTimes(1);
    expect(resolveNeeds.mock.calls[0]?.[0]).toHaveLength(1); // both nodes' needs deduped to one
    expect(getByTestId("consumer").textContent).toBe("3");
  });

  it("a consumer node whose bindingId matches no owner gets no data at all", async () => {
    const consumerDefinition = defineBlock<{ bindingId: string }>({
      type: "orphan-consumer-fixture",
      version: 1,
      labelKey: "x",
      category: "collection",
      schema: z.object({ bindingId: z.string() }),
      defaults: { bindingId: "main" },
      needs: (props, ctx) => {
        const binding = ctx.bindings[props.bindingId];
        return binding
          ? [
              {
                provider: binding.contentType,
                query: binding.query,
                bindingId: props.bindingId,
                scope: "page",
              },
            ]
          : [];
      },
      supports: {},
    });
    function OrphanBlock({ resolvedData }: { resolvedData?: Record<string, unknown> }) {
      return (
        <div data-testid="orphan">{resolvedData?.main === undefined ? "empty" : "has-data"}</div>
      );
    }
    registerBlock(consumerDefinition, OrphanBlock);

    const resolveNeeds = vi.fn(async (needs: BlockDataNeed[]) => needs.map(() => "resolved"));
    const nodes = [
      node({ type: "orphan-consumer-fixture", id: "o1", props: { bindingId: "main" } }),
    ];
    const { getByTestId } = await renderNodes(nodes, baseCtx({ resolveNeeds }));

    expect(resolveNeeds).not.toHaveBeenCalled();
    expect(getByTestId("orphan").textContent).toBe("empty");
  });
});

describe("renderTree — links (ADR-031 §4)", () => {
  it("renders a resolved link as a real anchor", async () => {
    const nodes = [
      node({
        type: "button",
        id: "b1",
        props: {
          label: "Go",
          link: { type: "URL", url: "https://example.com" },
          variant: "default",
          size: "default",
        },
      }),
    ];
    const resolveLinks = vi.fn(async (targets) =>
      targets.map(() => ({ href: "https://example.com", state: "ok" as const })),
    );
    const { container } = await renderNodes(nodes, baseCtx({ resolveLinks }));
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("https://example.com");
  });

  it("renders a missing/unpublished/forbidden target as static, non-link text", async () => {
    const nodes = [
      node({
        type: "button",
        id: "b1",
        props: {
          label: "Go",
          link: { type: "PAGE", pageId: "gone" },
          variant: "default",
          size: "default",
        },
      }),
    ];
    const { container } = await renderNodes(nodes, baseCtx()); // default stub resolves to "missing"
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("Go");
  });
});

describe("renderTree — media ids are collected, deduped, and resolved once (PR 3.3)", () => {
  // Media v2 (ADR-034) landed after ADR-029 was written; this closes the
  // TODO ADR-029 left ("fold it into the same collect/resolve pipeline as
  // links, not bolt an async call onto pass 3") — resolveMediaUrls is
  // async and batched, but nothing inside wrapEnvelope/each block Component
  // ever awaits it directly (render-context.test-only assertion below).
  it("resolves an image block's assetId prop through a single batched call", async () => {
    const resolveMediaUrls = vi.fn(async (ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, `/uploads/${id}`])),
    );
    const nodes = [
      node({
        type: "image",
        id: "img1",
        props: { assetId: "asset-1", alt: "", fit: "cover", aspectRatio: "auto" },
      }),
    ];
    const { container } = await renderNodes(nodes, baseCtx({ resolveMediaUrls }));
    expect(resolveMediaUrls).toHaveBeenCalledTimes(1);
    expect(resolveMediaUrls).toHaveBeenCalledWith(["asset-1"]);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/uploads/asset-1");
  });

  it("dedupes a background image id shared with a video block's poster and resolves both in one call", async () => {
    const resolveMediaUrls = vi.fn(async (ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, `/uploads/${id}`])),
    );
    const nodes = [
      node({
        type: "section",
        id: "s1",
        props: { spacing: "md" },
        style: {
          overrides: {
            background: {
              kind: "image",
              assetId: "shared-asset",
              fit: "cover",
              position: "center",
              overlay: { tone: "none", strength: "sm" },
            },
          },
        },
      }),
      node({
        type: "video",
        id: "v1",
        props: { assetId: "video-asset", posterAssetId: "shared-asset", autoplay: false },
      }),
    ];
    await renderNodes(nodes, baseCtx({ resolveMediaUrls }));
    expect(resolveMediaUrls).toHaveBeenCalledTimes(1);
    const [ids] = resolveMediaUrls.mock.calls[0] as [string[]];
    expect(new Set(ids)).toEqual(new Set(["shared-asset", "video-asset"]));
  });

  it("resolves to an empty string, never throws, for an id missing from the batch result (soft-deleted asset)", async () => {
    const nodes = [
      node({
        type: "image",
        id: "img1",
        props: { assetId: "deleted-asset", alt: "", fit: "cover", aspectRatio: "auto" },
      }),
    ];
    const { container } = await renderNodes(
      nodes,
      baseCtx({ resolveMediaUrls: async () => ({}) }), // nothing in the result — soft-deleted
    );
    // jsdom drops an empty `src` attribute entirely rather than keeping `""`.
    expect(container.querySelector("img")?.getAttribute("src")).toBeFalsy();
  });

  it("skips the batch call entirely when no node references any media", async () => {
    const resolveMediaUrls = vi.fn(async () => ({}));
    await renderNodes(
      [node({ type: "heading", id: "h1", props: { text: "No media here", level: "2" } })],
      baseCtx({ resolveMediaUrls }),
    );
    expect(resolveMediaUrls).not.toHaveBeenCalled();
  });
});
