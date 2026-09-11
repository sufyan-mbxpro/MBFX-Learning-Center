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
    `quizCoverUrl(slug)`: four generated panels, picked by hashing the slug, NOT
    keyed by track (a quiz has no cover column to fall back from, so a
    track-keyed panel would repeat down the whole grid). Category colour is
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
  (the fallback supply is code); unlike `quizCoverUrl` it takes a cover first
  (a topic HAS the column).
- **`LEARN_TRACK_SURFACES` declares the surfaces AND their order** —
  `index, videos, quizzes, glossary`. The section bar, the mega-menu panel, the
  seeded nav rows and both drift guards read it. Do not type a surface name
  into any of them; a fifth surface must fail in one place.
- The footer has **no** Videos row, matching Quizzes: the footer's Learn column
  is track-agnostic and these surfaces are per-track.
- Category views are **not** in the sitemap — filtered views over topics whose
  own pages are already listed.
