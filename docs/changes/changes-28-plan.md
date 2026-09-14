# changes-28 — the public site's homepage, professionally

Executable plan for the brief in `changes-28-public-site-ui.md` (six items,
six screenshots). Written as a PR checklist: every PR names its files, its
decision, and the test that fails without it.

The brief is a set of reference screenshots, not a specification. Two rules
from the existing record decide every ambiguity in it:

- **ADR-042** — site design is code; only content DATA is admin-managed. So a
  new band is a coded section with a seeded on/off row, never a composer.
- **ADR-047 §3** — a surface renders complete without a factual claim it
  cannot back. So nothing here invents a video id, a follower count, or a
  livestream that does not exist.

## What the brief asks, and what it gets

| #   | Brief                                                                                                    | Delivered as                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | Quotations at the bottom (images 48, 53)                                                                 | A `quotes` homepage band — PR 3                                                                          |
| 2   | "Add a seeder for these, with real data and media" (image 49)                                            | The video rail stops being a code registry of six null URLs and reads published `VideoTopic` rows — PR 1 |
| 3   | Glossary and tools are two sections; glossary as small cards; tools richer, with tinted icons (image 50) | PR 2                                                                                                     |
| 4   | A "follow us" / connect band (image 51)                                                                  | A `connect` homepage band, from real `SocialLink` rows — PR 4                                            |
| 5   | A signed-out CTA banner on every page (image 52)                                                         | One public session read + a visitor band above the footer — PR 5                                         |
| 6   | Sections arrive as you scroll, not all at once                                                           | Below-the-fold sections stream behind `<Suspense>` and reveal on entry — PR 6                            |

## PR 1 — the video rail is published content (ADR-092)

**The defect.** `_sections/video-showcase.tsx` renders
`_content/home-videos.ts`: six entries, every `url` null, so the live
homepage is a shelf of six "Recording soon" tiles (image 49). Meanwhile
`VideoTopic` — a real entity with translations, categories, covers, an admin
editor and eight seeded rows — renders the same kind of thing at
`/learn/[track]/videos`. The homepage was showing a placeholder next to a
populated database.

**The decision.** The rail reads the database. Composition stays code (which
band, where, what shape); the videos in it become data, like every other
homepage band that lists things.

- `packages/core/src/videos.ts` — new `loadFeaturedVideoTopics(locale, limit)`
  and its `getFeaturedVideoTopics` cache wrapper (`cacheTag("content")`).
  Cross-track, `publicVideoWhere()`, ordered `publishedAt desc`, resolving
  each topic's FIRST video through the existing `resolveVideoSource`, so a
  raw URL still never reaches an `src` (security.md #9).
- `apps/web/app/(public)/[locale]/_content/video-covers.ts` — `videoTopicCoverUrl(slug)`,
  a deterministic pick from the six committed panels under
  `public/home/video/`. Fourth use of the `courseCoverUrl`/`quizCoverUrl`
  pattern; a topic with a real cover asset uses it and never falls back.
- `_components/video-tile.tsx` — gains `href` (the topic page) and a
  `guideLabel` third state. "Recording soon" is deleted: a topic with no
  recording is a written guide that exists, not a promise.
- `_content/home-videos.ts` — DELETED, with the 18 `home.video*Title/Body/Level`
  catalog keys it addressed.
- **Test:** `video-rail.test.ts` (source guard) — the section imports no
  `_content/home-videos`; `videos.integration.test.ts` — the reader spans
  tracks, drops an unpublished topic, and drops a video whose URL no provider
  recognises.

## PR 2 — the glossary reads as cards, the tools as tools

Presentation only; no ADR.

- `_sections/glossary-spotlight.tsx` — a third variant `cards`, seeded as the
  default: term, its plain-language line (already on `GlossaryListEntry`),
  and its topic chip. `chips` and `grid` stay.
- `_sections/popular-tools.tsx` — the tinted icon tile grows a ring and a
  hover lift, the card gets `.card-hover .hover-lift .sheen`, and an arrow
  marks the whole card as a destination.
- **Test:** `home-sections.test.tsx` — the `cards` variant renders one link
  per term and the explanation is text, not markup.

## PR 3 — the homepage closes on a quote (ADR-093 part 1)

- `_content/home-quotes.ts` — the registry: a key and an attribution per
  quote. The TEXT is a catalog key (`home.quote<Key>`), because a quote on the
  public site is translated like everything else; the NAME is data, because
  names are not translated.
- `_sections/quotes.tsx` — `single` (the day's quote, deterministic from the
  date the way `term-of-the-day` already is — no cron, no column) and
  `carousel`.
- `quotes` joins `HOME_SECTION_VARIANTS`, `HOME_SECTION_BUILT_KEYS` and the
  seed at order 16, above the risk disclaimer.
- **Test:** `check:home-sections` (already blocking) + a unit test that the
  daily pick is stable within a day and covers every quote across a year.

## PR 4 — the connect band (ADR-093 part 2)

- `_sections/connect.tsx` — heading, a CONNECT row of `SocialGlyph` tiles from
  the active `SocialLink` rows, and a CTA to the videos shelf. Renders
  NOTHING when no social link is active: a "follow us" band with nothing to
  follow is worse than no band.
- The reference's embedded livestream is NOT copied — there is no livestream
  (changes-23 is unbuilt). The panel beside the copy is the newest published
  video topic, which is a real recording when one exists and absent when not.
- `connect` joins the registry, the variants and the seed at order 14.

## PR 5 — one session read, and the visitor band (ADR-094)

- `_components/public-session.tsx` — `PublicSessionProvider`, the ONE
  client-side `/api/auth/get-session` fetch on the public surface, and
  `usePublicSession()`. `AuthSlot` stops fetching and consumes it.
- `_components/visitor-cta.tsx` — the band, rendered above the footer in
  `[locale]/layout.tsx`, on every public page. Absent while the session is
  loading (so it never flashes at a signed-in learner), absent for a learner,
  absent for STAFF — the same rule `AuthSlot` already applies.
- **Test:** `public-session.test.tsx` — one fetch for two consumers; the band
  is absent in `loading` and `learner` states and present in `anonymous`.

## PR 6 — the page arrives as you scroll (ADR-095)

- `[locale]/page.tsx` — every section below the first two renders inside its
  own `<Suspense>` with a real skeleton, so the page streams band by band
  instead of blocking on the slowest query in the list.
- `_sections/section-skeleton.tsx` — the fallback, shaped like the band it
  stands in for.
- Every band that lists things is wrapped in `Reveal`; the ones that were
  missing it get it.
- **Test:** `home-streaming.test.ts` (source guard) — no enabled section below
  the fold renders outside a `<Suspense>` boundary.

## PR 7 — the gate

`pnpm lint`, `pnpm typecheck`, per-package `pnpm test`, `pnpm check:*`,
`pnpm governance:check`, and a DEVLOG entry. E2E stays owed to Module 14.
