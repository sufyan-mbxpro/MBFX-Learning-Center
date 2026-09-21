// The public site's shared interactive recipes (changes-39).
//
// The owner's ask was symmetry: "same buttons, same cards, same hover effects
// of the same type". An audit found eight hover recipes on clickable cards and
// nine hand-written chip styles. Each was reasonable where it was written, and
// together they made the site feel like several sites.
//
// These are class STRINGS, not components, on purpose. The surfaces that use
// them are anchors, `<li>`s and next-intl `Link`s with their own layout inside,
// and a wrapper component would have to forward every one of those shapes. A
// string composes with `cn()` and cannot fork: a card that needs a different
// hover has to stop importing this, which is visible in review.
//
// They are the most common recipes already on the site, not new effects:
// `INTERACTIVE_CARD` is what `CourseCard`, `QuizCard` and `VideoCard` draw, and
// `CHIP_LINK` is what the three learn shelves' filter chips draw.
//
// **Do not add `hover:ring-*` or `hover:border-*` to a card that uses
// `INTERACTIVE_CARD`.** `.card-hover` is a hand-written rule in globals.css
// and beats Tailwind's `hover:` utilities, so the tint would never show (see
// `card.tsx`). Tint the CONTENTS with `group-hover:` instead.

/**
 * A surface whose whole job is to be clicked: a card that lifts, sweeps and
 * lifts its ring. `group` is included so the contents can answer the hover
 * (`group-hover:text-primary-interactive`, `.hover-arrow`, `.media-zoom`).
 * `.sheen` sets `position: relative`, so a stretched link inside resolves
 * against the card.
 */
export const INTERACTIVE_CARD =
  "group card-hover hover-lift sheen rounded-lg bg-card ring-1 ring-foreground/10";

/** A small navigational chip: a tag, a related term, a sibling topic. */
export const CHIP_LINK =
  "inline-flex items-center gap-2 rounded-md bg-background px-3.5 py-1.5 text-sm font-medium text-muted-foreground ring-1 ring-border transition duration-(--duration-base) ease-(--ease-out-quint) hover:-translate-y-px hover:text-foreground hover:shadow-sm hover:ring-primary/25 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none";
