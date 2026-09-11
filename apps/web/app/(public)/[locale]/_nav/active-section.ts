// Which entry of a section bar is current (ADR-065 §5; shared since ADR-076 §1).
//
// The entry whose href is the LONGEST prefix of the pathname. Longest-prefix
// rather than plain-prefix, because a section's index is the parent of its
// siblings: `/learn/<track>` is a prefix of BOTH `/learn/<track>/[course]` and
// `/learn/<track>/quizzes`, and `/about` is a prefix of `/about/why-us`. A
// plain rule would light up the index on every page in the section.
// `/learn/forex/x/y` resolves to Courses because no longer entry matches it.
//
// Here rather than in the client component so it can be tested as what it is:
// a pure function over strings, with no React and no router.
export function activeSectionHref(pathname: string, hrefs: readonly string[]): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .toSorted((a, b) => b.length - a.length)[0];
}
