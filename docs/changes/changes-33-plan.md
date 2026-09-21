# changes-33 — plan

Implementation plan for `docs/changes/changes-33-fixes-improvements-2.md` (the
owner's note). Twelve requests; nine PRs; four ADRs. Read the note first —
this file says how, not what.

Four readings were confirmed with the owner before any code:

1. **About goes, Support stays.** Delete `/about` and its four children;
   rebuild `/about/support` as a top-level `/support` in the dense
   info-and-data presentation of `image-57.png`.
2. **The banners fill section mastheads** — the two named files where their
   names say, the ten generic wide banners across the remaining sections.
3. **"Sitemap" is a human-readable page**, not a link to `sitemap.xml`.
4. **The reveal replays in both directions** — out on the way past, in again
   on the way back. This reverses ADR-104 and needs an ADR of its own.

## ADRs

| ADR     | Subject                                                          |
| ------- | ---------------------------------------------------------------- |
| ADR-109 | About and Markets are withdrawn; Support stands alone            |
| ADR-110 | A legal document is an admin-chosen file at a stable public path |
| ADR-111 | A reveal replays (supersedes ADR-104)                            |
| ADR-112 | The tools strip is dropped                                       |

## Five things this plan got wrong, corrected here

Written before the code and kept honest afterwards — a plan that contradicts
what shipped is worse than no plan. Each is marked **REVISED** below, with the
ADR that carries the settled reasoning.

1. A legal-document setting holds a **path**, not a MediaAsset key (PR 1).
2. `about` and `markets` had to LEAVE `RESERVED_PATHS`, not stay (PR 2, 3).
3. The header's entrance is an animation, not a `Reveal` (PR 5).
4. The curriculum uses ONE accent, not a tone per section (PR 6).
5. The hero's poster was REMOVED, not replaced with a still (PR 7).

## PR 1 — The legal band (ADR-110)

The reference's footer (`image-58.png`) carries a labelled disclaimer block,
the company registration, the registered address, a copyright line, and a row
of four links: Terms · Privacy · Agreement · Sitemap.

**Seeded content.** `legal.riskDisclaimer` becomes the owner's two-paragraph
text. Two new `legal` keys — `legal.companyRegistration` and
`legal.registeredAddress` — because the reference prints them as separate
lines and a single blob cannot be re-ordered or translated apart.
`legal.copyrightNotice` becomes `© {year} MBFX Global Limited. All rights
reserved.`

The settings upsert never overwrites an existing VALUE, so each change also
needs a bounded data migration for databases that already exist — the pattern
the three migrations before it record.

**Documents.** Three more `legal` keys — `legal.termsDocument`,
`legal.privacyDocument`, `legal.agreementDocument` — of a new
`SettingType.DOCUMENT`.

**REVISED.** The plan said the value would be a `MediaAsset` **key**, because
a key survives a storage-driver change and a URL does not. That is true and it
is beside the point: seeding a MediaAsset row means asserting bytes exist in
the storage driver's root, which is git-ignored, so a seeded row 404s in every
picker on a fresh clone — the trap changes-32 recorded beside the brand logos.
So the value is a site-relative **path**: a committed file under
`public/legal/` on a seeded install, `/uploads/<key>` once an admin uploads a
replacement, and `/legal/[doc]` branches on the prefix. ADR-110 §3.

`DocumentPickerField` is a thin sibling of `ImageUploadField` built on the
existing `MediaPickerDialog` (`kinds={["DOCUMENT"]}`), which already uploads.
One upload path, not a second.

**The public URL is ours, not the storage key's.** `/legal/[doc]` resolves
`terms|privacy|agreement` → setting → asset → streams the bytes **inline**.
Three reasons over linking `/uploads/<key>` directly: the address is stable
when an admin swaps the file, it is shareable and indexable, and it does not
publish a storage key in the page source. `/uploads/[file]` keeps its
`Content-Disposition: attachment` default for DOCUMENT (ADR-034 §1) — this
route is the narrow, deliberate exception, and it is `application/pdf` only.

**`/sitemap`** is a real page built from the same registries the footer
columns and `sitemap.ts` read.

Both paths join `RESERVED_PATHS` in the same PR (ADR-047's rule).

## PR 2 — About out, Support in (ADR-109)

Delete: the five routes, `about/_sections/*`, `about/_content/*`,
`about/_components/*`, `ABOUT_ROUTE_KEYS`, `ABOUT_PATHS`, the five
`ROUTE_PATHS` keys, the About mega-menu panel and its icons, the About
`SectionNav`, the `about` explore-carousel card, the seeded About nav rows and
footer rows, and the `about` namespace's now-unread keys.

Add: `/support`, one page, no section bar, no layout — the content of the old
support page re-presented as the note asks (counted facts row, compact
help/channel grid, a self-serve rail, FAQ). `ROUTE_PATHS.support`, one seeded
header row, one seeded footer row.

**REVISED.** The plan said `about` would stay in `RESERVED_PATHS` — a
reserved segment being a promise about `[...slug]`. It had to LEAVE, for two
reasons the plan had not reached: `check-reserved-paths.mjs` fails a
reservation with no route file behind it, and — the load-bearing one —
`resolvePublicPage` returns not-found for a reserved first segment BEFORE it
consults the redirect table, so `/about/support` → `/support` could not have
worked while `about` was reserved. `support`, `sitemap` and `legal` join the
list in its place. ADR-109 §4.

## PR 3 — `/markets` withdrawn (ADR-109)

Delete the route, `ROUTE_PATHS.markets`, and the seeded header and footer
rows. `ComingSoon` survives — deleting the one page that mounts a component is
a different decision from deleting the component — and so do the `markets`
catalog keys it reads, with `COMING_SOON_SECTIONS` now empty rather than gone.

**REVISED.** `markets` does not stay reserved either, for the same reason
`about` does not.

## PR 4 — The tools strip (ADR-112)

`tools/layout.tsx` stops rendering `SectionNav`. The `<main>` landmark stays —
it is why the layout exists. The eight tools are reached from the Tools
mega-menu panel and from `/tools`, both of which already list them.

## PR 5 — The reveal replays (ADR-111)

`reveal-observer.tsx` stops calling `unobserve`. `.is-visible` is added on
enter and **removed on leave**, so an element re-animates whichever direction
it is met from. `rootMargin` becomes symmetric — the current
`0px 0px -10% 0px` is a one-way bias that would make an element re-hide too
early on the way up.

**REVISED.** The plan had `SiteHeader` rendering inside a `Reveal`. That
cannot work: the header is `position: sticky` and never leaves the viewport,
so the observer would add `.is-visible` on the first frame and never remove
it — the reveal machinery doing nothing at all. What is wanted is an entrance
on page load, which is an ANIMATION. `.header-enter` goes on the `<header>`
INSIDE `StickyHeaderShell`, never on the shell, because a transform on the
sticky element's own wrapper is how a sticky bar stops sticking. ADR-111 §4.

The plan also missed that the exit needs its own threshold: a single one would
tear a band taller than the viewport away from a reader mid-way through it.
ADR-111 §2.

ADR-104's argument is not wrong — it is a trade the owner has now made the
other way, and the ADR records that rather than pretending it never held.

## PR 6 — The curriculum reads as a list of lessons

`image-60.png`: three identical white cards. `image-61.png`: the same, narrower.
Both are `CurriculumList` (`full` and `rail`, ADR-082).

- A section header gets a numbered marker and a lesson-count badge — not a
  grey line of text.
- A lesson row gets a hover ground, a bolder title and a duration badge; the
  rail's rows get a hairline between them.
- The current row keeps its brand tint and its edge bar, widened.

**REVISED.** The plan said the marker would take "a tone drawn from its
index". It takes ONE accent. Cycling a hue per section is decoration that
looks like meaning: `success`/`warning`/`info` already carry difficulty and
lesson state on these same pages, and a third unrelated use is how a reader
stops trusting any of them. The count chip is `pill` — the neutral
card-metadata variant — for the same reason: a lesson count is not a status.

ADR-082's two structural rules are preserved and re-asserted by its tests:
the timeline marker stays OUTSIDE the anchor, and nothing between the title
and the `<li>` may be positioned.

## PR 7 — The hero's first paint

`HOME_MEDIA.heroVideoPoster` is `/hero-app-mockup.jpg` — an app mockup, not
the footage. It paints, then the video replaces it, and the swap reads as a
bug. The file's own `TODO(owner)` already named this.

**REVISED.** The plan said the poster would become a still from the footage.
Nothing in this toolchain can decode the H.264 to extract one — the only
ffmpeg on hand is Playwright's, built webm-only. So the poster is REMOVED and
the band carries a solid `--secondary` fill, the same token the scrim above it
fades FROM. The hero is one coherent dark panel from first paint and the
footage arrives into it rather than replacing something.

## PR 8 — Banners and platform art

`storage/uploads/banners` → `apps/web/public/banners/*.webp`, referenced from
each section's existing `_content/*-media.ts` (the ADR-047 §3 pattern —
a media file swap, no component knows).

`storage/uploads/The platform/news.png` and `Analysis.png` → `public/home/`,
replacing the two explore-carousel cards the note names.

## PR 9 — Responsiveness

A pass at phone width over every public route, against code-style.md #23
(a responsive grid states its one-column base) and the image rules: every
`next/image` fill box carries `max-width: 100%`, no `min-w-*` exceeds the
viewport, and tables/diagrams/code own their `overflow-x`.

## Tests

- `contracts` — `ABOUT_*` guards deleted, replaced by their `/support`
  equivalents; the new route keys; `RESERVED_PATHS` additions.
- `apps/web` — `public-chrome.test.ts` loses About/Markets and gains the
  legal band; `explore-destinations.test.ts` loses the `about` card;
  `mega-menu.test.ts` loses the About panel; a new `legal-documents.test.ts`
  pins the stable-path rule and the inline exception.
- `@repo/ui` — `curriculum-list.test.tsx` keeps ADR-082's two structural
  assertions and gains the badge ones; a reveal test for the replay.
- `@repo/core` — `navigation.integration.test.ts`'s About-tree case moves to
  a learn track (deliberately not the tools tree: a tool row is additionally
  pruned unless the `Tool` table enables it), and gains its inverse — a row
  whose `routeKey` the registry no longer has must PRUNE.

## Found while verifying, fixed here

`admin.settingOptions` held two FLAT dotted keys from ADR-105 #7, which
next-intl refuses — an `INVALID_KEY` thrown on every page render, with no
visible symptom because `t.has()` returned false and the fallback still showed
words. Nesting them fixes it with no change to the lookup.
`apps/web/app/catalog-shape.test.ts` is the regression test; nothing else
catches this shape.
