// Which stories the home page's desk band shows (changes-37, ADR-121 §1).
//
// The band is one row of platform-sized cards now, so it has a fixed number
// of seats and two feeds competing for them. The rule is written down here,
// pure and tested, rather than inline in a server component nobody can render
// in a unit test:
//
//   - NEWS takes up to half the row, so "what happened" is always on it when
//     anything happened.
//   - ANALYSIS takes the rest, so "what we make of it" is too.
//   - A short feed gives its seats to the other one. A row with an empty seat
//     beside a feed that had more to show is the hole ADR-116 §3 forbids.
//
// News before analysis, each newest first: the order a reader meets them in
// is the order the heading promises them in.

/** Four seats: the platform band's row, card for card. */
export const DESK_SEATS = 4;

export function deskEntries<T>(
  news: readonly T[],
  analysis: readonly T[],
  seats = DESK_SEATS,
): T[] {
  const half = Math.ceil(seats / 2);
  const newsCount = Math.min(news.length, Math.max(half, seats - analysis.length));
  const analysisCount = Math.min(analysis.length, seats - newsCount);
  return [...news.slice(0, newsCount), ...analysis.slice(0, analysisCount)];
}
