import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getLearnIndex } from "@repo/core";
import { ROUTE_PATHS } from "@repo/contracts";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { CtaBand } from "@repo/ui/components/cta-band";
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";
import { Section } from "@repo/ui/components/section";
import { CourseShelf } from "./_components/course-shelf.tsx";
import { LearnMasthead } from "./_components/learn-masthead.tsx";
import { learnStats, shelfLabels, toShelfTracks } from "./_lib/shelf-data.ts";
import { LEARNING_VIDEOS } from "../_content/home-videos.ts";
import { VideoShowcase } from "../_sections/video-showcase.tsx";

// The learn UMBRELLA index (changes-11 PR 4.1; re-scoped by ADR-065 §1).
//
// Since ADR-065 this page is one level above the schools rather than the only
// learning page there is: `/learn/forex` and `/learn/crypto` are where a
// reader lands from the header, and this is the overview that shows both and
// is linked from each panel's "view all" row.
//
// It renders NO section bar. The bar's entries are a track's three surfaces
// (ADR-065 §5), and this page belongs to neither track — a bar pointing into
// one school would be wrong on the one page that spans both.
//
// `getLearnIndex` is the cached, `content`-tagged loader; it reads NO session
// (ADR-056 #1), so this page stays static and ISR-able. Progress arrives
// client-side and the shelf already accepts a `cta` slot for it.
//
// A track with zero published courses renders no band at all — that rule lives
// in the loader (which omits the group) rather than here, so an empty band is
// impossible by construction rather than by this template remembering to check.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/learn">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "learn" }),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t("meta.indexTitle")),
    description: t("meta.indexDescription"),
    alternates: { canonical: ROUTE_PATHS.learn },
  };
}

export default async function LearnIndexPage({ params }: PageProps<"/[locale]/learn">) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Disabled feature → 404, not a blank page. The flag IS the module switch,
  // the same rule `/news` and `/glossary` already follow.
  if (!(await isFeatureVisible("courses", null))) notFound();

  const [t, groups] = await Promise.all([
    getTranslations({ locale, namespace: "learn" }),
    getLearnIndex(locale),
  ]);

  const tracks = toShelfTracks(groups, t);

  return (
    <>
      <LearnMasthead stats={learnStats(groups)} hasVideos={LEARNING_VIDEOS.length > 0} />

      {tracks.length === 0 ? (
        <Section spacing="md">
          <Container>
            <Empty>
              <EmptyTitle>{t("index.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("index.emptyBody")}</EmptyDescription>
            </Empty>
          </Container>
        </Section>
      ) : (
        <CourseShelf tracks={tracks} labels={shelfLabels(t)} />
      )}

      {/* The anchor the masthead scrolls to. On the wrapper rather than inside
          the section component, because that component is shared with the
          homepage and an id belongs to the page that placed it. */}
      <div id="videos" className="scroll-mt-24">
        <VideoShowcase locale={locale} variant="grid" showCta={false} />
      </div>

      <CtaBand title={t("index.ctaTitle")} description={t("index.ctaDescription")}>
        <Button
          size="lg"
          shape="pill"
          variant="secondary"
          render={<Link href={ROUTE_PATHS.glossary} />}
        >
          {t("index.ctaAction")}
        </Button>
      </CtaBand>
    </>
  );
}
