// The Learn area's section registry (changes-11 D25, ADR-055 §7; rebuilt per
// track by ADR-065 §5).
//
// Site structure lives in code (ADR-042), so this is a registry, not a table
// and not a seeded menu — the same shape `ABOUT_ROUTE_KEYS` uses for the About
// section. Adding a section is a code change, deliberately.
//
// What ADR-065 changed: the three surfaces are no longer one fixed list, they
// are a function of the track being read. `/learn/forex/quizzes` and
// `/learn/crypto/quizzes` are different pages with different quizzes on them,
// so a single shared list would send a crypto reader to a forex index.
//
// `/glossary` no longer appears here. ADR-055 §7 kept it in the strip because
// it was the only glossary there was; a track now has its OWN A–Z view at
// `/learn/<track>/glossary`, which is a filtered view onto the same terms and
// links to the same `/glossary/<term>` pages. The global glossary keeps its
// own menu entry and its own URLs — it did not move (ADR-065 §2).
import { LEARN_TRACK_ROUTE_KEYS, ROUTE_PATHS, type LearnTrackKey } from "@repo/contracts";
import type { MessageKey } from "@repo/i18n";

export interface LearnSectionSpec {
  readonly href: string;
  /** Message key inside the public `learn` namespace (ADR-043 #1). */
  readonly labelKey: MessageKey<"learn">;
  /**
   * The feature flag this section's route is gated on, or null when the
   * section is always present. A section whose flag is OFF is ABSENT from the
   * nav rather than disabled: the route already 404s, and a tab that leads to
   * a 404 is worse than no tab (D25).
   */
  readonly flag: string | null;
}

/**
 * The four surfaces of one school, in tab order.
 *
 * Built from `LEARN_TRACK_ROUTE_KEYS` rather than by string concatenation, so
 * a track whose route keys were never registered fails to compile here instead
 * of rendering tabs that 404.
 */
export function learnSectionsFor(track: LearnTrackKey): readonly LearnSectionSpec[] {
  const keys = LEARN_TRACK_ROUTE_KEYS[track];
  return [
    { href: ROUTE_PATHS[keys.index], labelKey: "nav.courses", flag: "courses" },
    { href: ROUTE_PATHS[keys.videos], labelKey: "nav.videos", flag: "videos" },
    { href: ROUTE_PATHS[keys.quizzes], labelKey: "nav.quizzes", flag: "quizzes" },
    { href: ROUTE_PATHS[keys.glossary], labelKey: "nav.glossary", flag: "glossary" },
  ];
}

/**
 * The current section: the entry whose href is the LONGEST prefix of the
 * pathname.
 *
 * Longest-prefix rather than plain-prefix, because `/learn/<track>` is the
 * parent of BOTH `/learn/<track>/[course]` and `/learn/<track>/quizzes` — a
 * plain rule would light up Courses while the reader is taking a quiz.
 * `/learn/forex/x/y` resolves to Courses because no longer entry matches it.
 *
 * Here rather than in the client component so it can be tested as what it is:
 * a pure function over strings, with no React and no router.
 */
export function activeSectionHref(pathname: string, hrefs: readonly string[]): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .toSorted((a, b) => b.length - a.length)[0];
}
