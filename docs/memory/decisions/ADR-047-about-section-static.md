# ADR-047: The About section is coded static pages with a single facts module

**Status:** Accepted
**Date:** 2026-09-07
**Module:** 12 (public site), 06 (`@repo/i18n`), 08 (navigation)
**Supersedes:** —
**Superseded by:** —

## Context

`docs/changes/changes-09-plan.md` builds a five-page About section modelled on
`forex.com/en-us/about-us/` and its four children. The reference pages were
extracted section by section on 2026-09-07; the inventory is §1 of that plan.

Two things about that source material force a decision.

**1. Where the pages live.** ADR-042 cancelled the Website Builder and settled
the design philosophy: layout, navigation and page composition are built in
code, module by module; only content _data_ is dynamic. A marketing section is
exactly the kind of thing the cancelled builder was for, so the question "CMS
rows, settings, or code?" is live rather than obvious. The retained
`[...slug]` CMS route still resolves published `Page` rows, and seeding five
`PageVersion` layouts would technically work.

**2. What the pages say.** Roughly nine of the extracted sections are
_claim-shaped_: a NASDAQ-listed parent with assets over $15.2B, CFTC
registration, NFA membership, eight named regulators across eight
jurisdictions, nineteen industry awards, 0.002-second average execution, 100%
fill rates, 40K+ retail accounts. Every one of those is a statement of
regulated fact about a specific company. Transplanting them onto MBFX with the
names swapped would put false regulatory and financial claims on a live
finance site — the single highest-consequence mistake available in this work.

The owner chose (2026-09-07) MBFX-adapted copy with facts as fill-in
placeholders, and code + catalogs as the home.

## Decision

### 1. Five real route files, no CMS rows, no settings keys

The section lives at `apps/web/app/(public)/[locale]/about/**` as ordinary
Next.js route files under five new `ROUTE_PATHS` keys (`about`,
`about-why-us`, `about-transparency`, `about-security`, `about-support`).
Structure and composition are code; all display strings are `about.*` keys in
the message catalogs.

This adds **no** settings keys, **no** CMS `Page` rows, and **no** cache tag —
the frozen tag list in `.claude/rules/architecture.md` #12 is untouched,
because these pages read only `theme`, `settings:*` and `navigation`, which are
already tagged and already invalidated correctly.

### 2. One facts module, and an empty collection renders nothing

Every claim of fact — counts, dates, regulators, awards, support hours,
contact channels, payment methods — lives in
`apps/web/app/(public)/[locale]/about/_content/about-facts.ts`: one typed
module, no I/O, `TODO(owner)` on each unfilled value.

**A section whose data is empty does not render.** Not a placeholder, not a
zero, not an empty grid with a heading above it. This is the rule the ADR
exists to enforce: the pages may be shorter than the reference until the owner
fills the module in, and that is the correct state, not a defect to paper over.

The corollary is equally binding: **no number, regulator, award or legal claim
is written into the catalogs.** Catalog strings describe how MBFX works —
qualitative, verifiable against the product itself. Anything quantitative comes
from the facts module, where it is visibly the owner's to supply.

### 3. Images degrade, they do not block

`_content/about-media.ts` maps each hero and callout to an optional path under
`apps/web/public/about/`. A `null` entry renders the component's gradient/tone
panel instead — the treatment `Hero`'s `background` variant already uses. No
stock photography is committed to the repo, and no PR waits on assets.

## Consequences

- **The pages ship shorter than the reference.** The stat band, timeline,
  awards grid and jurisdiction map are all data-gated and start empty. Judging
  the work by "does it look as full as forex.com" will read this as
  incomplete; it is the decision working.
- **Changing copy is a PR, not an admin edit.** Accepted deliberately: it is
  what ADR-042 chose, and it is why there is no admin surface to build here.
- **A new locale means translating `about.*`.** The namespace is public, so
  `check:catalog-completeness` will demand it for any locale added to
  `ENFORCED_LOCALES` (ADR-043 #4). Today that is `en` only.
- **Facts and their labels can drift apart.** A stat's number lives in the
  facts module while its label lives in the catalog. Mitigated by typing the
  label field as the literal union of `about.*` keys, so a stale key is a
  compile error rather than a blank line.

## Alternatives considered

- **Seed the pages as CMS `Page` rows.** Rejected: ADR-042 cancelled that
  feature and hid its admin UI. Authoring new content through a withdrawn
  system means either un-hiding the composer or hand-writing layout JSON in the
  seed — the first reverses a settled decision, the second is worse than code
  in every respect that matters (no types, no lint, no review diff).
- **Put the facts in `@repo/settings` so the owner can edit them in the
  admin.** Rejected for now: it adds settings keys, a settings screen section
  and a cache tag for values that change roughly never, and it would mean
  building an admin surface for the exact category of thing ADR-042 removed
  admin surfaces for. The facts module is deliberately shaped like a settings
  object, so promoting it later is a mechanical change if the owner ever wants
  it.
- **Ship the reference copy with names swapped.** Rejected on the merits: it
  asserts regulation, capital and awards MBFX has not been shown to have.

## Compliance

- `pnpm check:catalog-completeness` — `about.*` is a public namespace and must
  be complete for every enforced locale.
- `pnpm lint` — no hex literals, logical properties only, no hardcoded
  user-facing strings.
- Unit tests, one per data-gated section: rendering it with an empty collection
  emits no heading and no container (§2's rule).
- Review checklist: any numeric or regulatory claim appearing in a catalog
  string instead of the facts module is a change request.
