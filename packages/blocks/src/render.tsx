// The two-pass renderer (ADR-029 §1, ADR-031 §2): collect -> resolve ->
// render. No block fetches during render — every dynamic block/widget
// declares a `BlockDataNeed`, every link prop is collected alongside it,
// and both are resolved once, deduped, before anything renders. Providers,
// widgets, visibility and media-URL resolution all arrive through
// `RenderContext` (ADR-020) — this file never imports `@repo/db`,
// `@repo/rbac` or `@repo/settings`.
import type { ReactNode } from "react";
import { Reveal } from "@repo/ui/components/reveal";
import { cn } from "@repo/ui/lib/utils";
import type {
  CollectionBinding,
  CollectionQuery,
  FeatureVisibilityInput,
  LayoutTree,
  LinkTarget,
  ResolvedLink,
  StoredNode,
} from "@repo/contracts";
import "./blocks-list.ts";
import { type BlockDataNeed, getRegisteredBlock, migrateBlockProps } from "./registry.ts";
import { FallbackBlock } from "./fallback-block.tsx";
import { resolveBackground, resolveStyleClassName } from "./styles/resolve-style.ts";
import { BACKGROUND_POSITION_CLASS, HIDDEN_ON_CLASS, HOVER_MOTION_CLASS } from "./styles/tables.ts";
import type { WidgetMap } from "./widgets.ts";

export interface RenderContext {
  locale: string;
  /** Draft-mode preview: FallbackBlock and unknown-type/invalid-props nodes render a named warning instead of nothing. */
  draft: boolean;
  /** `FeatureVisibility` + optional feature-flag gate, evaluated by the caller (needs @repo/rbac/@repo/settings — off-limits here). */
  isVisible: (visibility?: FeatureVisibilityInput, requiresFeature?: string) => boolean;
  /** Deduped needs in, results in the SAME order out — grouped-vs-per-need caching (ADR-029 §2) is the caller's concern, not the renderer's. */
  resolveNeeds: (needs: BlockDataNeed[]) => Promise<unknown[]>;
  /** Deduped targets in, results in the SAME order out (ADR-031 §2's own signature, shared with `buildNavigation`). */
  resolveLinks: (targets: LinkTarget[]) => Promise<ResolvedLink[]>;
  /**
   * PR 3.3 (Media v2 now exists) — deduped asset ids in, one batched
   * lookup out, same collect-dedupe-resolve shape as `resolveLinks`. A
   * missing/soft-deleted id resolves to an absent key, never a throw.
   * `renderTree` folds the result into a synchronous closure before
   * `wrapEnvelope`/each block Component ever runs — no async call is
   * ever made mid-render (ADR-029's own anticipated shape for this).
   */
  resolveMediaUrls: (assetIds: string[]) => Promise<Record<string, string>>;
  /** Assembled by `apps/web/app/_cms/registry.ts` (ADR-030 §4); an empty map means every `widget` node falls back. */
  widgets: WidgetMap;
  /**
   * Builds the canonical `CollectionQuery` for one `collection` block's
   * `bindingId` (plan v2.2 §12 PR 4.2, ADR-022 §4): authored defaults
   * merged with the current request's search params, hard caps applied
   * last. Delegated to the injected context because doing this safely
   * needs a provider's real filter/sort vocabulary, and `@repo/blocks` has
   * no `@repo/core` dependency (ADR-020) to look that up itself.
   */
  resolveBindingQuery: (input: {
    contentType: string;
    bindingId: string;
    filter: Record<string, string>;
    sort?: string;
    limit: number;
  }) => CollectionQuery;
  /**
   * Deduped `CardTemplate` ids in, `{variant, config}` out, keyed by id
   * (ADR-023, plan v2.2 §12 PR 4.3) — same collect-dedupe-resolve shape as
   * `resolveMediaUrls`. A missing/deleted id is simply absent from the
   * result; `collection`/`featured-content` fall back to a built-in
   * default render rather than erroring (ADR-023's own "a page never 500s
   * because a card template vanished").
   */
  resolveCardTemplates: (
    ids: string[],
  ) => Promise<Record<string, { variant: string; config: unknown }>>;
  onWarning?: (nodeId: string, message: string) => void;
}

/** What `wrapEnvelope`/`renderNode` actually consume — `resolveMediaUrls`'s batch result, already resolved into a synchronous lookup by `renderTree` before any node renders. */
type RenderCtxInternal = Omit<RenderContext, "resolveMediaUrls" | "resolveCardTemplates"> & {
  resolveMediaUrl: (assetId: string) => string;
  resolveCardTemplate: (id: string) => { variant: string; config: unknown } | null;
};

type NodeStatus = "ok" | "hidden" | "not-visible" | "unknown-type" | "invalid-props";

interface PreparedNode {
  node: StoredNode;
  status: NodeStatus;
  props?: unknown;
  needs: BlockDataNeed[];
  links: { propKey: string; target: LinkTarget }[];
  /** Every `MediaAsset` id this node's own style background or `fields`-declared `kind: "media"` props reference (PR 3.3). */
  mediaIds: string[];
  /** This node's own `cardTemplateId` prop, if it has one (PR 4.3, ADR-023) — `collection`/`featured-content` only, but read generically off `props.cardTemplateId` rather than a per-type list, so a future block gains it for free. */
  cardTemplateIds: string[];
  children: PreparedNode[];
}

/** `style.overrides.background`'s own asset ids — token/gradient carry none. */
function backgroundMediaIds(style: StoredNode["style"]): string[] {
  const background = style?.overrides?.background;
  if (!background) return [];
  if (background.kind === "image") return [background.assetId];
  if (background.kind === "video") return [background.assetId, background.posterAssetId];
  return [];
}

const ENTRANCE_REVEAL_VARIANT = { fade: "fade", "fade-up": "up" } as const;

function needKey(need: BlockDataNeed): string {
  return JSON.stringify({ provider: need.provider, query: need.query });
}

function linkKey(target: LinkTarget): string {
  return JSON.stringify(target);
}

function mergeTranslation(
  base: unknown,
  translation: Record<string, unknown> | undefined,
  translatableKeys: readonly PropertyKey[] | undefined,
): unknown {
  if (!translation || !translatableKeys?.length) return base;
  if (typeof base !== "object" || base === null) return base;
  const merged: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of translatableKeys) {
    const k = String(key);
    if (k in translation) merged[k] = translation[k];
  }
  return merged;
}

/** Block types that own a query directly (`contentType`+`bindingId` in their own props) and so can seed a binding — as opposed to `collection-pagination`/`collection-filter`/etc., which only ever consume one another block already seeded. */
const BINDING_OWNER_TYPES = new Set(["collection", "featured-content"]);

/**
 * Pass 0 (PR 4.2, ADR-022 §4): walk the raw tree once, before any schema
 * validation, to find every binding-owning node's `bindingId`+`contentType`
 * and resolve its canonical query — so a `collection-pagination` block
 * elsewhere in the tree can declare the identical need and dedupe onto the
 * same result. The first owner for a given `bindingId` wins; a second one
 * reusing the same id is an authoring mistake the composer's own
 * validation should catch, not something this pass needs to referee.
 * Hidden nodes are skipped — no point resolving a query for a block that
 * will not render.
 */
function collectBindings(
  nodes: StoredNode[],
  ctx: RenderContext,
  bindings: Map<string, CollectionBinding>,
): void {
  for (const node of nodes) {
    if (node.hidden) continue;
    if (BINDING_OWNER_TYPES.has(node.type)) {
      const props = node.props as {
        contentType?: string;
        bindingId?: string;
        filter?: Record<string, string>;
        sort?: string;
        limit?: number;
      } | null;
      const bindingId = props?.bindingId ?? "main";
      if (props?.contentType && !bindings.has(bindingId)) {
        bindings.set(bindingId, {
          contentType: props.contentType,
          query: ctx.resolveBindingQuery({
            contentType: props.contentType,
            bindingId,
            filter: props.filter ?? {},
            sort: props.sort,
            limit: props.limit ?? 12,
          }),
        });
      }
    }
    collectBindings(node.children, ctx, bindings);
  }
}

function prepareNode(
  node: StoredNode,
  ctx: RenderContext,
  bindings: Record<string, CollectionBinding>,
): PreparedNode {
  const children = node.children.map((child) => prepareNode(child, ctx, bindings));
  const bgMediaIds = backgroundMediaIds(node.style);

  if (node.hidden) {
    return {
      node,
      status: "hidden",
      needs: [],
      links: [],
      mediaIds: bgMediaIds,
      cardTemplateIds: [],
      children,
    };
  }
  if (!ctx.isVisible(node.visibility, node.requiresFeature)) {
    return {
      node,
      status: "not-visible",
      needs: [],
      links: [],
      mediaIds: bgMediaIds,
      cardTemplateIds: [],
      children,
    };
  }

  const registered = getRegisteredBlock(node.type);
  if (!registered) {
    return {
      node,
      status: "unknown-type",
      needs: [],
      links: [],
      mediaIds: bgMediaIds,
      cardTemplateIds: [],
      children,
    };
  }

  const migrated = migrateBlockProps(registered.definition, node.version, node.props);
  const merged = mergeTranslation(
    migrated,
    node.translations?.[ctx.locale],
    registered.definition.translatable,
  );
  const parsed = registered.definition.schema.safeParse(merged);
  if (!parsed.success) {
    return {
      node,
      status: "invalid-props",
      needs: [],
      links: [],
      mediaIds: bgMediaIds,
      cardTemplateIds: [],
      children,
    };
  }

  const props = parsed.data as Record<string, unknown>;
  const needs =
    registered.definition.needs?.(parsed.data, { widgets: ctx.widgets, bindings }) ?? [];
  const links = (registered.definition.links ?? []).flatMap((key) => {
    const value = props[String(key)];
    return value ? [{ propKey: String(key), target: value as LinkTarget }] : [];
  });
  const propMediaIds = (registered.definition.fields ?? [])
    .filter((f) => f.kind === "media")
    .flatMap((f) => {
      const value = props[String(f.path)];
      return typeof value === "string" && value.length > 0 ? [value] : [];
    });
  const cardTemplateIds =
    typeof props.cardTemplateId === "string" && props.cardTemplateId.length > 0
      ? [props.cardTemplateId]
      : [];

  return {
    node,
    status: "ok",
    props: parsed.data,
    needs,
    links,
    mediaIds: [...bgMediaIds, ...propMediaIds],
    cardTemplateIds,
    children,
  };
}

function collectNeeds(prepared: PreparedNode): BlockDataNeed[] {
  return [...prepared.needs, ...prepared.children.flatMap(collectNeeds)];
}

function collectLinkTargets(prepared: PreparedNode): LinkTarget[] {
  return [...prepared.links.map((l) => l.target), ...prepared.children.flatMap(collectLinkTargets)];
}

function collectMediaIds(prepared: PreparedNode): string[] {
  return [...prepared.mediaIds, ...prepared.children.flatMap(collectMediaIds)];
}

function collectCardTemplateIds(prepared: PreparedNode): string[] {
  return [...prepared.cardTemplateIds, ...prepared.children.flatMap(collectCardTemplateIds)];
}

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const item of items) seen.set(key(item), item);
  return [...seen.values()];
}

function wrapEnvelope(
  content: ReactNode,
  node: StoredNode,
  ctx: RenderCtxInternal,
  selfEntrance: "none" | "fade" | "fade-up" | undefined,
): ReactNode {
  const overrides = node.style?.overrides;
  const styleClassName = resolveStyleClassName(overrides);
  const background = resolveBackground(overrides?.background, ctx.resolveMediaUrl);
  const hiddenOnClasses = (node.responsive?.hiddenOn ?? []).map((d) => HIDDEN_ON_CLASS[d]);
  const hoverClass = node.motion?.hover ? HOVER_MOTION_CLASS[node.motion.hover] : "";
  const wrapperClassName = cn(styleClassName, background?.className, hoverClass, hiddenOnClasses);

  let body = content;
  if (background?.mediaUrl) {
    body = (
      <div className="relative">
        {background.kind === "video" ? (
          // Decorative, self-hosted background video, never the primary content (ADR-032 §2).
          <video
            className="absolute inset-0 size-full object-cover"
            src={background.mediaUrl}
            poster={background.posterUrl}
            muted
            playsInline
            loop
            preload="none"
          />
        ) : (
          // A resolved MediaAsset URL, not authored CSS — Tailwind has no
          // static utility for an arbitrary image URL, so this is the one
          // legitimate inline `style` in this package (ADR-032 §2 designs
          // the feature; ADR-024 §1's ban targets hex/arbitrary colour
          // values, not a background photo's URL).
          <div
            className={cn(
              "absolute inset-0 bg-cover",
              background.position && BACKGROUND_POSITION_CLASS[background.position],
            )}
            style={{
              backgroundImage: `url(${background.mediaUrl})`,
              backgroundAttachment: background.fixed ? "fixed" : undefined,
            }}
          />
        )}
        {background.overlayClassName && (
          <div aria-hidden className={cn("absolute inset-0", background.overlayClassName)} />
        )}
        <div className="relative">{body}</div>
      </div>
    );
  }

  const wrapped = (
    <div key={node.id} id={node.anchor} className={wrapperClassName || undefined}>
      {body}
    </div>
  );

  if (selfEntrance && selfEntrance !== "none") {
    return (
      <Reveal key={node.id} variant={ENTRANCE_REVEAL_VARIANT[selfEntrance]}>
        {wrapped}
      </Reveal>
    );
  }
  return wrapped;
}

function renderNode(
  prepared: PreparedNode,
  ctx: RenderCtxInternal,
  needResults: Map<string, unknown>,
  linkResults: Map<string, ResolvedLink>,
): ReactNode {
  if (prepared.status === "hidden" || prepared.status === "not-visible") return null;

  const entrance = prepared.status === "ok" ? prepared.node.motion?.entrance : undefined;
  const rawChildren = prepared.children.map((child) =>
    renderNode(child, ctx, needResults, linkResults),
  );
  const children =
    entrance === "stagger"
      ? // Index as key: child order is stable within one render pass; each
        // child's own node id is already the key one level down.
        rawChildren.map((child, i) => (
          <Reveal key={i} variant="up" delay={i * 80}>
            {child}
          </Reveal>
        ))
      : rawChildren;

  if (prepared.status === "unknown-type") {
    ctx.onWarning?.(prepared.node.id, `unknown block type "${prepared.node.type}"`);
    return (
      <FallbackBlock
        key={prepared.node.id}
        nodeId={prepared.node.id}
        reason={`unknown block type "${prepared.node.type}"`}
        draft={ctx.draft}
      />
    );
  }
  if (prepared.status === "invalid-props") {
    ctx.onWarning?.(prepared.node.id, "invalid props after schema validation");
    return (
      <FallbackBlock
        key={prepared.node.id}
        nodeId={prepared.node.id}
        reason="invalid props"
        draft={ctx.draft}
      />
    );
  }

  const registered = getRegisteredBlock(prepared.node.type);
  if (!registered) return null; // unreachable: status "ok" implies a registered block

  const resolvedLinks: Record<string, ResolvedLink> = {};
  for (const { propKey, target } of prepared.links) {
    const resolved = linkResults.get(linkKey(target));
    if (resolved) resolvedLinks[propKey] = resolved;
  }
  const resolvedData: Record<string, unknown> = {};
  for (const need of prepared.needs) {
    const result = needResults.get(needKey(need));
    if (result !== undefined) resolvedData[need.bindingId ?? need.provider] = result;
  }

  const Component = registered.Component;
  // A `client: true` block is a "use client" reference — Next refuses a
  // function-valued prop across that boundary even when unused, so the two
  // function-shaped fields (`resolveMediaUrl`, `widgets`) are omitted
  // entirely rather than passed as `undefined` versions of themselves.
  const content = registered.definition.client ? (
    <Component
      key={prepared.node.id}
      id={prepared.node.id}
      props={prepared.props}
      resolvedLinks={resolvedLinks}
      resolvedData={resolvedData}
      locale={ctx.locale}
      draft={ctx.draft}
    >
      {registered.definition.supports.children ? children : undefined}
    </Component>
  ) : (
    <Component
      key={prepared.node.id}
      id={prepared.node.id}
      props={prepared.props}
      resolvedLinks={resolvedLinks}
      resolvedData={resolvedData}
      locale={ctx.locale}
      draft={ctx.draft}
      resolveMediaUrl={ctx.resolveMediaUrl}
      widgets={ctx.widgets}
      resolveCardTemplate={ctx.resolveCardTemplate}
    >
      {registered.definition.supports.children ? children : undefined}
    </Component>
  );

  return wrapEnvelope(content, prepared.node, ctx, entrance === "stagger" ? undefined : entrance);
}

/** Renders a full `LayoutTree` (a `PageVersion.layout`, Zod-validated by the caller) against an injected `RenderContext`. Runs with no database in its own import graph (ADR-020 compliance test). */
export async function renderTree(layout: LayoutTree, ctx: RenderContext): Promise<ReactNode[]> {
  const bindingsMap = new Map<string, CollectionBinding>();
  collectBindings(layout.nodes, ctx, bindingsMap);
  const bindings = Object.fromEntries(bindingsMap);

  const prepared = layout.nodes.map((node) => prepareNode(node, ctx, bindings));

  const needs = dedupeBy(prepared.flatMap(collectNeeds), needKey);
  const linkTargets = dedupeBy(prepared.flatMap(collectLinkTargets), linkKey);
  const mediaIds = [...new Set(prepared.flatMap(collectMediaIds))];
  const cardTemplateIds = [...new Set(prepared.flatMap(collectCardTemplateIds))];

  const [needResultsArray, linkResultsArray, mediaUrls, cardTemplates] = await Promise.all([
    needs.length ? ctx.resolveNeeds(needs) : Promise.resolve([]),
    linkTargets.length ? ctx.resolveLinks(linkTargets) : Promise.resolve([]),
    mediaIds.length
      ? ctx.resolveMediaUrls(mediaIds)
      : Promise.resolve({} as Record<string, string>),
    cardTemplateIds.length
      ? ctx.resolveCardTemplates(cardTemplateIds)
      : Promise.resolve({} as Record<string, { variant: string; config: unknown }>),
  ]);

  const needResults = new Map(needs.map((need, i) => [needKey(need), needResultsArray[i]]));
  const linkResults = new Map(
    linkTargets.map((target, i) => [linkKey(target), linkResultsArray[i] as ResolvedLink]),
  );
  // Resolved once, synchronously looked up from here down (this function's
  // own doc comment: never an async call mid-render).
  const internalCtx: RenderCtxInternal = {
    ...ctx,
    resolveMediaUrl: (assetId) => mediaUrls[assetId] ?? "",
    resolveCardTemplate: (id) => cardTemplates[id] ?? null,
  };

  return prepared.map((node) => renderNode(node, internalCtx, needResults, linkResults));
}
