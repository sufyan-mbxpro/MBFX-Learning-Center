// No React Suspense here, same rationale as `widget/index.tsx`: needs are
// resolved before `renderTree` renders anything (ADR-029's whole point),
// so by the time this component runs the data is already in hand. `null`
// resolvedData (need never ran — no `contentType`, or the `bindingId`
// binding failed to resolve) renders nothing in production and a named
// FallbackBlock in draft, same posture as every other dynamic block.
import type { CardConfig, CollectionItem, CollectionListResult } from "@repo/contracts";
import { cn } from "@repo/ui/lib/utils";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { FallbackBlock } from "../fallback-block.tsx";
import { GRID_COLUMNS_CLASS } from "../styles/tables.ts";
import { DEFAULT_CARD_CONFIG, renderCard } from "../card/render-card.tsx";
import { definition, type CollectionProps } from "./definition.ts";

function CollectionBlock({
  id,
  props,
  resolvedData,
  locale,
  draft,
  resolveCardTemplate,
}: BlockComponentProps<CollectionProps>) {
  const result = resolvedData?.[props.bindingId] as CollectionListResult | undefined;

  if (!result) {
    return draft ? (
      <FallbackBlock nodeId={id} reason={`no data for "${props.contentType}"`} draft={draft} />
    ) : null;
  }
  if (result.items.length === 0) {
    return draft ? (
      <FallbackBlock nodeId={id} reason="collection has no items" draft={draft} />
    ) : null;
  }

  // ADR-023: a missing/deleted cardTemplateId falls back to the built-in
  // default — never an error, never a blank card.
  const resolved = props.cardTemplateId ? resolveCardTemplate?.(props.cardTemplateId) : null;
  const variant = resolved?.variant ?? "standard";
  const config = (resolved?.config as CardConfig | undefined) ?? DEFAULT_CARD_CONFIG;

  const layoutClassName =
    props.layout === "list"
      ? "flex flex-col gap-4"
      : props.layout === "carousel"
        ? "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [&>*]:w-72 [&>*]:shrink-0 [&>*]:snap-start"
        : cn("grid gap-4", GRID_COLUMNS_CLASS.base[props.columns]);

  return (
    <div className={layoutClassName}>
      {result.items.map((item: CollectionItem) => renderCard(item, variant, config, locale))}
    </div>
  );
}

registerBlock(definition, CollectionBlock);

export { CollectionBlock };
