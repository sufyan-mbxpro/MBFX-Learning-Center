# ADR-103: Three owner-supplied home bands, and what a figure on a public page may be

**Status:** Accepted
**Date:** 2026-09-15
**Module:** 12 (public site — the home page)
**Amends:** ADR-076 §2 (no counted-figures strip on public pages) — by naming
the one thing that is _not_ a count. Extends ADR-047 §2/§3 and ADR-051 §1 to a
third surface.
**Superseded by:** —

## Context

The changes-31 reference carries three bands we have no data for:

- a **trust strip** of partner logos under the hero,
- a **facts band** — four figures in a hairline-divided grid (`$2.8B+`, `950+`,
  `23`, `12+`),
- a **testimonials** band — a quote, a video and an offer panel.

The owner asked for all three (2026-09-15). Each runs into something already
decided.

**The facts band runs into ADR-076.** That ADR removed a counted-figures strip
that had been copied into four mastheads — totals of courses, lessons, quizzes,
videos and terms — on the grounds that those are an operator's numbers and
belong on the admin dashboard. `public-chrome.test.ts` enforces it by pinning
`StatCard`/`StatBand` usage to exactly one file: the About facts band, whose
figures are owner-supplied company facts under ADR-047 §2.

So the question is not "may a figure appear on a public page". It is "which
kind", and ADR-076 already answered it without saying so out loud.

**The trust strip and the testimonials run into something simpler.** A row of
logos is a claim about third parties; a testimonial is a claim about a named
person. Neither may be invented, and we have no entity, no admin screen and no
owner content for either.

## Decision

### 1. The distinction ADR-076 was actually drawing

**A count is forbidden. A fact is permitted.**

- A **count** is derived by the platform from its own rows — "412 lessons", "37
  courses". It is an operator's number: it changes when an editor saves, it
  measures us rather than telling the reader anything, and a low one argues
  against the page it sits on. This stays banned on public pages.
- A **fact** is supplied by the owner and vouched for by them — "14 years",
  "4 languages", "60,000 learners taught". It is a claim the business is making,
  it is stable, and it is checkable.

The home facts band is the second instance of the second kind, after About.
`public-chrome.test.ts` gains it as a named second call site — an allow-list of
two, not a removed guard — plus a new assertion that the band reads **no
counting service**, which is the property that actually matters.

### 2. All three are owner-supplied content modules

Each gets a module on the ADR-047 §3 pattern: a plain data file in `_content/`,
no I/O, no `@repo/db`, no `@repo/settings`. Figures and names live there;
qualitative wording lives in the catalogs, per ADR-047 §2's second rule.

### 3. An empty collection renders NOTHING

Not a placeholder, not a heading over an empty grid, not a zero. **A zero is a
claim about the data** (changes-21 F8 made the same call for the admin
dashboard's hidden tiles: absent, never zero). A band whose data is missing is
absent from the page, and the home page starts shorter than the reference and
grows as the owner fills it in.

### 4. Two states, never a mixture — the ADR-051 §1 switch

Each band ships with a `real` dataset that starts **empty** and a `demo` dataset
that is wholly invented, selected by one env-read constant (`HOME_CONTENT_MODE`,
mirroring `ABOUT_CONTENT_MODE`). Demo lets the design be judged finished; real
is what a production build serves.

There is deliberately **no per-field override**. A half-real band, where nobody
can tell which figure was checked, is worse than either pure state — ADR-051 §1's
reasoning, restated because it is the whole reason the switch is coarse.

`HOME_CONTENT_MODE` defaults to `"demo"` in development and **must be set to
`"real"` for production**, exactly as About's does. The demo trust logos are
generic wordmarks of our own drawing, never a real company's mark: an invented
figure is a placeholder, but an invented _partner_ is a false statement about
someone who exists, and those are not the same risk.

### 5. Three new section keys, registered like any other

`trust_strip`, `facts` and `testimonials` join `HOME_SECTION_VARIANTS`,
`HOME_SECTION_BUILT_KEYS`, `SECTION_PENDING` and the seed's `home.sections` in
the PR that builds each — `check:home-sections` fails on a key that is seeded
and unbuilt, or built and unseeded, and that check is the point.

They are seeded **enabled**: a section that renders nothing when its data is
empty needs no second off switch, and a disabled-and-empty band is two reasons
for the same absence.

## Consequences

- **The owner owes content.** Until `HOME_CONTENT_MODE=real` has data behind it,
  a production home page renders thirteen bands, not sixteen. That is the design
  working.
- `public-chrome.test.ts`'s allow-list grows from one file to two. A third
  requires a third ADR, and that friction is intentional — ADR-076 exists
  because the strip had been copied four times without one.
- Testimonials remain **static content**, not an entity. If they later need an
  admin screen, that is a content-system change with its own plan; this ADR
  deliberately does not create a half-model to grow into.
- The demo/real switch is now on its second surface. A third would be the point
  to extract it into one helper rather than a third copy of the same constant.
