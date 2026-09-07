// Derived from `Page.parentId` (plan §6.2), not authored — the only Phase 2
// block whose content is a `needs` resolution rather than props. The
// ancestor-chain provider itself is `@repo/core` work that lands with the
// rest of the page services (not scoped to this block-focused PR); until
// it is injected via `ctx.resolveNeeds`, this block resolves to no data and
// renders nothing — the same "never crash on missing data" contract every
// other need-driven block follows (ADR-029).
import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const breadcrumbPropsSchema = z.object({});
export type BreadcrumbProps = z.infer<typeof breadcrumbPropsSchema>;

export const BREADCRUMB_PROVIDER = "cms.page-ancestors";

export const definition = defineBlock<BreadcrumbProps>({
  type: "breadcrumb",
  version: 1,
  labelKey: "cms.blocks.breadcrumb.label",
  category: "content",
  schema: breadcrumbPropsSchema,
  defaults: {},
  needs: () => [{ provider: BREADCRUMB_PROVIDER, query: {}, scope: "page" }],
  supports: { visibility: true },
});
