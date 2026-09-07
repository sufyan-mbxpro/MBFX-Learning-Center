import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buildPageSeo, getMediaUrls, resolvePublicPage } from "@repo/core";
import { getSetting } from "@repo/settings";
import { renderTree } from "@repo/blocks/render";
import { layoutTreeSchema } from "@repo/contracts";
import { buildRenderContext, flattenSearchParams } from "../../../_cms/render-context.ts";

// Module 16 Phase 1 (plan v2.2 §7.2/§12 PR 1.4) resolved the page; Phase 3
// PR 3.3 wires the actual renderer in, mirroring `[locale]/page.tsx`'s
// `renderCmsHome` — this route was the last "title-only placeholder" left
// once the composer made it possible to author a real layout for a static
// page (previously only the seeded `home` page had one).
//
// A REQUIRED catch-all (`[...slug]`, not `[[...slug]]`): Next.js refuses
// an optional catch-all as a sibling of `[locale]/page.tsx` ("You cannot
// define a route with the same specificity as a optional catch-all
// route") because both would claim "/". The home page stays on
// `home.sections` via `[locale]/page.tsx` until Phase 2 (plan §12 PR 2.7)
// migrates it behind a fallback switch — this route only ever sees one or
// more path segments, never the root. Explicit route files (news/,
// analysis/, glossary/, admin/, api/, ...) keep Next's normal precedence
// over this catch-all, so `resolvePublicPage`'s own reserved-path guard is
// defensive, not the only line of defense.
function pathFromSlug(slug: string[]): string {
  return `/${slug.join("/")}`;
}

// No generateStaticParams yet: Cache Components refuse a `generateStaticParams`
// that returns an empty array ("all generateStaticParams functions must
// return at least one result"), and Phase 1 has zero published STATIC
// pages to enumerate — @repo/core's loadStaticPageParams() exists and is
// ready to wire in once Phase 4/5 publishes real CMS pages (ADR-025 §3).
// Until then this route is fully dynamic per request, which is correct
// for a feature with no content yet.

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/[...slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const { isEnabled: draft } = await draftMode();
  const resolved = await resolvePublicPage(locale, pathFromSlug(slug), { draft });
  if (resolved.kind !== "page") return {};

  const [template, defaultOgImage] = await Promise.all([
    getSetting("seo.titleTemplate"),
    getSetting("seo.defaultOgImage"),
  ]);
  const seo = buildPageSeo(resolved.page, locale);
  // Suggestions (plan §9/§12 PR 3.6) come from the page's own first
  // heading/paragraph/image — same fallback chain as the article route's
  // `ogImage`, one step earlier: explicit field → suggested from content →
  // site default.
  const ogImageUrls = seo.ogImageId ? await getMediaUrls([seo.ogImageId]) : {};
  const ogImage = (seo.ogImageId && ogImageUrls[seo.ogImageId]) ?? defaultOgImage ?? undefined;

  return {
    title: (template ?? "%s").replace("%s", seo.title),
    description: seo.description ?? undefined,
    alternates: seo.canonicalUrl ? { canonical: seo.canonicalUrl } : undefined,
    robots: seo.robots?.includes("noindex") ? { index: false, follow: false } : undefined,
    openGraph: {
      title: seo.title,
      description: seo.description ?? undefined,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default async function CmsPage({ params, searchParams }: PageProps<"/[locale]/[...slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const path = pathFromSlug(slug);

  const { isEnabled: draft } = await draftMode();
  const resolved = await resolvePublicPage(locale, path, { draft });

  if (resolved.kind === "redirect") permanentRedirect(resolved.to);
  if (resolved.kind === "not-found") notFound();

  // JSON-LD (plan §9/§12 PR 3.6): `WebPage` by default, or whatever
  // `PageTranslation.schemaType` an admin set — same inline-`<script>`
  // pattern as `news/[slug]/page.tsx`, not a separate rendering helper.
  const seo = buildPageSeo(resolved.page, locale);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": seo.schemaType,
    name: seo.title,
    description: seo.description ?? undefined,
  };

  const layout = layoutTreeSchema.safeParse(resolved.page.layout);
  if (!layout.success || layout.data.nodes.length === 0) {
    const t = await getTranslations("public");
    return (
      <main className="flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <section className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-16">
          <h1 className="text-3xl font-semibold">{resolved.page.title}</h1>
          <p className="text-muted-foreground">{t("pagePlaceholder")}</p>
        </section>
      </main>
    );
  }

  const ctx = buildRenderContext({
    locale,
    draft,
    subject: null,
    searchParams: flattenSearchParams(await searchParams),
  });
  const elements = await renderTree(layout.data, ctx);
  return (
    <main className="flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {elements}
    </main>
  );
}
