# ADR-121: One pager for the site, the desk band as a row of cards, and a carousel that may move

**Status:** Accepted
**Date:** 2026-09-16
**Module:** 12 (public site), 07 (`@repo/ui`), 09 (admin shell), 13 (market provider screen), 01 (`@repo/db` seed)
**Plan:** `docs/changes/changes-37-fixes.md`
**Reference:** `docs/changes/image-68.png`
**Supersedes:** ADR-116 §2's _shape_ for the `desk` variant (a lead story beside a 2x2 analysis panel). ADR-116 §2's _rule_ stands: news and analysis stay visibly distinct wherever both appear. Narrows `Carousel`'s "no autoplay" to "no autoplay by default".
**Superseded by:** —

## Context

The owner's changes-37 list, in their words:

> all the news & analysis display should be same size like the The platform
> cards.. reduce the white spaces.. show the picture first then text same in the
> news.. reduce the size as well vertically

> add the paginations of each section … courses, videos, quizzes.. the
> pagination will work without page loading.. every page should have default 6
> courses.. the paginations buttons & style should be same for the whole site

> Trusted by learners and educators worldwide … remove this from the home page

> [the testimonial] should automatically change.. also when hover then also
> show the left right icons to slide

> /news Browse by topic — add the real background image.. remove the card top
> colourful line

> add the provider api in settings as well.. place on both sides

> fixed visit site in admin side

Four of these contradict something the code or an ADR states, which is why they
are decisions rather than edits.

## Decision

### 1. The desk band is one row of platform-sized cards

The `desk` variant renders `ArticleCards variant="standard"` — the card
changes-36 already sized to the platform band (16:10 cover on top, 16px title,
two-line clamp, four across) — over four seats. `deskEntries()` fills them:
news takes up to half, analysis the rest, and a short feed gives its seats to
the other. Each card shows its KIND chip, and each feed on the row gets its own
call to action in the heading row. That is how ADR-116 §2's rule — distinct, not
separate — is kept without the lead-and-panel geometry. The `home.deskAnalysisTitle`
key, read by nothing afterwards, is deleted.

### 2. One pager appearance, two mechanisms

`/news` keeps paging by navigation: a news page is an indexable URL. The learn
shelves (every track band of courses, the quiz index, every video shelf) page
**in client state**, six at a time, for D26's reason — reading `searchParams`
would make a cached public route dynamic (architecture.md #6), and every row is
already in the payload.

The two share everything a reader can see: `@repo/ui/lib/pagination` owns the
page window and `DEFAULT_PAGE_SIZE = 6`; `ClientPagination` renders the same
`Pagination` frame and the same Button variants and sizes `PaginationLink`
resolves to; both read `common.pagination.*`. The `news.previousPage`,
`news.nextPage` and `news.paginationLabel` keys move there (all four catalogs).
`usePagedList` resets to page one when the filter that produced the list
changes, and clamps a page the list shrank out from under.

### 3. The trust strip is off on the home page

Seeded `enabled: false`, plus `20260916200000_disable_trust_strip_changes37`
for an existing database — the `feature_highlights` migration's mechanism.
ADR-103 is untouched: the component, its dataset and the empty-renders-nothing
rule remain, and re-enabling is one word.

### 4. `Carousel` may autoplay, opt-in, with every objection as a guard

The component said "no autoplay, deliberately", for three reasons: WCAG 2.2.2
needs a pause control, it fights reduced motion, and it moves content from
under the pointer. `autoplay` is now an opt-in prop and answers each: it renders
a **visible pause button** (named for the state it changes to), never starts
under `prefers-reduced-motion`, and holds still while hovered, while focus is
inside, while less than half on screen, and while the tab is hidden. It scrolls
the TRACK with `scrollBy`, never `scrollIntoView`, because a timer that scrolls
the page is a page that moves on its own. Without an `IntersectionObserver` it
fails CLOSED. Autoplay makes the carousel loop. `hoverArrows` adds previous/next
over the track's edges, shown on hover or focus, absent (not disabled) where
they cannot move. Only the testimonial rail in `in_practice` uses either.

### 5. The topics band shows a photograph, and the tiles lose their top rule

`NEWS_MEDIA.topics` points at the owner's photography, and the band follows
ADR-117's photographic masthead: an `inverted` band, the picture at full
strength, a `--secondary` scrim under the words. The heading is hand-written in
`--secondary-foreground` because `SectionHeading` is coloured for
`--background` (the `connect` band's precedent). `CategoryCards` drops the
positional accent rule changes-32 kept as "identity": the count chip's wash
still colours each tile, and the current tile keeps its 2px ring and "You are
here".

### 6. The market provider form is reachable from Settings too

`/admin/settings/market` renders the market provider form inside
`SettingsScreen`, loaded by the same `loadProviderFormProps` as
`/admin/market/provider`. It is gated on `market.providers.manage` — the form's
own key, not `settings.view` — so moving where the form is drawn does not widen
who can repoint the key (ADR-087 #5). The AI provider already has both places
(ADR-120). The settings hub now also describes AI, Email templates and Email log.
A non-group destination's description key is its path, camel-cased
(`email/templates` → `emailTemplates`), because the last segment alone
(`templates`, `log`) was too generic to hold one.

### 7. "Visit site" no longer scrolls away

It was the last child of the scrolling sidebar nav with `mt-auto`, so it sat at
the bottom only while every group fit. It now sits below the scroll container.

## Consequences

- The desk band is roughly half its former height and has no 21:9 lead. A
  flagged article still gets its Featured treatment inside the row.
- A course band with more than six courses now hides the rest behind a pager.
  Search and difficulty still filter the whole band, not the page.
- The pager holds its page in memory only: a reload, or Back from a course,
  lands on page one. That is the cost of not reading `searchParams`.
- The hover arrows over a testimonial overlap the quote's first characters
  while shown. They only show while the pointer is over the rail, and that
  also pauses it.
- Two routes render one provider form. `loadProviderFormProps` is the only
  place its labels and due-time rule are written.

## Alternatives considered

- **`?page=N` on the learn routes.** Linkable, but it makes each route dynamic
  or multiplies static variants, and architecture.md #6 forbids the first.
- **Autoplay without a pause button, pausing on hover only.** Fails WCAG 2.2.2
  for a keyboard or touch user, who has no hover.
- **Keeping the lead story at 21:9 above a row of analysis cards.** Still two
  sizes, which is what the owner asked to lose, and the tallest band on the
  page.
- **Moving the market provider screen into Settings and removing it from
  Market data.** The owner asked for both places, and the Market data section
  links to it from its own overview.
