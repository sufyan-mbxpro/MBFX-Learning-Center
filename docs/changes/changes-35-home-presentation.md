# changes-35 — The home page's presentation bands

**Module:** 12 (public site — the home page), 07 (`@repo/ui` — two primitives,
one token), 01 (`@repo/db` — the seeded section list), 05 (`@repo/contracts` —
one new key, three new variants)
**Date opened:** 2026-09-16
**Reference:** `docs/changes/image-64.png`
**Owner ask (changes-34):** "make the home page data presentation like that
after the The platform section… the first The platform section is perfect, just
need to make it the smart way — reduce the space & size… then 2 column data…
then 3 column data… then 3 column with centralized video… you can make smart
carousels where needed… set news, analysis, glossary & tools, questions in that
format… you can also add new content if you need to adjust the presentations."
**ADR owed before code:** ADR-116 — the home page's four presentation bands
(§9). Two of its decisions contradict statements currently written into the
code, so the ADR is not paperwork; see §7.

---

## 1. What this is

The home page below the platform band is, today, **seven bands of the same
shape**: a heading, a lead, a grid of cards, sometimes a button. `latest_news`,
`latest_analysis`, `glossary_spotlight`, `popular_tools`, `testimonials` and
`connect` differ in what they list, not in how they present it, and a reader
scrolling past them has no structural signal that the subject changed. The
reference solves that by giving each band **a different composition** — one
carousel row, one 2-column, two 3-columns of different weights, one centred
accordion — so the page has a rhythm the eye can navigate before the words are
read.

This change adopts those compositions and pours our existing data into them. It
is a **presentation** change: no new model, no new query that is not already
written, no new permission, no new admin surface.

**What it is not:**

- Not a pixel copy. The reference sells houses; we teach. Where its slot carries
  a price and three bedroom icons, ours carries a publish date and a kind badge,
  and where its composition would need content we do not have, the band
  degrades rather than inventing it (§6).
- Not a second design language. Every surface, radius, tone and motion preset
  already exists — ADR-101's warm editorial system, ADR-107's one radius scale,
  ADR-111's replaying reveals. This adds **one** layout token and **two**
  `@repo/ui` props.
- Not a content model. Testimonials stay a static content module (ADR-103),
  FAQ answers stay catalog strings, tools stay `Tool` rows.

---

## 2. The reference, read band by band

Structure only — what each band _does_ with its space, stripped of subject.

| #     | Reference band              | Composition                                                                                                                             | What the shape is FOR                                                                              |
| ----- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **A** | Featured Properties         | Heading at the inline start, "View all" at the inline end, **one row of 4 cards** on a track, two small arrows centred beneath          | A **set of peers**. Nothing is more important than anything else; the row says "here is the shelf" |
| **B** | Meet Our Top Agent          | **2 columns.** Left: one subject, given the whole column — heading, image, copy, CTA. Right: a panel of **4 small cells**, hairline-cut | **One thing, and the evidence for it.** The asymmetry is the argument                              |
| **C** | Explore Prime Neighborhoods | **3 columns.** Narrow text column (heading + CTA) · wide **carousel of 4 small cards** · a tall feature card                            | **A browse.** The left column says what the set is, the middle IS the set, the right is one pick   |
| **D** | What Our Clients Say        | **3 columns with the middle vertically centred**: a quote card · a **video** · a CTA column ending in 3 icon-labels                     | **Three different kinds of proof at once** — a person, a demonstration, an offer                   |
| **E** | Frequently Asked Questions  | Centred heading, **2-column accordion**, "View all" beside the first right-column row                                                   | **The close.** Answers the objection, then gets out of the way                                     |

Two details that are easy to miss and are load-bearing:

1. **Band A's arrows are centred under the track, not beside the heading.** Our
   `Carousel` puts them at the inline start with a dot rail beside them. The
   reference's placement reads as "there is more of this row", ours reads as a
   control panel. `Carousel` gains a `controls` prop (§8.2).
2. **Band D's middle column is centred against the other two, not top-aligned.**
   That is the "centralized video" in the owner's ask, and it is one
   `lg:self-center` — not a new grid.

---

## 3. What we actually have to put in them

Before mapping, the inventory. Everything below already renders on the home page
today or is one already-written `@repo/core` call away.

| Data                   | Reader                                                             | State today                                        |
| ---------------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| Destinations (8)       | `EXPLORE_DESTINATIONS` (code) + per-destination feature flags      | Band `explore_platform`, carousel, 3-up            |
| News articles          | `getPublishedArticles(kinds: ["NEWS"])`                            | Band `latest_news`, `split`, lead + 4 compact      |
| Analysis / trade ideas | `getPublishedArticles(kinds: ["ANALYSIS","TRADE_IDEA"])`           | Band `latest_analysis`, 3-up grid                  |
| Glossary terms         | `getPublishedGlossary(locale)`                                     | Band `glossary_spotlight`, 4-up cards              |
| **Term of the day**    | `getTermOfTheDay(locale)` — **built, and unused on the home page** | Only `/glossary` renders it                        |
| Tools                  | `getEnabledTools(locale)`                                          | Band `popular_tools`, 4-up grid                    |
| Video topics           | `getFeaturedVideoTopics(locale, n)`                                | `connect`'s right panel (1); `/learn` rail (6)     |
| Testimonials           | `HOME_FACTS.testimonials` (static, ADR-103)                        | Band `testimonials`, 3-up grid                     |
| Facts / partners       | `HOME_FACTS.facts` / `.partners`                                   | Bands `facts`, `trust_strip` — **empty in `real`** |
| FAQ                    | `home.faqQ1..4` / `faqA1..4` (catalog)                             | Band `faq`, single-column accordion, 4 items       |
| Social links           | `getActiveSocialLinks()`                                           | `connect`'s row — **and the footer's**             |

Two facts from that table shape the whole plan:

- **`getTermOfTheDay` is built and the home page has never called it.** Band C's
  right-hand feature slot has been waiting for it.
- **The catalogs hold four FAQ entries and the reference shows four in two
  columns.** Two columns of two is a thin block; this is where the owner's "you
  can add new content" applies — §8.4 adds `q5`/`q6`.

---

## 4. The mapping

| Reference | Our band                | Key                                         | Subject                         | Columns                                               |
| --------- | ----------------------- | ------------------------------------------- | ------------------------------- | ----------------------------------------------------- |
| **A**     | The platform            | `explore_platform` (tightened)              | The 8 destinations              | 4-up carousel, arrows centred                         |
| **B**     | From the desk           | `latest_news`, new variant `desk`           | **News + analysis**             | Lead story · 2×2 of analysis                          |
| **C**     | The language of trading | `glossary_spotlight`, new variant `feature` | **Glossary**                    | Heading + CTA · term carousel · **term of the day**   |
| **D**     | See it in practice      | **`in_practice`** (new key)                 | **Testimonial + video + tools** | Quote · **video (centred)** · tools CTA + 3 tool rows |
| **E**     | Questions               | `faq`, new variant `columns`                | **Questions**                   | Centred heading, 2-column accordion, "All questions"  |

All five subjects the owner named — news, analysis, glossary, tools,
questions — land, and each lands in a composition that is not the one beside it.

**Resulting page order** (seed `home.sections`; `order` is the only field that
moves for the untouched bands):

```
hero                 unchanged
trust_strip          unchanged  (absent until the owner supplies partners)
facts                unchanged  (absent until the owner supplies figures)
explore_platform  A  tightened — 4-up, sm spacing, centred arrows
latest_news       B  variant "desk"     ← absorbs latest_analysis
glossary_spotlight C variant "feature"  ← gains the term of the day
in_practice       D  NEW               ← absorbs testimonials + popular_tools + a video
faq               E  variant "columns", 6 items, "All questions" → /support
newsletter           unchanged — the ask, after the answers
quotes               unchanged — the close
risk_disclaimer      REMOVED (changes-34, separate item; footer keeps it)
```

Bands disabled on the home page, **not deleted**: `latest_analysis`,
`popular_tools`, `testimonials`. Each keeps its component, its variants, its
catalog keys and its registry entry — §6 says what that costs and why it is the
right trade.

---

## 5. The bands in detail

### Band A — `explore_platform`, tightened

The owner's words: _"the first The platform section is perfect, just need to
make it the smart way — reduce the space & size."_ So the composition is
untouched and the **density** changes:

| What            | Today                                    | After                                                                              |
| --------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| Slides across   | 3 (`--width-slide-3`)                    | **4** (`--width-slide-4`, new token §8.1)                                          |
| Band padding    | `spacing="lg"` (3–4.5rem a side)         | **`spacing="sm"`** (1.75–2.5rem)                                                   |
| Heading → track | `--section-gap` (1.5–2.5rem)             | Same token, but the "View all" button joins the heading ROW rather than a new line |
| Card media      | Full `HomeMedia` panel                   | Same image, shorter aspect — the card is 4 across now, not 3                       |
| Card padding    | `p-6`                                    | `p-5`                                                                              |
| Icon badge      | `size-12`, `-mt-12` overhang             | `size-10`, `-mt-10` — the overhang is the device, the size is not                  |
| Controls        | 2 arrows + a full dot rail, inline start | **2 arrows, centred under the track**; dots only below `sm` (§8.2)                 |

Measured effect at 1440px: the band goes from ~640px tall to ~420px, and the
"View all" promotion removes one full text line from every viewport.

**Nothing about the data changes.** Flags still gate each card, a `soon`
destination still says so, and `explore-destinations.test.ts` is untouched.

### Band B — `latest_news`, variant `desk`

```
┌──────────────────────────────────┬────────────────────────────┐
│ eyebrow · "From the desk"        │            [ All news → ]  │  header row
├──────────────────────────────────┼────────────────────────────┤
│ ┌──────────────────────────────┐ │ ┌────────────────────────┐ │
│ │ cover                        │ │ │ Analysis               │ │
│ │                              │ │ ├───────────┬────────────┤ │
│ │ [News] Title                 │ │ │ 12 Mar    │ 11 Mar     │ │
│ │ excerpt…                     │ │ │ Headline  │ Headline   │ │
│ │ date · author                │ │ ├───────────┼────────────┤ │
│ │ Read the story →             │ │ │ 09 Mar    │ 07 Mar     │ │
│ └──────────────────────────────┘ │ │ Headline  │ Headline   │ │
│                                  │ │        All analysis →  │ │
│                                  │ └────────────────────────┘ │
└──────────────────────────────────┴────────────────────────────┘
        --grid-3-2  (existing token, 3fr / 2fr)
```

- **Left** is `ArticleCards variant="featured"` with a single entry — the
  component already gives entry one the full width and a taller cover, which is
  exactly the reference's left column. **Two details it will need**: its
  `featuredFirst` branch hardcodes `ratio={21 / 9}` and `sizes="100vw"`, both
  correct for a full-bleed lead and wrong for a 60%-wide column — 21:9 is
  letterboxed at that width, and `100vw` fetches roughly twice the pixels the
  slot uses. Both become props with today's values as defaults, so `/news` is
  untouched and band B passes `16 / 9` and a `(min-width: 1024px) 55vw, 100vw`
  descriptor.
- **Right** is a bordered panel whose body is a 2×2 hairline-cut grid, one cell
  per analysis item: date, then a 2-line-clamped title, the whole cell a link.
  Structurally the reference's 4-stat panel; content-wise ours.
- **Reads:** `getPublishedArticles(NEWS, perPage 1)` and
  `getPublishedArticles([ANALYSIS, TRADE_IDEA], perPage 4)` — two reads that
  both already run on this page today, in parallel, `Promise.all`.

**Degradation (no band ever renders a hole):**

| State                         | Result                                                               |
| ----------------------------- | -------------------------------------------------------------------- |
| News off / none published     | The **newest analysis item becomes the lead**, the panel drops to 3  |
| Analysis off / none published | Left column goes full width; the header's "All news" stays           |
| Both empty                    | `return null` before any translation is fetched (`home-bands` idiom) |

The other three `latest_news` variants (`split`, `standard`, `featured`,
`compact`) are **kept** — `desk` is added to the vocabulary, nothing is removed.

### Band C — `glossary_spotlight`, variant `feature`

```
┌──────────────┬──────────────────────────────────────┬──────────────────┐
│ eyebrow      │ ┌────┐ ┌────┐ ┌────┐ ┌────┐   ← track│ ┌──────────────┐ │
│ The language │ │term│ │term│ │term│ │term│          │ │ ✦ Term of    │ │
│ of trading   │ │line│ │line│ │line│ │line│          │ │   the day    │ │
│              │ └────┘ └────┘ └────┘ └────┘          │ │ Slippage     │ │
│ lead copy    │          ‹ ›   ← centred             │ │ plain line…  │ │
│              │                                      │ │ Read entry → │ │
│ [ Browse A–Z]│                                      │ └──────────────┘ │
└──────────────┴──────────────────────────────────────┴──────────────────┘
      14rem                 1fr                            19rem
              --grid-home-browse  (new token, §8.1)
```

- **Left** is the existing `SectionHeading` plus the existing `glossaryAll`
  button, moved out of the band's foot into its own column.
- **Middle** is the existing term card, on a `Carousel` at
  `--width-slide-2` / `--width-slide-3` (the middle column is ~45% of the page,
  so three across there is four across on a full-width track).
- **Right** is **`TermOfTheDay`** — the component `/glossary` already renders,
  imported into the home page for the first time. It reads
  `getTermOfTheDay(locale)`, a cached loader on a daily `cacheLife`, so the band
  costs one extra cache entry and no clock read.

**Degradation:** no terms ⇒ `return null` (unchanged). Terms but no term of the
day (`getTermOfTheDay` returns null when nothing is published in the locale) ⇒
the right column is **absent** and the grid is two columns, not a grid with a
gap in it. Fewer than 4 terms ⇒ the carousel becomes a plain row (the `Carousel`
already hides controls it cannot use; assert it).

`cards`, `chips` and `grid` variants are kept.

### Band D — `in_practice` (new key)

```
┌────────────────────┬──────────────────────────┬────────────────────┐
│ eyebrow            │                          │ Put it to work     │
│ What learners say  │  ┌────────────────────┐  │ lead copy…         │
│                    │  │                    │  │                    │
│ ┌────────────────┐ │  │       ▶            │  │ [ Open the tools ] │
│ │ ❝              │ │  │   video facade     │  │                    │
│ │ quote…         │ │  │                    │  │ ┌────┬────┬────┐   │
│ │ ── avatar name │ │  └────────────────────┘  │ │ 🧮 │ 📐 │ 🕐 │   │
│ │      • • •     │ │      title · category    │ │Pip │Size│Hrs │   │
│ └────────────────┘ │                          │ └────┴────┴────┘   │
└────────────────────┴──────────────────────────┴────────────────────┘
   grid-cols-1 lg:grid-cols-3, middle column lg:self-center
```

Three kinds of proof, which is the reference's own idea for this band: a person
who learned, a lesson you can watch right now, and the instruments to try it.

- **Left** — one testimonial at a time from `HOME_FACTS.testimonials`, in the
  existing card, on a `Carousel` with **dots only** (`controls="dots"`, §8.2)
  when there is more than one. One testimonial renders the card with no
  controls; zero renders **no column**.
- **Middle** — `VideoTile` for `getFeaturedVideoTopics(locale, 1)[0]`, the same
  single-topic read `connect` makes today, so no new query and no second cache
  entry. `lg:self-center` is the "centralized video". The tile keeps ADR-068 §7's
  **two targets** (a full-bleed play button and a sibling title anchor, never
  nested) and keeps its `next/dynamic` boundary — it is still the heaviest
  client leaf below the fold.
- **Right** — a heading, a lead, one filled CTA to `/tools`, and then the first
  **three** enabled tools as icon rows (`MetricRow`'s vocabulary: glyph + short
  label, hairline-cut, no boxes). Each row is a link to its tool.

**Degradation — per column, because three independent datasets feed it:**

| Columns present | Layout                                   |
| --------------- | ---------------------------------------- |
| 3               | `lg:grid-cols-3`, middle centred         |
| 2               | `lg:grid-cols-2`, both top-aligned       |
| 1               | Single column, `Container size="narrow"` |
| 0               | `return null` before the first `await`   |

The empty-first-then-null discipline is `home-bands.test.ts`'s existing rule
(ADR-103 §3) and the new band is added to that suite, not given a new one.

### Band E — `faq`, variant `columns`

Centred heading; the accordion split into two columns (`grid-cols-1
md:grid-cols-2`, items dealt column-major so reading order matches visual
order); an "All questions" link to `/support`, which since ADR-113 carries the
full seven-answer `SUPPORT_FAQ`. `FAQ_COUNT` goes 4 → 6 with two catalog pairs
added (§8.4), so the two columns hold three each.

`accordion` and `split` are kept; `columns` becomes the seeded home variant.

---

## 6. What gets absorbed, and what that costs

Three built bands stop rendering on the home page. None is deleted, and each
keeps a live surface:

| Band              | Where its data still renders                                | What is lost on the home page                                                             |
| ----------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `latest_analysis` | Band B's right panel (4 items) · `/analysis` in full        | The 3-up card grid with covers. Four headlines with dates replace three cards with images |
| `popular_tools`   | Band D's right column (3 rows) · `/tools` in full           | Four tool cards with taglines. Three named rows and a CTA replace them                    |
| `testimonials`    | Band D's left column (1 at a time, carousel) · nowhere else | The 3-up grid. **This is the real cost** — see below                                      |

**The testimonial cost, stated plainly.** Three quotes visible at once is more
persuasive than one. The trade is deliberate: three quote cards in a row is the
fourth 3-up grid on a page that is trying to stop repeating itself, and the
carousel keeps all of them reachable. If the owner would rather keep the 3-up
grid, the fix is one seed edit (`testimonials` back to `enabled: true`) plus
dropping band D's left column — band D degrades to two columns by design, so
that is a configuration, not a rewrite. **Flagged for the owner in §11.**

**`connect` narrows rather than moves.** It renders a social row _and_ a video
panel today. Band D owns the video now, and one page showing two different
"featured" videos is the page arguing with itself. `connect` keeps the social
row and CTA as a **single-row band** and drops its video panel — which also
serves the "reduce the vertical space" ask. Its `getFeaturedVideoTopics` call
goes away; band D makes the identical call, so the cache entry is shared exactly
as it is today.

---

## 7. Two things this contradicts, and why the ADR is owed

Part F #10: a deviation from the plan needs an ADR **before** the code. Two here.

1. **`latest-news.tsx` says news and analysis are two bands on purpose.** Its
   header comment: _"Splitting them is what lets the homepage show 'what
   happened' and 'what we make of it' as two distinct promises rather than one
   undifferentiated feed — which is the whole reason `ArticleKind` exists as an
   enum instead of a tag."_ Band B merges the placement. The argument still
   holds and the band honours it — the two are in **different columns with
   different treatments and separate CTAs**, which is a sharper distinction than
   two identical grids 400px apart. But the file says otherwise today, so the
   ADR supersedes the comment and the comment is rewritten to point at it.

2. **`registry.ts` says a key with no component renders the honest stub.**
   `in_practice` adds a key whose component composes **three** datasets that each
   already had a band. Nothing in the existing rules forbids it; nothing endorses
   it either. The ADR records the rule it establishes: _a home band may compose
   several datasets when the composition is the point, and it then degrades per
   dataset — never to an empty column._

ADR-116 also records: band A's density numbers, the `Carousel controls` prop,
and the ordering decision (FAQ before newsletter — answer the objection, then
ask for the email).

---

## 8. Contracts, tokens, primitives, catalogs

### 8.1 One layout token, one grid token (`@repo/ui` `globals.css`)

ADR-072 §10 bans arbitrary values, so both are named once in the Layout tokens
block and read as `(--token)` references:

```css
/* A fourth slide on the same 1.25rem track gaps as --width-slide-2/3. */
--width-slide-4: calc((100% - 3.75rem) / 4);

/* Band C: a narrow intro, the set, one pick. Not --grid-intro-main plus a
   column — the third track is a card with a minimum, not a fraction. */
--grid-home-browse: minmax(0, 14rem) minmax(0, 1fr) minmax(0, 19rem);
```

Band B reuses `--grid-3-2`. Band D needs no token (`lg:grid-cols-3`).

### 8.2 `Carousel` gains `controls` (`@repo/ui`)

```ts
controls?: "arrows" | "dots" | "both";   // default "both" — today's behaviour
controlsAlign?: "start" | "center";      // default "start" — today's behaviour
```

Both default to what every existing call site already gets, so this is additive
and no current carousel changes. Band A passes `controls="arrows"
controlsAlign="center"`; band D's testimonial rail passes `controls="dots"`.
`carousel.test.tsx` gains a case per combination, including that the arrows keep
their accessible names in every one.

### 8.3 Contracts (`@repo/contracts` `settings.ts`)

```ts
latest_news:        [... , "desk"]        // added, nothing removed
glossary_spotlight: [... , "feature"]     // added
faq:                [... , "columns"]     // added
// in_practice is deliberately ABSENT from HOME_SECTION_VARIANTS — one shape,
// and what varies is which of its three columns have data. The `connect` /
// `risk_disclaimer` / ADR-103 precedent.
HOME_SECTION_BUILT_KEYS: [... , "in_practice"]
```

`scripts/check-home-sections.mjs` must stay green — it matches this list against
`_sections/registry.ts` exactly.

### 8.4 Catalogs (`packages/i18n/messages/en.json`, `home` namespace)

`home` is a **public** namespace, so `check:catalog-completeness` requires every
key for every locale in `ENFORCED_LOCALES`. Only `en` is active (ADR-091), so
`en.json` alone is correct and complete today.

| Band | New keys                                                                                                                                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A    | `exploreAll`                                                                                                                                                                             |
| B    | `deskEyebrow` `deskTitle` `deskNewsAll` `deskAnalysisTitle` `deskAnalysisAll` `deskRead`                                                                                                 |
| C    | `glossaryCarouselLabel` `glossaryCarouselPrevious` `glossaryCarouselNext` `glossaryTermOfDayEyebrow` `glossaryTermOfDayRead`                                                             |
| D    | `practiceEyebrow` `practiceTitle` `practiceLead` `practiceToolsTitle` `practiceToolsLead` `practiceToolsCta` `practiceQuotesCarouselLabel` `practiceQuotesPrevious` `practiceQuotesNext` |
| E    | `faqAll` `faqQ5` `faqA5` `faqQ6` `faqA6`                                                                                                                                                 |

The two new FAQ pairs are the owner's "add new content where needed". They are
**interface copy about the site**, not claims about a brokerage — anything of the
latter kind belongs in `SUPPORT_FAQ` (ADR-113's rule), not here.

### 8.5 Seed (`packages/db/prisma/seed.ts`)

Home rows are **create-only**: an existing database needs `pnpm db:reset` to see
any of this. Stated in the DEVLOG entry and in the seed comment, as every prior
homepage change has stated it.

---

## 9. PRs

Ordered so the page is never broken between them, and so §7's ADR lands first.

| PR      | Scope                     | What                                                                                                                                                                                                                                                |
| ------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H0**  | `docs/`                   | **ADR-116.** The four compositions, the two contradictions in §7, the per-dataset degradation rule, the FAQ-before-newsletter ordering.                                                                                                             |
| **H1**  | `@repo/ui`                | `--width-slide-4`, `--grid-home-browse`; `Carousel` `controls` + `controlsAlign` with tests. No call site changes — defaults preserve every one.                                                                                                    |
| **H2**  | `@repo/contracts`, `i18n` | The three new variants and all §8.4 catalog keys. **Not** `in_practice` in `HOME_SECTION_BUILT_KEYS` — that entry and the registry entry are one atomic change (`check:home-sections` matches the two lists against each other), so it lands in H6. |
| **H3**  | Band A                    | `explore.tsx`: 4-up, `spacing="sm"`, "View all" into the header row, centred arrows, `p-5` / `size-10` card density.                                                                                                                                |
| **H4**  | Band B                    | `ArticleCards` gains `ratio` / `sizes` props (defaults unchanged); `latest-news.tsx` gains `desk`; the analysis panel; the three degradation paths. `latest_analysis` seeded `enabled: false`.                                                      |
| **H5**  | Band C                    | `glossary-spotlight.tsx` gains `feature`; `TermOfTheDay` imported; carousel in the middle column; the two-column fallback when there is no day term.                                                                                                |
| **H6**  | Band D                    | New `_sections/in-practice.tsx` + registry + `SECTION_PENDING`. `testimonials` and `popular_tools` seeded `enabled: false`. `connect` drops its video panel.                                                                                        |
| **H7**  | Band E                    | `faq.tsx` gains `columns`; `FAQ_COUNT` 4 → 6; "All questions" → `/support`.                                                                                                                                                                         |
| **H8**  | Seed + order              | The §4 order, the new variants, `risk_disclaimer` off (changes-34's own item, landed here because it is the same seed edit).                                                                                                                        |
| **H9**  | Tests + browser pass      | §10 in full, then the running-app verification §10.3 requires.                                                                                                                                                                                      |
| **H10** | DEVLOG                    | Entry with test counts, what was verified in a browser, and what is owed to Module 14.                                                                                                                                                              |

H3–H7 are independent of each other and can land in any order once H1/H2 are in.

---

## 10. Tests and gates

### 10.1 New — `apps/web/app/(public)/[locale]/_sections/home-presentation.test.ts`

Source-read, the `home-bands.test.ts` idiom (these are async server components
and apps/web's vitest config carries no JSX transform):

- **Every new band returns null before its first `await`** when its dataset is
  empty — one case per band, the existing ADR-103 §3 assertion extended.
- **Band D degrades per column**: the file contains no branch that renders a
  column heading without its data, and its null-return guard names all three
  datasets.
- **Band B's fallback exists**: the source contains the analysis-becomes-lead
  path, so a news-less day is a tested state and not a discovered one.
- **`in_practice` is registered in all four places** — `HOME_SECTION_BUILT_KEYS`,
  not `HOME_SECTION_STUB_KEYS`, `SECTION_COMPONENTS`, `SECTION_PENDING` — and is
  **absent** from `HOME_SECTION_VARIANTS` (the `connect` precedent).
- **Band A's density is asserted**, because "reduce the size" is the ask and a
  later edit that restores `spacing="lg"` should fail rather than be noticed
  three months on.

### 10.2 Existing suites that must stay green (no new test needed)

| Suite                          | What it will catch here                                                  |
| ------------------------------ | ------------------------------------------------------------------------ |
| `grid-base.test.ts`            | Every new grid states `grid-cols-1` (code-style #23)                     |
| `radius-scale.test.ts`         | No `rounded-2xl`, no `rounded-full` on anything that is not a circle     |
| `type-scale.test.ts`           | No `text-[Npx]` anywhere in the new markup                               |
| `check:home-sections`          | The registry ↔ contracts duplication stays exact                         |
| `check:catalog-completeness`   | Every §8.4 key present for every enforced locale                         |
| `settings.test.ts` (contracts) | A variant named without a key, or a key with an empty variant list       |
| `home-bands.test.ts`           | `facts` / `trust_strip` / `testimonials` still render nothing when empty |
| eslint `noArbitraryValueRule`  | The two §8.1 tokens are read as tokens, not inlined                      |
| eslint logical-properties      | No `pl-`/`pr-`/`ml-`/`mr-` in four new multi-column layouts              |

### 10.3 Browser verification (the changes-33 standard, not optional)

Seeded, then driven against the dev server:

1. **All five bands render in order** with real seeded data, at 1440px.
2. **390px: `scrollWidth === clientWidth`** on `/`. Four new multi-column
   layouts is exactly where a phone overflow gets introduced.
3. **Each band's degraded state is seen, not assumed** — flags off for news,
   analysis, videos and tools in turn; `HOME_CONTENT_MODE=real` for the empty
   testimonial path.
4. **The page's total height is measured before and after**, since "reduce the
   space" is the ask and the answer should be a number in the DEVLOG.
5. **Keyboard**: every carousel track reachable and arrow-scrollable, band D's
   video play button and title anchor are two separate stops, the accordion
   operates in both columns.
6. **Reveals replay in both directions** (ADR-111) on all four new bands, and
   band B/C/D use the logical `start`/`end` presets so columns arrive from their
   own side — the changes-34 ask, satisfied by the existing `Reveal` vocabulary.

### 10.4 Owed to Module 14 (recorded, not done here)

axe over the recomposed `/`; a Lighthouse budget re-run (band A now mounts one
carousel where the page previously mounted two, and band D mounts one fewer
`VideoTile` than `connect` + `learning_videos` did at their peak); an E2E that
walks a reader from band A to `/tools` and from band C to a glossary term.

---

## 11. For the owner, before H4 and H6 land

Three choices this plan has made on the owner's behalf. Each is a seed edit to
reverse, so none blocks the work — but each is a judgement, not a fact:

1. **Analysis becomes four headlines beside the lead story, losing its covers.**
   The alternative is keeping `latest_analysis` as its own 3-up band, which
   costs ~380px of page and repeats a shape.
2. **Testimonials go from three-at-once to one-at-a-time in a carousel** (§6).
   The most debatable call in the plan.
3. **Tools go from four cards with taglines to three named rows and a CTA.** The
   taglines are the loss; `/tools` carries them in full.

And one question the plan cannot answer: **band D's middle column needs a
published video topic with a playable source.** Two exist in the seed corpus. If
production launches with none, band D is a two-column band on day one — correct
behaviour, but worth knowing before it is a surprise.

---

## 12. What this change does not do

- **No admin surface.** The homepage section composer is paused (ADR-038) and
  stays paused; every choice here is code or seed, per ADR-042.
- **No new model, column or migration.** Testimonials stay static, FAQ answers
  stay catalog strings.
- **No new dependency** — no carousel library, no animation runtime. ADR-018
  rule 1 holds: every band is server-rendered HTML that works with JS off, and
  the only client islands are ones the page already mounts.
- **Nothing is deleted.** Three bands are seeded off and keep their components,
  variants, catalog keys and registry entries. `connect` loses one panel.
- **No locale is activated and no admin string is translated** (ADR-043).

```

```

---

## 13. What changed during implementation

Appended after the work, so the plan stays a record of intent and this section
records where reality differed. The DEVLOG entry for 2026-09-16 is the
authority on what shipped.

1. **`leadRatio` was specified in §5 and NOT shipped.** The reasoning in the
   plan ("21/9 is letterboxed at that width") did not survive the arithmetic:
   the desk band's lead column is ~770px, where 21/9 is a 330px cover — an
   ordinary feature proportion, and the thing that makes the lead column and
   the analysis panel land at the same height. Forcing 16/9 gave a 660px column
   and four analysis cells with 200px of air in each. `leadSizes` shipped as
   planned; a prop no call site passes is one code-style #28 would leave out.
2. **The analysis panel stretches; §5's `items-start` was wrong.** That is
   right for a LIST beside a lead and wrong for a CARD beside one — the
   reference's 4-cell card is exactly as tall as the feature next to it, and
   `items-start` left ~400px of empty page under a short panel.
3. **`glossaryTermOfDayEyebrow` / `…Read` (§8.4) were not added.**
   `glossary.termOfTheDay` and `glossary.readMore` already existed, and a
   second copy in `home` is one string a translator renders two ways. The band
   reads the `glossary` namespace for those two labels.
4. **FAQ q6 had to be rewritten.** As first drafted it duplicated the existing
   q3 ("Is this financial advice?") almost word for word — caught in the browser
   pass, not by any check, because nothing compares two catalog VALUES for
   meaning. It is now "What are the calculators for?".
5. **`in_practice` in `HOME_SECTION_BUILT_KEYS` moved from H2 to H6.** That
   entry and the registry entry are one atomic change: `check:home-sections`
   matches the two lists against each other, so splitting them leaves the check
   red between the two PRs.
6. **Measured saving:** 8193px → 6630px at 1440px (−19%), 13697px → 9652px at
   390px (−30%), no horizontal overflow at either width. §10.3's item 4 asked
   for a number; that is the number.
