// The Widget registry (ADR-030 §1). A widget is split into a `definition`
// (metadata, no React DOM, no @repo/ui — mirrors a block's own
// definition.ts) and a `runtime` (React, built from @repo/ui). Both
// generics reference `BlockDataNeed`/`RenderContext` from `./registry.ts`
// and `./render.tsx`, which is why these live here rather than in
// `@repo/contracts`: ADR-030's own code comment says "the shapes" belong to
// contracts, but a contracts package cannot depend on this package
// (architecture.md #8 — contracts stays a leaf) and `WidgetDefinition`
// cannot describe its own `needs` callback without `BlockDataNeed`. What
// *is* wire-shaped (category, registry-key format, editor field metadata)
// already lives in `@repo/contracts/src/cms/widgets.ts` and is re-exported
// below unchanged; only the function-carrying registry types move here —
// a file-placement correction found while coding this PR, not a reversal
// of ADR-030's decision (widgets still split definition/runtime, still
// dispatch through one generic block, still live in feature packages).
import type { ReactNode } from "react";
import type { ZodType } from "zod";
import type { EditorFieldMeta, FeatureVisibilityInput, WidgetCategory } from "@repo/contracts";
import type { BlockDataNeed } from "./needs.ts";

export type { EditorFieldMeta, WidgetCategory };

export interface WidgetDefinition<Config = unknown> {
  /** Dot-namespaced, e.g. "calc.pip" (`@repo/contracts`' `registryKeySchema`). */
  key: string;
  labelKey: string;
  category: WidgetCategory;
  version: number;
  migrate?: Record<number, (old: unknown) => unknown>;
  configSchema: ZodType<Config>;
  defaults: Config;
  fields: EditorFieldMeta[];
  /** Optional server data (ADR-029) — resolved exactly like a collection block's needs, same dedupe and cache-scope rules. */
  needs?: (config: Config) => BlockDataNeed[];
  /** Named mutations the runtime may call; `apps/web` binds the implementation at assembly time (ADR-030 §3-4). */
  actions?: Record<string, ZodType>;
  visibility?: FeatureVisibilityInput;
  requiresFeature?: string;
  supports: { style?: string[]; motion?: boolean; width?: boolean };
}

export interface WidgetRenderProps<Config = unknown, Data = unknown> {
  config: Config;
  data?: Data;
  locale: string;
  draft: boolean;
  /** Bound server actions for this widget key, injected at assembly time (ADR-030 §3). */
  actions: Record<string, (input: unknown) => Promise<unknown>>;
}

export interface WidgetRuntime<Config = unknown, Data = unknown> {
  /** RSC root; a client leaf lives inside, as `@repo/blocks` itself never puts `"use client"` at a block root. */
  Render: (props: WidgetRenderProps<Config, Data>) => ReactNode;
  Skeleton: () => ReactNode;
  Empty?: () => ReactNode;
  Error?: (props: { retry?: boolean }) => ReactNode;
}

export interface WidgetRegistryEntry<Config = unknown, Data = unknown> {
  definition: WidgetDefinition<Config>;
  runtime: WidgetRuntime<Config, Data>;
}

/** Typed identity, same purpose as `defineBlock` — inference at the call site, no validation performed here. */
export function defineWidget<Config, Data = unknown>(
  entry: WidgetRegistryEntry<Config, Data>,
): WidgetRegistryEntry<Config, Data> {
  return entry;
}

/**
 * What `apps/web/app/_cms/registry.ts` assembles and injects as
 * `RenderContext.widgets` — `key -> entry`. Empty until a feature package
 * registers one (PR 2.5 ships the dispatch mechanism only; the first real
 * widget is Phase 7's Pip Calculator, GT4). `any`: the same heterogeneous-
 * generics trade-off `@repo/blocks/definitions`' `ALL_BLOCK_DEFINITIONS`
 * makes — a map holding `WidgetRegistryEntry<Config>` for many different
 * `Config`s has no sound common element type once `needs`/`configSchema`
 * are contravariant in `Config`. The `widget` block reads through this map
 * generically (`entry.definition.configSchema.safeParse(...)`), which is
 * exactly the boundary where the erasure is supposed to happen.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
export type WidgetMap = Record<string, WidgetRegistryEntry<any, any>>;

/** Same shape as `registry.ts`'s `migrateBlockProps`, for a widget's own `config` instead of a block's `props`. */
export function migrateWidgetConfig(
  definition: WidgetDefinition,
  storedVersion: number,
  config: unknown,
): unknown {
  let current = config;
  for (let v = storedVersion; v < definition.version; v++) {
    const step = definition.migrate?.[v];
    if (!step) break;
    current = step(current);
  }
  return current;
}
