// SEO suggestions (plan v2.2 §9/§12 PR 3.6): explicit `PageTranslation` SEO
// fields win when set; otherwise the title/description/OG image are
// suggested from the page's own content — the first heading, first
// paragraph, first image, in document order. Pure logic, no DB — the same
// shape as `gates.ts`'s tree-walking checks, not a Next.js-shaped helper
// (building the actual `Metadata`/JSON-LD objects stays in the app, next to
// the `news/[slug]/page.tsx` precedent that already does the same).
import { layoutTreeSchema } from "@repo/contracts";
import type { StoredNode } from "@repo/contracts";
import type { PublicPageRow } from "./public-pages.ts";

export interface PageSeo {
  title: string;
  description: string | null;
  ogImageId: string | null;
  canonicalUrl: string | null;
  robots: string | null;
  schemaType: string;
}

const DESCRIPTION_MAX = 160;

function flattenNodes(nodes: StoredNode[]): StoredNode[] {
  return nodes.flatMap((n) => [n, ...flattenNodes(n.children)]);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max)}…`;
}

/** A node's translatable text, resolved for `locale` the same way the renderer merges it (`node.translations[locale]` over `node.props`) — falls back to the base-locale prop when the translation is missing or blank. */
function resolveText(node: StoredNode, locale: string): string | null {
  const translation = node.translations?.[locale] as Record<string, unknown> | undefined;
  const props = node.props as Record<string, unknown> | null;
  const text = (translation?.text as string | undefined) ?? (props?.text as string | undefined);
  return typeof text === "string" && text.trim().length > 0 ? text.trim() : null;
}

function firstText(
  flat: StoredNode[],
  type: "heading" | "paragraph",
  locale: string,
): string | null {
  for (const node of flat) {
    if (node.type !== type || node.hidden) continue;
    const text = resolveText(node, locale);
    if (text) return text;
  }
  return null;
}

function firstImageAssetId(flat: StoredNode[]): string | null {
  for (const node of flat) {
    if (node.type !== "image" || node.hidden) continue;
    const assetId = (node.props as { assetId?: string } | null)?.assetId;
    if (typeof assetId === "string" && assetId.trim().length > 0) return assetId;
  }
  return null;
}

/**
 * Not built here, named rather than silently missing: hreflang alternates
 * (needs a page-translations lookup `PublicPageRow` doesn't carry today —
 * real, separable follow-up work, not part of this PR's two named
 * deliverables).
 */
export function buildPageSeo(page: PublicPageRow, locale: string): PageSeo {
  const parsed = layoutTreeSchema.safeParse(page.layout);
  const flat = parsed.success ? flattenNodes(parsed.data.nodes) : [];

  const suggestedTitle = firstText(flat, "heading", locale);
  const suggestedDescription = firstText(flat, "paragraph", locale);
  const suggestedOgImageId = firstImageAssetId(flat);

  const description = page.seoDescription ?? suggestedDescription;

  return {
    title: page.seoTitle ?? suggestedTitle ?? page.title,
    description: description ? truncate(description, DESCRIPTION_MAX) : null,
    ogImageId: page.ogImageId ?? suggestedOgImageId,
    canonicalUrl: page.canonicalUrl,
    robots: page.robots,
    schemaType: page.schemaType ?? "WebPage",
  };
}
