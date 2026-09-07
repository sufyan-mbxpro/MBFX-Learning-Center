// The closed block registry (ADR-020, plan §6.1). `defineBlock()` is a
// typed identity helper — its job is inference at the call site, not
// validation. `registerBlock()` is called once per block, from
// `./blocks-list.ts`'s side-effect import, so `render.tsx` and
// `./definitions/index.ts` always read the same populated map; a duplicate
// `type` is a programming error, not admin-authored data, so it throws at
// import time rather than failing softly like an unknown type does at
// render time (FallbackBlock, `render.tsx`).
import type { ComponentType, ReactNode } from "react";
import type { ZodType } from "zod";
import type { CollectionBinding, EditorFieldMeta, ResolvedLink, StyleKey } from "@repo/contracts";
import type { BlockDataNeed } from "./needs.ts";
import type { WidgetMap } from "./widgets.ts";

export type { BlockDataNeed } from "./needs.ts";

export type BlockCategory = "layout" | "content" | "collection" | "detail" | "data" | "marketing";

export interface BlockDefinition<P = unknown> {
  type: string;
  version: number;
  /** i18n catalog key — never a literal string (code-style.md #2). */
  labelKey: string;
  category: BlockCategory;
  schema: ZodType<P>;
  defaults: P;
  /**
   * Declarative settings-panel metadata (plan §6.1, PR 3.3) — the composer
   * renders one control per entry, generically, off `EditorFieldMeta`
   * (`@repo/contracts`'s shared vocabulary with `WidgetDefinition`, ADR-030
   * §1). `path` is a top-level key of `P`; there is no nested-path support
   * today (every block's props are flat), so `path` is typed as `keyof P`
   * rather than the wider dotted-string the shared schema allows.
   */
  fields?: (Omit<EditorFieldMeta, "path"> & { path: keyof P & string })[];
  /** Prop keys stored per-locale in the node's `translations` (ADR-024 §3). */
  translatable?: (keyof P)[];
  /**
   * True when the registered Component is a `"use client"` reference (PR
   * 4.2's collection-filter/-search/-sort/-pagination — the first blocks
   * needing real client interactivity). `render.tsx` must not pass a
   * function-valued prop (`resolveMediaUrl`, `widgets`) to one: Next
   * refuses to serialize a plain closure across the server/client
   * boundary, even to a component that never reads it — the mere presence
   * of a function VALUE in the props object throws at runtime, regardless
   * of what the component's own type signature declares it wants.
   */
  client?: boolean;
  /** Keyed by the FROM version; bumping `version` without a matching entry is a lint-caught oversight, not a schema failure — see `blocks-list.test.ts`. */
  migrate?: Record<number, (old: unknown) => unknown>;
  supports: {
    /** Subset of the envelope's style keys the composer offers for this block (plan §6.1). */
    style?: StyleKey[];
    motion?: boolean;
    visibility?: boolean;
    children?: boolean;
  };
  /** Prop keys that accept a `ResponsiveValue<T>` (ADR-032 §3). */
  responsive?: (keyof P)[];
  /** Prop keys typed `LinkTarget`, collected and resolved by `render.tsx` (ADR-031). */
  links?: (keyof P)[];
  /**
   * Declares provider work; absent for purely presentational blocks. Takes
   * `ctx.widgets`/`ctx.bindings` (not the full `RenderContext`, to avoid a
   * registry.ts <-> render.tsx import cycle): `widgets` because the generic
   * `widget` block's own needs are the underlying widget's, resolvable only
   * by looking that widget up at collection time (ADR-030 §2 point 3);
   * `bindings` (plan v2.2 §12 PR 4.2, ADR-022 §4) because a `collection`
   * block's canonical per-`bindingId` query — authored defaults merged with
   * the request's search params, hard caps applied — is resolved ONCE by
   * `render.tsx`'s pre-pass over the whole tree, so every block sharing a
   * `bindingId` (pagination, in Phase 4) declares an identical need and
   * dedupes onto the same resolved result with no provider-specific
   * knowledge baked into `@repo/blocks` itself.
   */
  needs?: (
    props: P,
    ctx: { widgets: WidgetMap; bindings: Record<string, CollectionBinding> },
  ) => BlockDataNeed[];
}

export interface BlockComponentProps<P = unknown> {
  id: string;
  props: P;
  /** Links declared in `definition.links`, resolved by key (the prop name). */
  resolvedLinks?: Record<string, ResolvedLink>;
  /** Needs declared in `definition.needs`, resolved and handed back keyed by `JSON.stringify({ provider, query })` — see `render.tsx`'s `needKey`. */
  resolvedData?: Record<string, unknown>;
  locale: string;
  draft: boolean;
  /** Same function `render.tsx`'s envelope uses for a style background — threaded to every block so `image`/`video`-shaped props can resolve their own `MediaAsset` ids too. Omitted (never `undefined`-valued — absent) for a `client: true` block, since a function prop cannot cross the server/client boundary at all. */
  resolveMediaUrl?: (assetId: string) => string;
  /** Only the `widget` block reads this; every other block ignores it. Omitted for a `client: true` block — see `resolveMediaUrl`'s note. */
  widgets?: WidgetMap;
  /** A node's own resolved `cardTemplateId` (ADR-023, PR 4.3) — `null` when unset or the id didn't resolve to a real row, in which case the block falls back to a built-in default render, never an error. Omitted for a `client: true` block — see `resolveMediaUrl`'s note. */
  resolveCardTemplate?: (id: string) => { variant: string; config: unknown } | null;
  children?: ReactNode;
}

export interface RegisteredBlock<P = unknown> {
  definition: BlockDefinition<P>;
  Component: ComponentType<BlockComponentProps<P>>;
}

const registry = new Map<string, RegisteredBlock>();

/** Typed identity — gives call-site inference of `P` from `schema`/`defaults` without a generic annotation at every call site. */
export function defineBlock<P>(definition: BlockDefinition<P>): BlockDefinition<P> {
  return definition;
}

export function registerBlock<P>(
  definition: BlockDefinition<P>,
  Component: ComponentType<BlockComponentProps<P>>,
): void {
  if (registry.has(definition.type)) {
    throw new Error(`Block type "${definition.type}" is already registered.`);
  }
  registry.set(definition.type, { definition, Component } as RegisteredBlock);
}

export function getRegisteredBlock(type: string): RegisteredBlock | undefined {
  return registry.get(type);
}

export function listRegisteredBlocks(): RegisteredBlock[] {
  return [...registry.values()];
}

export function listBlockDefinitions(): BlockDefinition[] {
  return [...registry.values()].map((r) => r.definition);
}

/** Clears the registry — test-only (vitest resets modules between files, but a single file registering the same fixture twice needs this). */
export function _resetRegistryForTests(): void {
  registry.clear();
}

/**
 * Runs a stored node's `migrate` chain from its stored version up to the
 * definition's current version (plan §6.1). A version with no declared step
 * stops the chain early — the schema parse that follows is what turns a
 * genuinely incompatible shape into a loud failure, never a silent guess.
 */
export function migrateBlockProps(
  definition: BlockDefinition,
  storedVersion: number,
  props: unknown,
): unknown {
  let current = props;
  for (let v = storedVersion; v < definition.version; v++) {
    const step = definition.migrate?.[v];
    if (!step) break;
    current = step(current);
  }
  return current;
}
