import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSetting } from "@repo/settings";
import { getActiveLocales } from "@repo/i18n";
import { routing } from "@repo/i18n/routing";
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { SECTION_COMPONENTS } from "./_sections/registry.ts";

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

  const [t, tCommon, template, activeLocales] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
    getSetting("seo.titleTemplate"),
    getActiveLocales(),
  ]);

  const languages = Object.fromEntries(
    activeLocales.map((l) => [l.code, l.code === routing.defaultLocale ? "/" : `/${l.code}`]),
  );

  return {
    title: (template ?? "%s").replace("%s", tCommon("siteName")),
    description: t("heroBody"),
    alternates: { languages },
    openGraph: { title: tCommon("siteName"), description: t("heroBody") },
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

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sections = (await getSetting("home.sections")) ?? [];
  const enabled = sections.filter((s) => s.enabled).toSorted((a, b) => a.order - b.order);

  return (
    <main className="flex flex-col">
      {enabled.map((section) => {
        const Component = SECTION_COMPONENTS[section.key];
        if (!Component) return <SectionStub key={section.key} sectionKey={section.key} />;
        return (
          <Component
            key={section.key}
            locale={locale}
            variant={section.variant}
            limit={section.limit}
          />
        );
      })}
    </main>
  );
}
