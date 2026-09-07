// The all-blocks fixture page (ADR-024 §4, plan "every block ships with...
// an entry in the axe fixture page"). Renders one node per registered
// block type using its own `fixture.json`. Today this is a component a
// test can mount; once Playwright lands (Module 14) it becomes the page an
// axe scan runs against, unchanged. `scripts/check-block-fixtures.mjs`
// fails if a registered type has no entry here.
import type { StoredNode } from "@repo/contracts";
import { renderTree, type RenderContext } from "./render.tsx";

import sectionFixture from "./section/fixture.json" with { type: "json" };
import containerFixture from "./container/fixture.json" with { type: "json" };
import columnsFixture from "./columns/fixture.json" with { type: "json" };
import gridFixture from "./grid/fixture.json" with { type: "json" };
import spacerFixture from "./spacer/fixture.json" with { type: "json" };
import dividerFixture from "./divider/fixture.json" with { type: "json" };
import headingFixture from "./heading/fixture.json" with { type: "json" };
import paragraphFixture from "./paragraph/fixture.json" with { type: "json" };
import richTextFixture from "./rich-text/fixture.json" with { type: "json" };
import imageFixture from "./image/fixture.json" with { type: "json" };
import videoFixture from "./video/fixture.json" with { type: "json" };
import buttonFixture from "./button/fixture.json" with { type: "json" };
import badgeFixture from "./badge/fixture.json" with { type: "json" };
import iconCardFixture from "./icon-card/fixture.json" with { type: "json" };
import statCardFixture from "./stat-card/fixture.json" with { type: "json" };
import processStepFixture from "./process-step/fixture.json" with { type: "json" };
import faqFixture from "./faq/fixture.json" with { type: "json" };
import tabsFixture from "./tabs/fixture.json" with { type: "json" };
import tableFixture from "./table/fixture.json" with { type: "json" };
import breadcrumbFixture from "./breadcrumb/fixture.json" with { type: "json" };
import ctaBandFixture from "./cta-band/fixture.json" with { type: "json" };
import marqueeFixture from "./marquee/fixture.json" with { type: "json" };
import counterFixture from "./counter/fixture.json" with { type: "json" };
import newsletterFormFixture from "./newsletter-form/fixture.json" with { type: "json" };
import widgetFixture from "./widget/fixture.json" with { type: "json" };
import collectionFixture from "./collection/fixture.json" with { type: "json" };
import featuredContentFixture from "./featured-content/fixture.json" with { type: "json" };
import collectionFilterFixture from "./collection-filter/fixture.json" with { type: "json" };
import collectionSearchFixture from "./collection-search/fixture.json" with { type: "json" };
import collectionSortFixture from "./collection-sort/fixture.json" with { type: "json" };
import collectionPaginationFixture from "./collection-pagination/fixture.json" with { type: "json" };

/** type -> fixture props, one entry per registered block (checked by check-block-fixtures.mjs). */
export const BLOCK_FIXTURES: Record<string, unknown> = {
  section: sectionFixture,
  container: containerFixture,
  columns: columnsFixture,
  grid: gridFixture,
  spacer: spacerFixture,
  divider: dividerFixture,
  heading: headingFixture,
  paragraph: paragraphFixture,
  "rich-text": richTextFixture,
  image: imageFixture,
  video: videoFixture,
  button: buttonFixture,
  badge: badgeFixture,
  "icon-card": iconCardFixture,
  "stat-card": statCardFixture,
  "process-step": processStepFixture,
  faq: faqFixture,
  tabs: tabsFixture,
  table: tableFixture,
  breadcrumb: breadcrumbFixture,
  "cta-band": ctaBandFixture,
  marquee: marqueeFixture,
  counter: counterFixture,
  "newsletter-form": newsletterFormFixture,
  widget: widgetFixture,
  collection: collectionFixture,
  "featured-content": featuredContentFixture,
  "collection-filter": collectionFilterFixture,
  "collection-search": collectionSearchFixture,
  "collection-sort": collectionSortFixture,
  "collection-pagination": collectionPaginationFixture,
};

export function fixtureNodes(): StoredNode[] {
  return Object.entries(BLOCK_FIXTURES).map(([type, props]) => ({
    type,
    version: 1,
    id: `fixture-${type}`,
    props,
    hidden: false,
    children: [],
  }));
}

export function stubRenderContext(overrides: Partial<RenderContext> = {}): RenderContext {
  return {
    locale: "en",
    draft: false,
    isVisible: () => true,
    resolveNeeds: async (needs) => needs.map(() => null),
    resolveLinks: async (targets) => targets.map(() => ({ href: "#", state: "ok" as const })),
    resolveMediaUrls: async (ids) => Object.fromEntries(ids.map((id) => [id, `/uploads/${id}`])),
    widgets: {},
    resolveBindingQuery: (input) => ({
      contentType: input.contentType,
      bindingId: input.bindingId,
      filter: input.filter,
      sort: input.sort,
      page: 0,
      limit: input.limit,
    }),
    resolveCardTemplates: async () => ({}),
    ...overrides,
  };
}

/** Renders every registered block's fixture in one tree — the axe fixture page. */
export async function AxeFixturePage({ ctx }: { ctx?: Partial<RenderContext> } = {}) {
  const elements = await renderTree({ version: 1, nodes: fixtureNodes() }, stubRenderContext(ctx));
  return <div data-testid="axe-fixture">{elements}</div>;
}
