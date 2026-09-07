// ADR-033 §4 — one usage/integrity index over every layout-holding row.
// `collectReferences` now reads a real layout tree (Phase 2, PR 2.6): it
// walks every node, looks up the node's block definition from the pure
// `@repo/blocks/definitions` subpath (no React enters this service layer —
// ADR-032 §5 is exactly what makes that subpath safe for `@repo/core` to
// import) to learn which prop keys are `LinkTarget`s, and extracts links,
// authored media (image/video backgrounds and props), style presets, card
// templates and widgets. Card templates and style presets have no block
// that stores them yet (Phase 3/4) — the extraction below already looks for
// their conventional prop keys, so wiring those phases in is additive, not
// a `collectReferences` change, matching this file's original Phase 1 seam
// comment.
import { ALL_BLOCK_DEFINITIONS } from "@repo/blocks/definitions";
import type { Prisma, ReferenceSourceType, ReferenceType } from "@repo/db";
import { layoutTreeSchema } from "@repo/contracts";
import type { StoredNode } from "@repo/contracts";

export interface CollectedReference {
  refType: ReferenceType;
  refId: string;
  field?: string;
}

const DEFINITION_BY_TYPE = new Map(ALL_BLOCK_DEFINITIONS.map((d) => [d.type, d]));

/** Maps a `LinkTarget`'s discriminant to the reference it should record — `URL`/`ROUTE`/`ANCHOR`/`NONE` carry no id worth tracking (nothing to go stale). */
function linkTargetReference(target: unknown): CollectedReference | null {
  if (typeof target !== "object" || target === null || !("type" in target)) return null;
  const t = target as Record<string, unknown>;
  switch (t.type) {
    case "PAGE":
      return typeof t.pageId === "string" ? { refType: "PAGE", refId: t.pageId } : null;
    case "MEDIA":
      return typeof t.assetId === "string" ? { refType: "MEDIA", refId: t.assetId } : null;
    case "ARTICLE":
    case "ARTICLE_CATEGORY":
    case "ARTICLE_TAG":
    case "COURSE":
    case "GLOSSARY_TERM":
      return typeof t.targetId === "string"
        ? { refType: t.type as ReferenceType, refId: t.targetId }
        : null;
    default:
      return null;
  }
}

function backgroundMediaReferences(style: StoredNode["style"]): CollectedReference[] {
  const background = style?.overrides?.background;
  if (!background || (background.kind !== "image" && background.kind !== "video")) return [];
  const refs: CollectedReference[] = [{ refType: "MEDIA", refId: background.assetId }];
  if (background.kind === "video") refs.push({ refType: "MEDIA", refId: background.posterAssetId });
  return refs;
}

/** Conventional prop keys a later phase's blocks will use — extracted generically so Phase 3/4 land with no change here (the seam this file has kept since Phase 1). */
function conventionalPropReferences(props: unknown): CollectedReference[] {
  if (typeof props !== "object" || props === null) return [];
  const p = props as Record<string, unknown>;
  const refs: CollectedReference[] = [];
  if (typeof p.assetId === "string")
    refs.push({ refType: "MEDIA", refId: p.assetId, field: "assetId" });
  if (typeof p.posterAssetId === "string") {
    refs.push({ refType: "MEDIA", refId: p.posterAssetId, field: "posterAssetId" });
  }
  if (typeof p.cardTemplateId === "string") {
    refs.push({ refType: "CARD_TEMPLATE", refId: p.cardTemplateId, field: "cardTemplateId" });
  }
  return refs;
}

function nodeReferences(node: StoredNode): CollectedReference[] {
  const refs: CollectedReference[] = [];
  const definition = DEFINITION_BY_TYPE.get(node.type);

  for (const key of definition?.links ?? []) {
    const target = (node.props as Record<string, unknown> | null)?.[String(key)];
    const ref = linkTargetReference(target);
    if (ref) refs.push({ ...ref, field: String(key) });
  }

  refs.push(...backgroundMediaReferences(node.style));
  refs.push(...conventionalPropReferences(node.props));

  if (node.type === "widget") {
    const widgetKey = (node.props as Record<string, unknown> | null)?.widgetKey;
    if (typeof widgetKey === "string" && widgetKey.length > 0) {
      refs.push({ refType: "WIDGET", refId: widgetKey, field: "widgetKey" });
    }
  }

  if (node.style?.presetId) {
    refs.push({ refType: "STYLE_PRESET", refId: node.style.presetId, field: "style.presetId" });
  }

  for (const child of node.children) refs.push(...nodeReferences(child));
  return refs;
}

/** `layout` is the raw `Json` column value — parsed defensively (a row saved before this PR landed, or corrupted data, yields no references rather than throwing). */
export function collectReferences(layout: unknown): CollectedReference[] {
  const parsed = layoutTreeSchema.safeParse(layout);
  if (!parsed.success) return [];
  return parsed.data.nodes.flatMap(nodeReferences);
}

/**
 * Diff-and-replace, implemented as delete-then-recreate inside the
 * caller's transaction — simple, correct, and cheap at this scale (one
 * `PageVersion`'s reference set is at most a few hundred rows). ADR-033 §4
 * requires the END STATE to be exactly `refs`, not a minimal-diff write.
 */
export async function syncReferences(
  tx: Prisma.TransactionClient,
  source: { sourceType: ReferenceSourceType; sourceId: string },
  refs: CollectedReference[],
): Promise<void> {
  await tx.contentReference.deleteMany({
    where: { sourceType: source.sourceType, sourceId: source.sourceId },
  });
  if (refs.length === 0) return;
  await tx.contentReference.createMany({
    data: refs.map((r) => ({
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      refType: r.refType,
      refId: r.refId,
      field: r.field ?? null,
    })),
  });
}
