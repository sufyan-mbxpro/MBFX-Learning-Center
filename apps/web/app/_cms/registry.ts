// Registry assembly (ADR-020, ADR-030 §4, ADR-022) — the one place
// `@repo/blocks`'s widget map AND `@repo/core`'s content-type providers are
// assembled for real. A private, non-routed module (`_cms`): nothing under
// `app/_cms` is ever a route. `widgets` is empty today: PR 2.5 ships the
// generic `widget` block and its dispatch mechanism, not any real widget.
// Adding a feature later is exactly this file gaining one line — no
// `@repo/blocks` change, no composer change (ADR-030 §4, GT4). Same for
// `collectionProviders`: a new content type is a provider plus one line
// here, per ADR-022's genericity requirement — no block or renderer change.
//
// Not yet consumed by `RenderContext.resolveNeeds` (still Phase 2's stub) —
// that real dispatch lands with the `collection` block itself (plan v2.2
// §12 PR 4.2), which is the first thing that actually produces a
// `BlockDataNeed`. Assembling the registry now, ahead of its first
// consumer, is what plan v2.2 §12 PR 4.1 asks for.
import type { WidgetMap } from "@repo/blocks";
import type { CollectionProviderRegistry } from "@repo/contracts";
import { analysisProvider, glossaryProvider, newsProvider, tradeIdeaProvider } from "@repo/core";

export const widgets: WidgetMap = {};

export const collectionProviders: CollectionProviderRegistry = {
  news: newsProvider,
  analysis: analysisProvider,
  "trade-idea": tradeIdeaProvider,
  glossary: glossaryProvider,
};
