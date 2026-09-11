// One school's shell: the pinned section bar every page under
// `/learn/<track>` shares (ADR-065 §5).
//
// The bar is built from `learnSectionsFor(track)` and filtered by feature
// flag — a section whose flag is off is ABSENT, not disabled, because its
// route already 404s and a tab that leads to a 404 is worse than no tab
// (ADR-055 §7's rule, kept).
//
// **A soft 404, knowingly.** `notFound()` here renders the not-found page,
// but the response carries 200: `learn/loading.tsx` streams a shell before
// this layout runs and the status is committed with it. `dynamicParams =
// false` would have made an unregistered track 404 at the routing layer, and
// it is REFUSED under Cache Components ("not compatible with
// nextConfig.cacheComponents") — ADR-004's trade, not a local one. The same
// 200 is already served by `/news/<unknown-slug>`, so this is one instance of
// a repo-wide question that belongs to Module 14, not a regression here.
//
// **The track is validated here and nowhere else in the segment.** An
// unregistered `[track]` has no page under it worth rendering, and a layout
// that 404s takes its children with it — which is exactly what should happen
// for `/learn/nonsense`. This is the one case where `notFound()` belongs in a
// layout rather than in each page: the failure is the SEGMENT's, not the
// page's. Each page still runs its own feature-flag check, because a flag is
// per-surface and this layout cannot know which one it is wrapping.
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isLearnTrack, LEARN_TRACK_KEYS } from "@repo/contracts";
import { isFeatureVisible } from "@repo/settings";
import { LearnSectionNav, type LearnSectionNavItem } from "../_components/learn-section-nav.tsx";
import { learnSectionsFor } from "../_nav/learn-sections.ts";

/**
 * The tracks are a code registry (ADR-055 §2), so both are known at build
 * time — the segment prerenders rather than matching at request time.
 */
export function generateStaticParams(): { track: string }[] {
  return LEARN_TRACK_KEYS.map((track) => ({ track }));
}

export default async function LearnTrackLayout({
  children,
  params,
}: LayoutProps<"/[locale]/learn/[track]">) {
  const { locale, track } = await params;
  setRequestLocale(locale);
  if (!isLearnTrack(track)) notFound();

  const t = await getTranslations({ locale, namespace: "learn" });
  const sections = learnSectionsFor(track);

  // One visibility read per registered section, resolved together. All three
  // hit the same cached flag map (`settings:features`), so this is three map
  // lookups rather than three queries.
  const visible = await Promise.all(
    sections.map(async (section) =>
      section.flag === null ? true : isFeatureVisible(section.flag, null),
    ),
  );

  const items: LearnSectionNavItem[] = sections
    .filter((_, index) => visible[index])
    .map((section) => ({ href: section.href, label: t(section.labelKey) }));

  return (
    <>
      {/* One entry left in the strip is the section itself — a row of one tab
          is chrome that tells the reader nothing, so it is not rendered. */}
      {items.length > 1 && <LearnSectionNav items={items} ariaLabel={t("nav.sectionLabel")} />}
      {children}
    </>
  );
}
