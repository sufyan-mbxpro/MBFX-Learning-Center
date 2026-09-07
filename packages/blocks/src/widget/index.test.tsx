// ADR-030 compliance: unknown key -> FallbackBlock; invalid config ->
// FallbackBlock + log; needs join pass 1 like a collection's; Skeleton
// renders when a widget with needs has no resolved data yet.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { LayoutTree, StoredNode } from "@repo/contracts";
import type { BlockDataNeed } from "../needs.ts";
import { renderTree, type RenderContext } from "../render.tsx";
import { defineWidget } from "../widgets.ts";
import "../blocks-list.ts";

afterEach(cleanup);

function widgetNode(config: unknown, overrides: Partial<StoredNode> = {}): StoredNode {
  return {
    type: "widget",
    id: "w1",
    version: 1,
    props: { widgetKey: "test.widget", config, configVersion: 1 },
    hidden: false,
    children: [],
    ...overrides,
  };
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

async function renderWidget(node: StoredNode, ctx: RenderContext) {
  const layout: LayoutTree = { version: 1, nodes: [node] };
  const elements = await renderTree(layout, ctx);
  return render(<>{elements}</>);
}

const TEST_WIDGET = defineWidget({
  definition: {
    key: "test.widget",
    labelKey: "x",
    category: "other",
    version: 1,
    configSchema: z.object({ label: z.string() }),
    defaults: { label: "" },
    fields: [],
    supports: {},
  },
  runtime: {
    Render: ({ config }) => (
      <div data-testid="widget-render">{(config as { label: string }).label}</div>
    ),
    Skeleton: () => <div data-testid="widget-skeleton" />,
  },
});

describe("widget block — ADR-030 compliance", () => {
  it("renders a warning FallbackBlock for an unknown widgetKey in draft mode", async () => {
    const { container } = await renderWidget(widgetNode({}), baseCtx({ draft: true }));
    expect(container.textContent).toContain("did not render");
    expect(container.textContent).toContain("unknown widgetKey");
  });

  it("renders nothing for an unknown widgetKey in production", async () => {
    const { container } = await renderWidget(widgetNode({}), baseCtx({ draft: false }));
    expect(container.textContent).toBe("");
  });

  it("renders a warning FallbackBlock for config that fails the widget's own schema", async () => {
    const ctx = baseCtx({ draft: true, widgets: { "test.widget": TEST_WIDGET } });
    const { container } = await renderWidget(widgetNode({ label: 42 }), ctx); // wrong type
    expect(container.textContent).toContain("invalid widget config");
  });

  it("renders the widget's Render with valid, migrated config", async () => {
    const ctx = baseCtx({ widgets: { "test.widget": TEST_WIDGET } });
    const { getByTestId } = await renderWidget(widgetNode({ label: "Pip Calculator" }), ctx);
    expect(getByTestId("widget-render").textContent).toBe("Pip Calculator");
  });

  it("a widget's needs join pass 1 and are resolved before render", async () => {
    const widgetWithNeeds = defineWidget({
      definition: {
        ...TEST_WIDGET.definition,
        needs: () => [{ provider: "market.rates", query: {}, scope: "page" }],
      },
      runtime: TEST_WIDGET.runtime,
    });
    const resolveNeeds = vi.fn(async (needs: BlockDataNeed[]) => needs.map(() => "rate-data"));
    const ctx = baseCtx({ widgets: { "test.widget": widgetWithNeeds }, resolveNeeds });

    await renderWidget(widgetNode({ label: "Rates" }), ctx);

    expect(resolveNeeds).toHaveBeenCalledTimes(1);
    expect(resolveNeeds.mock.calls[0]?.[0]).toEqual([
      { provider: "market.rates", query: {}, scope: "page" },
    ]);
  });

  it("renders Skeleton when a widget declares needs but no data resolved", async () => {
    const widgetWithNeeds = defineWidget({
      definition: {
        ...TEST_WIDGET.definition,
        needs: () => [{ provider: "market.rates", query: {}, scope: "page" }],
      },
      runtime: TEST_WIDGET.runtime,
    });
    // resolveNeeds returns undefined for the need — nothing to key resolvedData with.
    const ctx = baseCtx({
      widgets: { "test.widget": widgetWithNeeds },
      resolveNeeds: async (needs) => needs.map(() => undefined),
    });

    const { getByTestId } = await renderWidget(widgetNode({ label: "Rates" }), ctx);
    expect(getByTestId("widget-skeleton")).not.toBeNull();
  });
});
