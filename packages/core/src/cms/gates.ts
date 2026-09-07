// Publish gates (plan v2.2 §10, ADR-029 §5, PR 3.4) — the full check list
// beyond Phase 1's bare schema re-validation. BLOCK refuses publish and
// names the offending node; WARN publishes with the issue surfaced.
//
// Two of the plan's named checks are not implemented here, honestly:
// - "a `bindingId` no collection provides" — `bindingId`/collection
//   blocks don't exist until Phase 4; nothing to check yet.
// - "a missing card template" — `CardTemplate` doesn't exist until Phase 4.
// The data-budget counts only `category: "collection"` nodes (also
// Phase 4) — this gate is real and wired, it simply has nothing to count
// today, and starts working the moment Phase 4 registers collection
// blocks. It also cannot see the app's widget registry (`@repo/core` may
// not import `apps/web`, architecture.md #8), so a `widget` block's own
// `needs` never contribute to the count here — a real, named limitation,
// not an oversight.
import { ALL_BLOCK_DEFINITIONS } from "@repo/blocks/definitions";
import { db } from "@repo/db";
import { getSetting } from "@repo/settings";
import { layoutTreeSchema } from "@repo/contracts";
import type { LayoutTree, StoredNode } from "@repo/contracts";

export interface PublishGateResult {
  errors: string[];
  warnings: string[];
}

const DEFINITION_BY_TYPE = new Map(ALL_BLOCK_DEFINITIONS.map((d) => [d.type, d]));

function nodeLabel(node: StoredNode): string {
  return node.label
    ? `"${node.label}" (${node.type}, id: ${node.id})`
    : `${node.type} (id: ${node.id})`;
}

function flattenNodes(nodes: StoredNode[]): StoredNode[] {
  return nodes.flatMap((n) => [n, ...flattenNodes(n.children)]);
}

function hasTextDescendant(node: StoredNode): boolean {
  const definition = DEFINITION_BY_TYPE.get(node.type);
  if (definition && (definition.translatable?.length ?? 0) > 0) return true;
  return node.children.some(hasTextDescendant);
}

/** Accessibility heading order (matches axe-core's own rule): a heading may not skip a level going deeper than any heading seen so far in document order. */
function checkHeadingOrder(flat: StoredNode[], errors: string[]): void {
  let maxSeen = 0;
  for (const node of flat) {
    if (node.type !== "heading" || node.hidden) continue;
    const props = node.props as { level?: string } | null;
    const level = Number(props?.level ?? "2");
    if (Number.isNaN(level)) continue;
    if (level > maxSeen + 1) {
      errors.push(
        `Heading order skipped: ${nodeLabel(node)} is an H${level} with no H${maxSeen + 1} before it.`,
      );
    }
    maxSeen = Math.max(maxSeen, level);
  }
}

/** ADR-032 §2: an image/video background with a text-rendering descendant must not set `overlay.tone: "none"`. */
function checkOverlayGate(flat: StoredNode[], errors: string[]): void {
  for (const node of flat) {
    if (node.hidden) continue;
    const background = node.style?.overrides?.background;
    if (!background || (background.kind !== "image" && background.kind !== "video")) continue;
    if (background.overlay.tone !== "none") continue;
    if (hasTextDescendant(node)) {
      errors.push(
        `${nodeLabel(node)} has a ${background.kind} background with no overlay, but contains text — set an overlay tone.`,
      );
    }
  }
}

async function checkStylePresetReferences(flat: StoredNode[], errors: string[]): Promise<void> {
  const referenced = flat.filter((n) => n.style?.presetId);
  if (referenced.length === 0) return;
  const ids = [...new Set(referenced.map((n) => n.style!.presetId!))];
  const found = await db.stylePreset.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const foundIds = new Set(found.map((r) => r.id));
  for (const node of referenced) {
    if (!foundIds.has(node.style!.presetId!)) {
      errors.push(`${nodeLabel(node)} references a style preset that no longer exists.`);
    }
  }
}

function checkDuplicateAnchors(flat: StoredNode[], warnings: string[]): void {
  const seen = new Map<string, StoredNode>();
  for (const node of flat) {
    if (!node.anchor) continue;
    const existing = seen.get(node.anchor);
    if (existing) {
      warnings.push(
        `Duplicate anchor "${node.anchor}": ${nodeLabel(existing)} and ${nodeLabel(node)}.`,
      );
    } else {
      seen.set(node.anchor, node);
    }
  }
}

const COLLECTION_OWNER_TYPES = new Set(["collection", "featured-content"]);
const COLLECTION_CONSUMER_TYPES = new Set([
  "collection-filter",
  "collection-search",
  "collection-sort",
  "collection-pagination",
]);

/** ADR-022 §4: "warns when a filter block names a bindingId no collection block on the page provides" — the one failure mode that would otherwise ship silently (plan v2.2 §12 PR 4.2). */
function checkDanglingBindingId(flat: StoredNode[], warnings: string[]): void {
  const owned = new Set(
    flat
      .filter((n) => COLLECTION_OWNER_TYPES.has(n.type))
      .map((n) => (n.props as { bindingId?: string } | null)?.bindingId ?? "main"),
  );
  for (const node of flat) {
    if (!COLLECTION_CONSUMER_TYPES.has(node.type)) continue;
    const bindingId = (node.props as { bindingId?: string } | null)?.bindingId ?? "main";
    if (!owned.has(bindingId)) {
      warnings.push(
        `${nodeLabel(node)} names bindingId "${bindingId}", but no collection block on this page provides it.`,
      );
    }
  }
}

function checkDepth(nodes: StoredNode[], warnings: string[], depth = 0): void {
  if (depth > 3) {
    for (const node of nodes) {
      warnings.push(`${nodeLabel(node)} is nested ${depth} levels deep (recommended: ≤ 3).`);
    }
  }
  for (const node of nodes) checkDepth(node.children, warnings, depth + 1);
}

/** Every locale any node has started translating into — the composer's own working set, not a DB round trip for "active" locales (keeps this function's DB-free half pure). */
function checkEmptyTranslatableProps(flat: StoredNode[], warnings: string[]): void {
  const locales = new Set<string>();
  for (const node of flat) {
    for (const locale of Object.keys(node.translations ?? {})) locales.add(locale);
  }
  if (locales.size === 0) return;

  for (const node of flat) {
    const definition = DEFINITION_BY_TYPE.get(node.type);
    const translatableKeys = definition?.translatable ?? [];
    if (translatableKeys.length === 0) continue;
    for (const locale of locales) {
      const translation = node.translations?.[locale] as Record<string, unknown> | undefined;
      for (const key of translatableKeys) {
        const value = translation?.[String(key)];
        if (value === undefined || value === "") {
          warnings.push(
            `${nodeLabel(node)} has no "${String(key)}" translation for locale "${locale}".`,
          );
        }
      }
    }
  }
}

async function checkDataBudget(
  flat: StoredNode[],
  errors: string[],
  warnings: string[],
): Promise<void> {
  const budget = await getSetting("cms.dataBudget");
  if (!budget) return; // unseeded dev DB — nothing to enforce against
  const collectionNodes = flat.filter(
    (n) => DEFINITION_BY_TYPE.get(n.type)?.category === "collection",
  );
  const count = collectionNodes.length;
  const { warn, block } = budget.page.collections;
  if (count > block) {
    errors.push(`This page has ${count} dynamic collections — the limit is ${block}.`);
  } else if (count > warn) {
    warnings.push(`This page has ${count} dynamic collections — recommended limit is ${warn}.`);
  }
}

/**
 * Phase 1's gate list was schema re-validation alone. PR 3.4 adds the
 * checks named in plan §10; the shape (`{errors, warnings}`) hasn't
 * changed, so `publishPage()` and the composer's `checkDraftGatesAction`
 * needed no changes beyond `await`ing this (it now reads the DB for the
 * style-preset and data-budget checks).
 */
export async function runPublishGates(layout: unknown): Promise<PublishGateResult> {
  const result = layoutTreeSchema.safeParse(layout);
  if (!result.success) {
    return {
      errors: ["Layout failed validation — fix the draft before publishing."],
      warnings: [],
    };
  }

  const tree: LayoutTree = result.data;
  const flat = flattenNodes(tree.nodes);
  const errors: string[] = [];
  const warnings: string[] = [];

  checkHeadingOrder(flat, errors);
  checkOverlayGate(flat, errors);
  await checkStylePresetReferences(flat, errors);
  await checkDataBudget(flat, errors, warnings);
  checkDuplicateAnchors(flat, warnings);
  checkDepth(tree.nodes, warnings);
  checkEmptyTranslatableProps(flat, warnings);
  checkDanglingBindingId(flat, warnings);

  return { errors, warnings };
}
