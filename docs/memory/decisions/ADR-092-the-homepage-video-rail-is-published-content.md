# ADR-092 — The homepage's video rail is published content, not a code registry

- **Status:** Accepted
- **Date:** 2026-09-14
- **Module:** 12 (public site), 11 (content system)
- **Supersedes:** nothing. **Amends:** the composition half of ADR-047 §3 as it
  applied to `_content/home-videos.ts`, and narrows ADR-042's "composition is
  code" to what it always meant.

## Context

The homepage opens on a full-bleed video rail. Since changes-03 it has rendered
`apps/web/app/(public)/[locale]/_content/home-videos.ts`: six coded entries,
each naming a catalog key and a generated poster, and each with `url: null`.

That null was deliberate and the file argued for it at length. A video URL is a
factual claim — it asserts "this specific recording exists and teaches this" —
and inventing eleven-character YouTube ids would fabricate exactly that. So the
rail shipped as six finished poster tiles carrying a "Recording soon" badge and
no play affordance, with a `TODO(owner)` inviting a real URL.

The reasoning was right. The conclusion stopped being right the day
**changes-16 shipped `VideoTopic`** (ADR-068): a real entity with translations,
categories, covers, links, a seven-state publishing machine, an admin editor at
`/admin/learn/videos`, public routes under `/learn/[track]/videos`, and eight
seeded rows two of which carry a playable source.

So the live homepage opened on six placeholders standing next to a populated
database. The brief (changes-28, image 49) caught it as a design complaint —
"add a seeder for these, with real data and media" — but the defect is not the
placeholder. The placeholder was honest. The defect is that the rail was
reading the wrong source.

Two further consequences had gone unnoticed:

- The rail's heading was the literal **"Start with the six that matter"**, a
  count baked into a catalog string that nothing kept true.
- `/learn`'s masthead decided whether to offer its "watch" jump link from
  `LEARNING_VIDEOS.length > 0` — the length of a hardcoded array, which is
  `true` on a database with no videos in it at all.

## Decision

**1. The rail reads the database.** `@repo/core` gains
`loadFeaturedVideoTopics(locale, limit)` and its `getFeaturedVideoTopics`
cache wrapper (`cacheTag("content")`), and `VideoShowcase` renders those rows.
`_content/home-videos.ts` is deleted, along with the 18
`home.video{Basics,Candlesticks,Risk,Levels,Plan,Psychology}{Title,Body,Level}`
catalog keys it addressed — a topic's title and summary live in
`video_topic_translations`, which is the translation mechanism ADR-043 #1 names
for content.

**2. Composition stays code; the videos in it are data.** ADR-042 is unchanged
and this is what it has always said: which band, where on the page, in what
shape, how many items — code. What the band LISTS — data. Every other
homepage band that lists things (`latest_news`, `glossary_spotlight`,
`popular_tools`) already worked this way; the video rail was the one that did
not, and only because it predated the entity it should have been reading.

**3. The reader is cross-track, and ordered by recency.**
`loadVideoTopics(locale, track)` takes a track because a shelf belongs to one
school. A homepage showing forex videos only would be advertising half the
site, so this reader spans both. It orders by `publishedAt desc` and **not** by
`sortOrder`: `sortOrder` is a per-track editorial ordering, and interleaving
two of them by it produces an order neither editor chose. Recency is the one
ordering that means the same thing in both schools.

**4. The source is resolved in the service, and the tile receives the result.**
`resolveVideoSource` — the same function the topic page uses — turns a stored
row into a `VideoSourceView` or into null. The rail takes the first video it
can make SAFE, not the first row: one unrecognised URL must not mute a topic
that has a good recording behind it. A raw URL never reaches the client and
never reaches an `src` (security.md #9), and `home-composition.test.ts` fails
any section that reaches for `parseVideoUrl` itself.

**5. "Recording soon" is gone; a topic without a video is a written guide.**
This is the honest third state now, and it was not available before: under the
code registry a null URL meant a recording that did not exist, so the tile
promised one later. A `VideoTopic` with no video is a page that exists and can
be read today — `videoTopicInputSchema`'s capability rule allows exactly that
shape, and most of the seeded topics take it. So the tile becomes an ordinary
link to the topic, badged "Read the guide".

**6. A playable tile has TWO targets, not one.** Once every tile stands for a
real page, playing and navigating are different destinations — the distinction
ADR-068 §7 already draws on the videos shelf. The tile is an `<article>`
holding a full-bleed play `<button>` and a title `<a>` as siblings, never
nested: an anchor inside a button is invalid HTML, and an overlay that swallows
the title is the exact bug §7 was written about.

**7. Cover art falls back to the committed panels, and seeds no MediaAsset.**
`videoTopicCoverUrl(slug)` hashes a slug into the six generated 16:9 panels
under `public/home/video/` — the fourth use of the ADR-047 §3 pattern, after
`courseCoverUrl`, `quizCoverUrl` and the learn track panels. A topic with a
real `coverAssetId` never reaches it.

Seeding `MediaAsset` rows instead was considered and rejected: an asset row
means BYTES, and a `MediaAsset` whose file does not exist 404s in every picker
and every `next/image` request. That is the same failure the videos seed
already refuses for uploaded video sources ("no uploaded-source rows are
seeded: an `assetId` with no bytes behind it would 404 in the player"). A
public path needs neither a row nor a byte.

**8. The flag moves from `courses` to `videos`.** The rail was gated on
`courses` because, as a registry of lessons, that was the closest switch. It
reads video topics now, and `videos` is the flag that governs those.

## Consequences

- A published video topic reaches the homepage with no deploy. That is the
  point, and it is also the new risk: the rail's contents are now editorial,
  so an editor who publishes six crypto topics gets a homepage of them.
  Acceptable — it is the same risk `latest_news` has always carried, and the
  same admin owns both.
- The rail renders **nothing** when no topic is published, where before it
  always rendered six tiles. This is the rule every other listing band already
  follows, and a heading over an empty rail is worse than no band.
- `/learn`'s masthead asks the database the same question with the same
  arguments, so the two share one `"use cache"` entry and the jump link can no
  longer offer itself over an empty anchor.
- The generated posters become a POOL rather than a per-lesson pairing. They
  were chosen to say what each lesson was about; they now have to be abstract
  enough that any topic can hash to any of them. They already were — all six
  are market shapes — but `generate-home-art.mjs` now says so.
- The rail's copy stops claiming a count.

## Alternatives rejected

**Paste real YouTube ids into the registry.** The brief's literal ask. It fixes
one screenshot and leaves the architecture wrong: the ids would be code, an
editor could not change them, they would not translate, and the rail would
still not know about the topics an editor publishes.

**Keep the registry and fall back to topics when it is empty.** Two sources for
one rail, and the failure mode is invisible — the fallback only runs when
someone empties a file nobody remembers exists.

**Add an `isFeatured` column to `VideoTopic`.** A real editorial pick is a
column plus an admin control plus a rule for when nobody has picked.
`featured-lessons.tsx` records the same reasoning and reaches the same answer:
recency is a defensible rule that needs no upkeep, and a curated rail is a
feature to decide deliberately rather than to discover.
