import { Fragment, Suspense } from "react";
import type { Metadata } from "next";
import { siteUrl } from "../../_lib/site-url.ts";
import { alternatesFor, jsonLd, localizedPath, shareMetadata } from "../../_lib/seo.ts";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSetting } from "@repo/settings";
import { getBrandAssets } from "@repo/core";
import { getServableLocales } from "@repo/i18n";
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { SECTION_COMPONENTS, SECTION_PENDING } from "./_sections/registry.ts";
import { SectionSkeleton } from "./_sections/section-skeleton.tsx";

// Homepage assembled from the section registry (`home.sections` setting):
// order, visibility, layout VARIANT and item COUNT are data, and the
// components behind each key live in `_sections/registry.ts`. Sections whose
// feature verticals haven't landed render as named stubs, so the assembly
// stays honest about what exists.
//
// ADR-042 (2026-09-07) removed the CMS switch that used to run ahead of this
// one. Between plan v2.2 PR 2.7 and that ADR, `renderCmsHome()` resolved the
// published `home` `PageVersion` first and this path only ran as its
// fallback — which meant the cancelled Website Builder was rendering the live
// homepage with its admin UI permanently hidden. With the programme cancelled
// (site design is code, only content data is dynamic) the code path is the
// only path again. The `home` CMS page rows are NOT deleted — ADR-042
// Decision #2 retains them — they are simply no longer resolved here.
//
// This is a restoration, not a reduction: the published CMS home carried FOUR
// sections (hero, newsletter, faq, risk_disclaimer) where this registry also
// has `latest_analysis` and `glossary_spotlight`, whose migration to
// `collection` blocks was slated for a Phase 4 that never landed.
//
// Metadata is locale-aware and catalog-driven. The CMS `generateMetadata` this
// replaces only ever produced a real title for `en` — `seed.ts` writes a
// `PageTranslation` for the default locale only, so `es`/`ar`/`ur` fell through
// to `{}` and inherited the layout's (then hardcoded English) fallback. Reading
// the catalogs instead gives every locale a translated title and description.
//
// hreflang: the homepage is the one page guaranteed to exist in every ACTIVE
// locale, so `alternates.languages` is exact here — no per-row translation
// lookup needed, unlike article/glossary detail pages which list only the
// locales that actually have a translation. Path shape mirrors `articlePath()`:
// no prefix for the default locale (`localePrefix: "as-needed"`).
export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tCommon, servable] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
    getServableLocales(),
  ]);
  const siteName = tCommon("siteName");

  return {
    // The site name ALONE, never through `seo.titleTemplate`: the template's
    // job is to append the brand to a page's own title, and the home page's
    // title IS the brand — "MBX Learning Center | MBX Pro" said it twice, in
    // two different names.
    title: siteName,
    description: t("heroBody"),
    alternates: await alternatesFor({
      canonical: localizedPath(locale, "/"),
      languages: servable.map((code) => ({ locale: code, href: localizedPath(code, "/") })),
    }),
    ...(await shareMetadata({
      locale,
      siteName,
      url: localizedPath(locale, "/"),
      title: siteName,
      description: t("heroBody"),
    })),
  };
}

async function SectionStub({ sectionKey }: { sectionKey: string }) {
  const t = await getTranslations("home");
  return (
    <Section spacing="sm">
      <Container>
        <div className="flex items-center justify-between rounded-lg border border-dashed p-6 text-muted-foreground">
          <span className="text-sm font-medium capitalize">{sectionKey.replaceAll("_", " ")}</span>
          <span className="text-xs">{t("sectionStub")}</span>
        </div>
      </Container>
    </Section>
  );
}

/**
 * How many bands render without a boundary (changes-28 PR 6, ADR-095).
 *
 * The first two are what a visitor sees before scrolling, and suspending them
 * buys nothing — a skeleton that is replaced before the reader's eye has
 * settled is a flash, not a progressive load. Everything after streams.
 */
const EAGER_SECTIONS = 2;

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [sectionSetting, tCommon, brandAssets] = await Promise.all([
    getSetting("home.sections"),
    getTranslations("common"),
    getBrandAssets(),
  ]);
  const sections = sectionSetting ?? [];
  const enabled = sections.filter((s) => s.enabled).toSorted((a, b) => a.order - b.order);

  // `Organization` + `WebSite`, once, on the home page — the page that IS the
  // site. Only what we can state from data we hold (the discipline
  // `course-json-ld.tsx` follows): a name, the address and the uploaded logo.
  // No `SearchAction`: search is a palette over an API, and there is no
  // results URL to template.
  const origin = siteUrl();
  const logo = brandAssets.logo_light?.url ?? brandAssets.logo_dark?.url ?? null;
  const siteGraph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: tCommon("siteName"),
        url: `${origin}/`,
        ...(logo ? { logo: logo.startsWith("http") ? logo : `${origin}${logo}` } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: tCommon("siteName"),
        url: `${origin}${localizedPath(locale, "/")}`,
        inLanguage: locale,
        publisher: { "@id": `${origin}/#organization` },
      },
    ],
  };

  return (
    <main className="flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(siteGraph) }} />
      {enabled.map((section, index) => {
        const Component = SECTION_COMPONENTS[section.key];
        if (!Component) return <SectionStub key={section.key} sectionKey={section.key} />;

        const band = <Component locale={locale} variant={section.variant} limit={section.limit} />;
        // A Fragment, not a wrapper element: `main` is a flex column and an
        // extra div between it and a full-bleed `Section` would become the
        // flex item, collapsing the band's own background to content width.
        if (index < EAGER_SECTIONS) return <Fragment key={section.key}>{band}</Fragment>;

        // ADR-095. One boundary per band, so the page arrives band by band
        // instead of all at once at the speed of its slowest query. Under
        // Cache Components a fully cached section resolves immediately and the
        // fallback never paints, so this costs nothing on a warm cache — it
        // is the cold one, and the uncached reads inside a band, that it is
        // here for.
        const pending = SECTION_PENDING[section.key];
        return (
          <Suspense
            key={section.key}
            fallback={<SectionSkeleton tone={pending?.tone} cards={pending?.cards} />}
          >
            {band}
          </Suspense>
        );
      })}
    </main>
  );
}
