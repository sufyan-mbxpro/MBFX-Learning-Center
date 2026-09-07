import type { CardConfig, CollectionListResult } from "@repo/contracts";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { FallbackBlock } from "../fallback-block.tsx";
import { DEFAULT_CARD_CONFIG, renderCard } from "../card/render-card.tsx";
import { definition, type FeaturedContentProps } from "./definition.ts";

function FeaturedContentBlock({
  id,
  props,
  resolvedData,
  locale,
  draft,
  resolveCardTemplate,
}: BlockComponentProps<FeaturedContentProps>) {
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

  const resolved = props.cardTemplateId ? resolveCardTemplate?.(props.cardTemplateId) : null;
  const config = (resolved?.config as CardConfig | undefined) ?? DEFAULT_CARD_CONFIG;

  const [lead, ...rest] = result.items;
  return (
    <div className="flex flex-col gap-4">
      {lead && renderCard(lead, resolved?.variant ?? "featured", config, locale)}
      {rest.length > 0 && (
        <div className="flex flex-col">
          {rest.map((item) => renderCard(item, "compact", config, locale))}
        </div>
      )}
    </div>
  );
}

registerBlock(definition, FeaturedContentBlock);

export { FeaturedContentBlock };
