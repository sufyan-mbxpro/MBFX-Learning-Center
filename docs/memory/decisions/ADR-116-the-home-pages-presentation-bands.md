# ADR-116: The home page's four presentation bands

**Status:** Accepted
**Date:** 2026-09-16
**Module:** 12 (public site — the home page), 07 (`@repo/ui`), 05
(`@repo/contracts`), 01 (`@repo/db` seed)
**Plan:** `docs/changes/changes-35-home-presentation.md`
**Reference:** `docs/changes/image-64.png`
**Supersedes:** — (narrows `latest-news.tsx`'s stated placement rule; see §2)
**Superseded by:** ADR-121 §1, for the `desk` variant's shape only (§2's rule stands)

## Context

> make the home page data presentation like that after the The platform
> section… the first The platform section is perfect, just need to make it the
> smart way i mean reduce the space & size.. then there should be present the 2
> columns data same way in the sample images. then 3 column data
> presentations.. then also 3 column data presentations with centralized video
> option.. you can make smart carousels where needed.. you need to set the
> news, analysis, glossary & tools, questions, presentations in that format..
> you can also add new content if you needed to adjust the presentations
>
> — owner, changes-34, 2026-09-16

Below the platform band the home page is **seven bands of one shape**: a
heading, a lead, a grid of cards, sometimes a button. `latest_news`,
`latest_analysis`, `glossary_spotlight`, `popular_tools`, `testimonials` and
`connect` differ in what they list, not in how they present it. A reader
scrolling past them gets no structural signal that the subject changed, which
is why the page reads long and flat however good each band is on its own.

The reference's answer is not better cards. It is **five different
compositions** — a card row, a 2-column, two 3-columns of different weights, a
centred accordion — so the page has a rhythm the eye can navigate before the
words are read.

Two facts from the inventory shaped what follows:

- **`getTermOfTheDay` has been built since changes-11 and the home page has
  never called it.** The reference's third-column feature slot has been waiting
  for it.
- **The catalogs hold four FAQ pairs and the reference shows four in two
  columns.** Two-by-two is a thin block, which is where the owner's "you can
  also add new content" applies.

## Decision

### 1. Four compositions, one per band, and no two adjacent bands alike

| Band | Key                                    | Composition                                                              |
| ---- | -------------------------------------- | ------------------------------------------------------------------------ |
| A    | `explore_platform` (density only)      | 4-up carousel, heading and "View all" on one row, arrows centred beneath |
| B    | `latest_news` variant `desk`           | 2 columns — a lead story, and a hairline-cut 2×2 of analysis beside it   |
| C    | `glossary_spotlight` variant `feature` | 3 columns — heading + CTA · a term carousel · the term of the day        |
| D    | **`in_practice`** (new key)            | 3 columns, middle vertically centred — a quote · a video · tools         |
| E    | `faq` variant `columns`                | Centred heading, 2-column accordion, "All questions" → `/support`        |

Composition is code, per ADR-042. None of this is admin-configurable and the
homepage composer stays paused (ADR-038).

### 2. News and analysis share a band, and that narrows a rule this repo wrote

`latest-news.tsx` says today:

> Splitting them is what lets the homepage show "what happened" and "what we
> make of it" as two distinct promises rather than one undifferentiated feed —
> which is the whole reason `ArticleKind` exists as an enum instead of a tag.

**The argument is right and the conclusion was too strong.** What it actually
requires is that the two be _distinguishable_, and two identical 3-up grids
400px apart is the weakest available way to do that — a reader sees one feed
interrupted by a heading. Band B puts them in **different columns, at different
sizes, with different treatments and separate calls to action**: one lead story
with a cover, and four dated headlines in a panel labelled Analysis. That is a
sharper distinction, not a lost one.

So the rule is narrowed rather than dropped: **news and analysis must remain
visibly distinct wherever both appear. They need not be separate bands.**
`ArticleKind` is untouched; `/news` and `/analysis` are untouched;
`latest_analysis` keeps its component and every variant and is seeded off on
the home page only.

### 3. A home band may compose several datasets, and it then degrades per dataset

`in_practice` is the first home band whose content comes from three sources
(static testimonials, a published video topic, enabled tools). Nothing forbade
it; nothing endorsed it either. The rule this establishes:

**A band may compose several datasets when the composition is the point. It
must then degrade PER DATASET — three columns, two, one, or the band is absent
— and must never render a column heading over an empty column.**

This is ADR-103 §3 ("an empty dataset renders nothing") applied one level down,
from the band to the column. The consequence worth stating: a band like this
has four rendered states rather than two, and all four are tested (§7).

### 4. Density is a decision, not a detail

Band A's composition is unchanged at the owner's word ("the first The platform
section is perfect"). What changes is density: **4 slides across instead of 3,
`spacing="sm"` instead of `lg`, the "View all" button promoted into the heading
row, `p-5` cards with a `size-10` icon badge.** Roughly 640px → 420px at
1440px.

Recorded here rather than left in the markup because "reduce the size" was the
ask, and a later well-meant edit restoring `spacing="lg"` should fail a test
rather than be noticed three months on.

### 5. One video on the page, and `connect` gives it up

`connect` renders a social row **and** a featured video panel. Band D's middle
column is a video. A page showing two different "featured" videos is the page
arguing with itself, so **`connect` drops its video panel** and keeps the
social row and CTA as a single-row band. Its `getFeaturedVideoTopics(locale, 1)`
call goes away and band D makes the identical call, so the shared cache entry
is exactly as it is today.

### 6. Questions before the ask

The page order ends `… in_practice → faq → newsletter → quotes`. FAQ moves
above the newsletter band: answer the objection, then ask for the email
address. The reference ends on its FAQ for the same reason.

### 7. Three bands are seeded off, and nothing is deleted

`latest_analysis`, `popular_tools` and `testimonials` keep their components,
their variants, their catalog keys and their registry entries. Re-enabling any
of them is a one-word seed edit, and band D degrades to two columns by design
if `testimonials` comes back as its own band.

**The cost is stated rather than hidden:** testimonials go from three visible at
once to one at a time in a carousel, and three quotes are more persuasive than
one. The trade is that three quote cards in a row would be the fourth 3-up grid
on a page whose entire purpose here is to stop repeating a shape.

## Consequences

**Good**

- Five subjects the owner named (news, analysis, glossary, tools, questions)
  each land in a composition unlike the one beside it.
- The page gets materially shorter — one band absorbs three, and band A loses a
  third of its height — without dropping a destination or a link.
- `getTermOfTheDay` finally renders somewhere a reader will see it.
- No new model, column, migration, permission, admin screen or dependency.

**Bad, and accepted**

- Analysis loses its cover images on the home page.
- Testimonials lose simultaneity (§7).
- Tools lose their taglines on the home page; `/tools` carries them in full.
- `in_practice` has four rendered states, which is three more than a grid band
  has. Mitigated by making all four a test rather than a discovery.
- **Band D's middle column needs a published video topic with a playable
  source.** Two exist in the seed corpus. An install with none gets a
  two-column band — correct behaviour, but it should not be a surprise.

**Neutral**

- `Carousel` gains `controls` and `controlsAlign`. Both default to today's
  behaviour, so no existing call site changes.
- `ArticleCards` gains `ratio` and `sizes`. Same — its `featuredFirst` branch
  hardcodes `21 / 9` and `100vw`, right for a full-bleed lead and wrong for a
  60%-wide column.

## Alternatives considered

**Keep seven bands and restyle them.** The complaint is not that the cards look
wrong; it is that seven bands of one shape read as one long band. Restyling
cannot fix a rhythm problem.

**Make the compositions admin-configurable.** ADR-042 settled this: site design
is code, only content data is dynamic. A composition picker is the Website
Builder in miniature.

**Give each subject its own reference band and accept the length.** Five
subjects × the reference's band heights is a longer page than the one the owner
asked to shorten.

**Put analysis in band C's feature slot instead of band B's panel.** Band C's
feature slot is where the term of the day goes, and a glossary band whose
feature card is an analysis article is two subjects with no relationship.
