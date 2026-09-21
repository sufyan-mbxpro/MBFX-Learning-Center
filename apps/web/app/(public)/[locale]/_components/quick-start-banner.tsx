// The floating card that overlaps the homepage hero (changes-31).
//
// The reference puts a white search panel across the bottom edge of its hero:
// four labelled cells divided by vertical hairlines, then one filled action.
// It is the page's single most useful piece of furniture — it turns "here is a
// beautiful photograph" into "here is where to go next" without a scroll.
//
// Ours is the same SHAPE with the job a learning site actually has. A search
// box would be the literal copy and the wrong one: we have four distinct
// destinations and a visitor who does not yet know the vocabulary to search
// with — that is precisely who the glossary cell is for.
//
// Every cell is a LINK, not a select. The reference's are form controls
// because its four fields compose into one query; ours are four different
// pages, and a dropdown that navigates on change is a control that cannot be
// opened with a keyboard without going somewhere.
import { getTranslations } from "next-intl/server";
import { ArrowRight, BookOpen, Calculator, Compass, GraduationCap } from "lucide-react";

import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";

/**
 * The four entry points, in the order a visitor meets them: where to begin,
 * where to practise, where to look a word up, where to do the arithmetic.
 *
 * A code registry, like every other composition on this page (ADR-042). The
 * WORDS are catalog keys; the destinations are `ROUTE_PATHS`, so a route that
 * is renamed is a type error here rather than a 404 on the homepage.
 */
const ENTRY_POINTS = [
  {
    icon: GraduationCap,
    href: ROUTE_PATHS.learn,
    labelKey: "bannerStartLabel",
    valueKey: "bannerStartValue",
  },
  {
    icon: Compass,
    // Quizzes are track-scoped (ADR-065): a quiz has one canonical URL, so
    // there is no bare `/quizzes` to point at. Forex is the default school.
    href: ROUTE_PATHS["learn-forex-quizzes"],
    labelKey: "bannerPractiseLabel",
    valueKey: "bannerPractiseValue",
  },
  {
    icon: BookOpen,
    href: ROUTE_PATHS.glossary,
    labelKey: "bannerLookUpLabel",
    valueKey: "bannerLookUpValue",
  },
  {
    icon: Calculator,
    href: ROUTE_PATHS.tools,
    labelKey: "bannerToolsLabel",
    valueKey: "bannerToolsValue",
  },
] as const;

export async function QuickStartBanner({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <Container>
      {/*
        `shadow-float` is the tier the design system reserves for a panel that
        genuinely floats over other content — the only other user is the mega
        menu. `bg-card` rather than the page ground: the card has to read as a
        separate object where it crosses the footage.
      */}
      <div className="rounded-xl border bg-card p-4 shadow-float sm:p-5">
        <div className="grid grid-cols-1 items-center gap-4 lg:grid-cols-(--grid-fill-auto) lg:gap-6">
          {/*
            `divide-x` is a border BETWEEN columns and flips with the writing
            mode on its own — no [dir] rule, the same reason MetricRow uses it.
            It only appears once the cells are side by side; stacked, the rule
            would run across the card rather than between its parts.
          */}
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-border lg:grid-cols-4">
            {ENTRY_POINTS.map(({ icon: Icon, href, labelKey, valueKey }) => (
              <li key={labelKey} className="min-w-0">
                <Link
                  href={href}
                  // The whole cell is the target, not just the words in it —
                  // a 13px label is a small thing to ask a pointer to hit.
                  className="group/cell flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary-interactive">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-2xs tracking-caps text-muted-foreground uppercase">
                      {t(labelKey)}
                    </span>
                    <span className="truncate text-sm font-medium text-foreground group-hover/cell:text-primary-interactive">
                      {t(valueKey)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <Button size="lg" className="w-full lg:w-auto" render={<Link href={ROUTE_PATHS.learn} />}>
            {t("bannerCta")}
            <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
          </Button>
        </div>
      </div>
    </Container>
  );
}
