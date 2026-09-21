# SKILL — Module 12: Public site

> **Homepage admin UI paused (ADR-038, 2026-09-06).** `/admin/homepage`
> (the section order/enable/variant editor) is hidden pending the owner's
> move to module-by-module/static site design. The homepage still renders
> from the current `home.sections` value — read ADR-038 before resuming
> the admin screen.

plan.md Module 12. Everything lives under `app/(public)/[locale]/` (ADR-006).
This is the surface judged on Core Web Vitals — the bundle-boundary and
Lighthouse rules exist for it.

## Requirements

- Homepage assembled from admin-configured sections (registry: hero,
  featured courses, latest analysis, market ticker, CTA — order/visibility
  from `layout` settings).
- Learn area: **track → course → lesson** (ADR-065). Every learning URL
  carries its school: `/learn/[track]`, `/learn/[track]/[course]`,
  `/learn/[track]/[course]/[lesson]`, `/learn/[track]/quizzes`,
  `/learn/[track]/glossary`. `/learn` is the umbrella above both and is the
  ONLY learn page with no section bar. A course loaded under the wrong track
  404s — one canonical address per course, no second URL for it.
  The section bar is pinned at `top-(--header-offset)`, which
  `StickyHeaderShell` measures and republishes on every header resize; a
  literal offset is wrong as soon as the announcement bar is enabled.
  Glossary: A–Z, topics, per-locale slugs — `/glossary` and
  `/glossary/[term]` did NOT move under `/learn`, and the track glossary is a
  filtered VIEW onto the same terms (a term with `track: null` appears in
  every school's view). Static pages from the `Page` model.
- **Quiz index** (`/learn/[track]/quizzes`, design pass 2026-09-09): masthead
  - counted stat strip, then `QuizShelf`. Its card is
    `@repo/ui/components/quiz-card`, a sibling of `CourseCard` — the whole card
    is a stretched link resolving against `.sheen`'s `position: relative`, so
    every control in it must stay `relative z-10`. Artwork is
    `quizCoverUrl(slug, coverUrl)`: the editor's uploaded cover when there is
    one (`Quiz.coverAssetId`, ADR-132), otherwise four generated panels picked
    by hashing the slug, NOT keyed by track (a track-keyed panel would repeat
    down the whole grid). Category colour is
    `categoryTone()`, derived from the free-text string, because `Quiz.category`
    has no registry a table could enumerate. **The card's meter shows the pass
    mark as a TICK and never as a fill** — filling to the pass mark would tell
    every reader they were 70% done. The learner's best score fills it, from
    `GET /api/learn/quiz/results` (ADR-056 #1's island pattern behind ADR-058's
    `guardQuizRequest`): counters and ids only, so the page stays cached.
- SEO: metadata from settings + per-translation fields; `sitemap.ts` per
  locale from published content; `robots.ts`; canonical + hreflang pairs;
  JSON-LD for courses/articles.
- ISR with cache tags per the caching table; disabled features 404, never
  blank.
- Dark/light toggle is user-controlled and persists (`@repo/ui`'s own
  ThemeProvider + ThemeScript, ADR-064; User.themeMode
  for signed-in users) — ADR-008.
- Core Web Vitals budget: LCP < 2.5s on the lesson page, enforced by a
  Lighthouse CI budget file — **blocking** (it is also the admin-bundle-leak
  backstop under the single app).

## Required tests

E2E journeys (pick a school from the header → browse course → lesson, with
the section bar still on screen after scrolling; glossary search; locale switch
preserving route where translated / fallback notice where not; dark-mode
persists across reload); hreflang/sitemap snapshot; disabled-feature 404;
Lighthouse budgets blocking; full axe + RTL suites from Part C.

## Glossary design pass (ADR-069, 2026-09-09)

`/glossary` and `/glossary/[term]` got the treatment /news and /learn already
had. `GlossaryBrowser` is unchanged — the A–Z chips, the client-side search and
the empty-letter rule are all still D26's.

- **`/glossary`** — `GlossaryMasthead` (`PageHero` + `GlossaryBackdrop`,
  ADR-047 §3's **fifth** instance), a COUNTED stat strip (terms, letters,
  topics — absent, never three zeroes), and the **Term of the day + Topic of the
  day** pair. The topic card is the one `term-of-the-day.tsx` said it was
  deferring until topics were a real model; `getTopicOfTheDay` hashes
  `<date>:topic` rather than the date alone, so the two cards cannot correlate
  and feature a term inside its own featured topic.
- **`/glossary/[term]`** — breadcrumb inside the hero (`PageHero`'s own
  `breadcrumb` slot: a `<nav>` folded into `eyebrow` is invalid markup that
  browsers reparent out of the hero), topic and difficulty badges, the four
  prose sections, FAQ, related terms, and a closing "Search the Glossary" block
  carrying the A–Z rail and Popular terms. That block is a SERVER component
  with no search input — the reference has none either, and adding one would
  need a query param `GlossaryBrowser` is explicit about not reading.
- **`simpleExplanation` is RICH TEXT.** `loadPublishedGlossary` strips it with
  `htmlToText`; the detail loader keeps the markup. Rendering the raw column as
  a string put literal `<p>` tags on the A–Z and made the client-side search
  match tag names. The topic-detail loader strips it the same way.
- **Prose measure is `Container size="narrow"`.** A `max-w-*` utility on
  `Container` silently loses to `.container-page`'s own max-width at equal
  specificity — `container.tsx`'s header says so, and it is easy to hit.
- **Popular terms order by `viewCount DESC, term ASC`, and nothing increments
  `viewCount`** (ADR-069 §4). Every count is 0, so the rail is alphabetical,
  which is what the reference shows. A counter belongs with analytics, not a
  per-request write on a `"use cache"` page.
- The A–Z chips in the footer block are LINKS to `/glossary#glossary-<letter>`,
  not anchors: the letter headings only exist on the index.

## Videos — the fourth learn section, public side (changes-16, ADR-068)

Routes: `/learn/[track]/videos`, `.../videos/categories/[category]`,
`.../videos/[topic]`. Components in `learn/_components/video-*.tsx`, labels in
`learn/_lib/video-labels.ts`, artwork in `learn/_content/learn-media.ts`.

- **The category chips are LINKS, not client state** (D26). This is the one
  real difference from `QuizShelf`, which filters in `useState` because a quiz
  category has no page behind it. A video category IS a page with its own
  title and canonical, so the chips navigate and carry `aria-current="page"`
  rather than `aria-pressed`. The index therefore never has to hold every
  topic in one payload to narrow it later.
- **A category with no published topics IN THIS TRACK has no page.**
  `loadVideoCategories` only returns categories with rows here, so the view
  404s rather than rendering an empty shelf. The same category still renders
  under the other school with a different count — ADR-068 §1's accepted
  consequence, not a bug.
- **`VideoCard` is deliberately NOT a stretched link** (ADR-068 §7), the
  inverse of `QuizCard`. A play affordance over the thumbnail is a second
  target with a different destination, and one stretched link containing a
  button either hides the button from the pointer or stops being one link. So:
  title is an ordinary anchor, play control is its own link to `#watch`, and
  `video-card.test.tsx` asserts NO `after:inset-0` anywhere, two links,
  neither nested. The card's body is not clickable — that is the accepted cost.
- **A topic with no recording is not an error.** The contract allows a body
  instead of a video, so the player, the `#watch` anchor and the `VideoObject`
  graph are all conditional. The card shows a "Guide" badge, never "0 videos";
  the masthead omits the videos figure rather than showing a zero.
- **Both flags are checked on every route** (`courses` and `videos`), matching
  the quiz index: a video index inside a switched-off learning area is a page
  with no way back.
- **The player is a switch, and both branches cost zero media bytes until
  pressed.** An upload is a same-origin `<video>` behind its own facade; an
  embed is `VideoFacade`, whose iframe is injected on click so an unplayed
  page makes no third-party request. The component never parses a URL —
  `@repo/core` already resolved each row and dropped anything unsafe.
- **`videoCoverUrl(coverUrl, slug)` prefers the editor's cover**, then hashes
  the slug across four panels. Unlike `courseCoverUrl` it never returns null
  (the fallback supply is code); `quizCoverUrl` has the same shape since
  ADR-132 gave a quiz the column.
- **`LEARN_TRACK_SURFACES` declares the surfaces AND their order** —
  `index, videos, quizzes, glossary`. The section bar, the mega-menu panel, the
  seeded nav rows and both drift guards read it. Do not type a surface name
  into any of them; a fifth surface must fail in one place.
- The footer has **no** Videos row, matching Quizzes: the footer's Learn column
  is track-agnostic and these surfaces are per-track.
- Category views are **not** in the sitemap — filtered views over topics whose
  own pages are already listed.

## Newsletter signup (changes-21 F7, ADR-080)

- **The form accepts submissions now.** It shipped hard-`disabled` from
  changes-03 under "Newsletter signup is coming soon", with a
  `TODO(newsletter)` naming the two conditions — a `NewsletterSubscriber`
  model and an ADR. Both exist, so the placeholder is GONE, and
  `apps/web/app/newsletter-signup.test.ts` fails on a `disabled` control, an
  `unavailableLabel` prop or a lingering TODO. That guard is there for the
  revert, not for a deliberate re-add.
- **Two switches per placement, with different jobs** (ADR-080 #5): the
  `newsletter` **flag** says signup exists, `newsletter.placements.<source>`
  says it is drawn here. The four render sites are the footer, the homepage
  band, `/news` and `/analysis`, and each passes its own `source` so admin can
  filter by where an address came from. `footer.newsletterEnabled` is deleted.
- **It submits without JavaScript.** `useActionState` on a real
  `<form action={…}>`, with the locale, the source and the honeypot as hidden
  INPUTS rather than closure values — that is what keeps the pre-hydration
  state a working form. The confirm and unsubscribe screens are the opposite
  and deliberately so: their token lives only in the URL, read at press time,
  so they do need JavaScript and say so.
- **Four visitor-visible states, and no fifth.** sent · invalid · limited ·
  failed. There is deliberately no "you are already subscribed" — that turns
  the form into a membership oracle for anybody's address.
- **`/newsletter/confirm` and `/newsletter/unsubscribe` are `noindex` static
  shells whose island POSTs** (ADR-080 #4). A mail scanner prefetching either
  URL must not confirm or unsubscribe anyone, which is also why
  `/api/newsletter/unsubscribe` exports no GET — a GET there answers 405.
- Both are reserved in `RESERVED_PATHS` under the parent `newsletter` segment,
  per the ADR-047 same-PR rule.

## About is gone; Support is one page (changes-33, ADR-109)

`/about` and its four children are **deleted**, and so is `/markets`. Read
ADR-109 before re-adding anything under either segment.

- **`/support`** is what survived: one coded page at the top level, no
  layout, no section bar — a strip of one tab is chrome that tells the reader
  nothing (ADR-076 §1 applied to a section that is now a single page).
  **Rebuilt 2026-09-16 — read ADR-113 before editing it.**
- **`about` and `markets` are NOT in `RESERVED_PATHS` any more, and that is
  load-bearing.** `resolvePublicPage` returns not-found for a reserved first
  segment BEFORE it consults the redirect table, so the six seeded redirects
  (`/about/support` → `/support` and five nearest-true-page fallbacks) only
  work because both segments are un-reserved. Re-reserving either silently
  breaks them.
- The explore carousel is SIX cards. `/support` did not take the About card's
  place: that band is "explore the platform", and a help page is not a
  destination a reader goes and uses.
- `public-chrome.test.ts`'s StatCard/StatBand allow-list is down to ONE entry.
  A second needs its own ADR — the friction is the point (ADR-076).

## `/support` and the second anonymous mutation (ADR-113)

ADR-109 shipped this page with `SUPPORT_CHANNELS` empty and a `TODO(owner)`.
ADR-047 §2 rule 1 then did what it says — an empty collection renders nothing
— so the "how to reach us" band never drew and the page a reader arrives at
with a question offered no way to ask it. **A data gate on a collection nobody
is going to fill is not a gate; it is an outage with good manners.** The rule
stands; the data is now filled and `support-page.test.ts` fails if it empties.

- **Five bands, the reference's order:** hero → How Can We Help? (three
  channels) → FAQ (seven) → Still Need Help? (the form) → Coming Soon.
  `help`, `selfServe`, `cta` and `hero-actions.tsx` are deleted.
- **Facts vs catalog is the split to get right here.** `support-facts.ts`
  holds the addresses, the availability lines and the **seven FAQ answers** —
  a $10 minimum and 1:100 leverage are claims about a brokerage, and a
  translator should not be the one deciding what a withdrawal window says
  (ADR-047 §2 rule 2, the reasoning `SupportChannel.availability` already
  carried). `en.json` holds everything the band says about ITSELF: headings,
  card titles, button labels, form labels, placeholders, result messages.
- **`SUPPORT_CONTACT.email` is both the Email Support card and the form's
  inbox.** One source of truth, so the page cannot advertise one address and
  mail another. Empty ⇒ both absent.
- **The contact form is the repo's SECOND anonymous mutation.** Five parts
  replace `requirePermission()` — a recorded inbox, a honeypot (`company`,
  deliberately not signup's `website`), the schema, a per-IP limit, a
  per-address limit — and `_actions/support.ts` names all five at the top.
  It stores nothing and `to` never comes from the request, which is the one
  property to preserve if that file is edited. **A third needs its own ADR**,
  and the guard is a test, not a sentence: `support-page.test.ts` enumerates
  `_actions/*.ts` holding a honeypot constant and fails on a third.
- **"Coming Soon" links what exists** — Help Center → `/glossary`, Video
  Tutorials → `/learn/forex/videos`, Phone Support → `tel:`, Community Forum
  static — each flag-checked against an anonymous subject, and a flagged-off
  section renders static rather than absent (the heading says the word).

## Legal documents and the reader's sitemap (changes-33, ADR-110)

- **`/legal/terms|privacy|agreement`** is the public address, and it is OURS:
  it survives an admin swapping the file, it is shareable, and it publishes no
  storage key. The setting holds a site-relative PATH and the route branches
  on the `/uploads/` prefix — a committed file under `public/legal/` is
  redirected to, a stored upload is streamed.
- **It is the ONE route that serves an uploaded file INLINE**, PDF only,
  decided by the MIME **recorded at upload**. ADR-034 §1's attachment default
  is unchanged everywhere else and `legal-documents.test.ts` asserts that
  too — `/uploads/[...key]` still sends every DOCUMENT as an attachment.
- A document with no file is **ABSENT** from the footer, not a link to a 404.
- **`/sitemap` is a page for a PERSON**, not a link to `sitemap.xml`. Built
  from `footer.menuColumns` + `buildMenu`, so a flag-off section prunes and an
  empty column disappears. Never hand-maintain a second list here.
- Adding a fourth document: an entry in `LEGAL_DOCUMENT_KEYS`, a setting key,
  a catalog string. Nothing hardcodes three.

## Masthead artwork is the owner's photography (changes-33)

`scripts/import-owner-art.mjs` converts the supplied files to committed WebP.
Sources live under `storage/uploads/**`, which is git-ignored — which is
exactly why the OUTPUT is committed and why the script is not part of any
build. Placement is still one line in an area's `_content/*-media.ts`
(ADR-047 §3).

Two rules learned doing it:

- **A masthead and a card cover cannot be the same file.**
  `LEARN_TRACK_BANNER` is a second registry beside `LEARN_TRACK_MEDIA` for
  exactly this: 3:1 full-bleed under a scrim versus 4:3 looked at on a shelf.
- **`unoptimized` follows the FILE** (`src.endsWith(".svg")`), never the
  component. Unconditional, it ships a 1920px WebP to a phone; removed, an SVG
  slot needs `dangerouslyAllowSVG` in next.config, which relaxes SVG handling
  for every image the app serves.
- The calendar's hero is a media COLUMN, not a backdrop: 4:3, no
  `object-cover`, so a 3:1 banner there is STRETCHED rather than cropped. It
  has its own 4:3 output.

## The home page's four presentation bands (changes-35, ADR-116)

Below the platform band the page was seven bands of ONE shape — heading, lead,
grid of cards. The five bands now each have a different composition, which is
what gives the page a rhythm a reader can navigate before reading the words.

- **`explore_platform` is density-only.** The composition is the owner's
  ("perfect"); the height was not. `spacing="sm"`, 4 slides
  (`--width-slide-4`), "View all" in the heading row → `/sitemap` (the one page
  that lists every section — `/learn` would promote one card over seven),
  arrows centred, no dot rail. **Guarded**: `home-presentation.test.ts` fails on
  `spacing="lg"` or `--width-slide-3` coming back.
- **`latest_news` variant `desk` reads BOTH kinds.** ADR-116 §2 narrows this
  file's own old comment: news and analysis must stay DISTINGUISHABLE, not be
  separate bands. Lead story in one column, hairline-cut 2×2 of analysis
  beside it, separate CTAs. `latest_analysis` is seeded off on the home page
  only and keeps every variant.
- **`glossary_spotlight` variant `feature` is the first home caller of
  `getTermOfTheDay`.** Built since changes-11 (D29) and never used off
  `/glossary`. Its two labels come from the `glossary` namespace, not `home` —
  they already existed there.
- **`in_practice` is the first band fed by THREE datasets** and therefore the
  first that degrades per COLUMN, not per band (ADR-116 §3): three columns, two,
  one, or absent. Never a column heading over an empty column. The video is
  `lg:self-center` — that is the whole of "centralized video".
- **`faq` variant `columns`** deals items COLUMN-MAJOR, so reading down one
  column then the next follows q1..q6. "All questions" → `/support`, which
  carries the seven-answer `SUPPORT_FAQ`. Claims about a brokerage belong there
  (ADR-113), never in `home.faq*`.
- **One video on the page.** `connect` dropped its panel; the `next/dynamic`
  boundary moved to `in_practice` with the tile.
- **`connect` carries the subscribe ask too** (owner, 2026-09-16): follow on
  the inline start, the newsletter panel on the end, because taking the video
  out left that half empty and the standalone newsletter band sat directly
  underneath making the same ask in a different colour. **Neither newsletter
  switch moved** — the FLAG and `newsletter.placements.home` still decide, and
  the form still submits `source: "home"`. The seeded `newsletter` SECTION row
  (does the standalone band draw) is the third, separate thing and is now off.
- **A multi-column band's columns END ON ONE LINE.** `items-start` is right for
  a LIST beside a lead (`latest_news` `split`) and wrong for columns meant to
  read as one band — it is what made the glossary button hang 90px low and
  `in_practice` come out 300/237/420px. Each column stretches and decides what
  to do with the surplus: text grows, a last element takes `mt-auto`, and the
  VIDEO centres, because it is aspect-locked and cannot grow. `justify-center`
  on a full-height column, never `self-center` on the grid item — that shrinks
  the column back to the tile. `Carousel`'s track carries `grow` (basis auto,
  so it is inert without a given height) to put controls on the bottom edge.
  Guarded: `home-presentation.test.ts` fails on `items-start` in either grid.
- **`risk_disclaimer` is off here.** The footer's legal band already prints the
  same text from `legal.riskDisclaimer` (ADR-110).

Two things the browser found that no test would have: `items-start` is right
for a list beside a lead and wrong for a CARD beside one (the panel stretches),
and a new FAQ question duplicated an existing one almost word for word —
nothing compares two catalog VALUES for meaning.

## `/support`'s last band names four places that exist (changes-36, ADR-118)

"Coming Soon" → **"More ways to get help"**, and Community Forum →
**Courses** (`ROUTE_PATHS.learn`, flagged on `courses`).

ADR-113 §5's heading was true of exactly one of four cards; the other three
linked, and the lead under it already said "Explore more ways to get the
information and help you need". What a forum stands in for here is somewhere
to go and learn the thing rather than somewhere to ask about it, which is what
`/learn` already is.

The catalog subtree and the registry are renamed with it
(`support.comingSoon` → `support.moreHelp`, `COMING_SOON` → `MORE_HELP`). The
`public.comingSoon*` keys belong to the `ComingSoon` COMPONENT and are
untouched — that is still the right thing for a section that genuinely does
not exist yet.

Every entry has a destination now, so ADR-113's `href: null` branch fires for
the flag-off case alone. `support-page.test.ts` fails on an entry added
without one.

**Every public masthead lost its brand fill** (ADR-117) — see the `@repo/ui`
skill. The nine that carry the owner's photography are `--secondary` bands
showing the photograph at full strength under a scrim; the artless ones
(`/sitemap`, `/economic-calendar`, the eight tool pages) still open on
`brand`.
