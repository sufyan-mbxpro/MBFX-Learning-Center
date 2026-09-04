import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { getGlossaryTermBySlug, getRedirect, glossaryTermPath } from "@repo/core";
import { LOCALE_DIRECTION, routing } from "@repo/i18n/routing";
import { Link } from "@repo/i18n/navigation";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { Reveal } from "@repo/ui/components/reveal";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/glossary/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [view, template] = await Promise.all([
    getGlossaryTermBySlug(locale, slug),
    getSetting("seo.titleTemplate"),
  ]);
  if (!view) return {};

  // hreflang alternates: every locale that actually has a translation.
  const languages = Object.fromEntries(
    view.alternates.map((alt) => [
      alt.locale,
      glossaryTermPath(alt.locale, routing.defaultLocale, alt.slug),
    ]),
  );

  return {
    title: (template ?? "%s").replace("%s", view.seoTitle ?? view.term),
    description: view.seoDescription ?? undefined,
    alternates: { languages },
  };
}

export default async function GlossaryTermPage({ params }: PageProps<"/[locale]/glossary/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  if (!(await isFeatureVisible("glossary", null))) notFound();

  const view = await getGlossaryTermBySlug(locale, slug);

  if (!view) {
    // Old slug? content.ts wrote a 301 row when it changed.
    const target = await getRedirect(glossaryTermPath(locale, routing.defaultLocale, slug));
    if (target) permanentRedirect(target);
    notFound();
  }

  const t = await getTranslations();

  return (
    <main className="container-page container-narrow section-md flex flex-col gap-6">
      <Reveal variant="fade">
        <Link
          href="/glossary"
          className="link-underline inline-flex items-center gap-1.5 text-sm text-primary-interactive"
        >
          <ArrowLeft aria-hidden className="size-3.5 rtl:rotate-180" />
          {t("glossary.backToList")}
        </Link>
      </Reveal>

      <Reveal variant="up">
        <h1 className="text-display-sm font-semibold tracking-tight">{view.term}</h1>
      </Reveal>

      <Reveal variant="up" delay={80}>
        {view.requestedLocaleMissing ? (
          // ADR-007: an RTL locale with no translation gets the notice in its
          // own direction — never LTR English content inside this layout.
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="font-medium">{t("notTranslated.title")}</p>
            <p className="text-sm text-muted-foreground">{t("notTranslated.body")}</p>
          </div>
        ) : (
          <>
            {view.locale !== locale &&
              LOCALE_DIRECTION[locale as keyof typeof LOCALE_DIRECTION] === "ltr" && (
                <p className="text-xs text-muted-foreground">({view.locale})</p>
              )}
            {/* Sanitized SERVER-SIDE ON SAVE (ADR-009/security.md #8) — this
                renders already-clean HTML; the save path is the boundary. */}
            <div
              className="flex flex-col gap-4 leading-relaxed [&_a]:text-primary-interactive [&_a]:underline-offset-4 [&_a:hover]:underline [&_blockquote]:border-s-2 [&_blockquote]:ps-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:font-semibold [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:ps-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted/40 [&_th]:p-2 [&_th]:text-start [&_ul]:list-disc [&_ul]:ps-5"
              dangerouslySetInnerHTML={{
                __html: view.simpleExplanation + (view.detailedExplanation ?? ""),
              }}
            />
          </>
        )}
      </Reveal>
    </main>
  );
}
