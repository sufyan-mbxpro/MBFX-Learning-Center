# ADR-051: The About section ships a demo dataset behind one switch

**Status:** Accepted
**Date:** 2026-09-07
**Module:** 12 (public site), 07 (`@repo/ui`), 06 (`@repo/i18n`)
**Supersedes:** —
**Amends:** ADR-047 §2 (the empty-collection rule), §3 (images degrade)
**Superseded by:** —

## Context

ADR-047 shipped the five About pages with `ABOUT_FACTS` empty on purpose: the
stat band, the timeline, the awards grid, the payments strip and the
jurisdiction map are data-gated and therefore absent, and `ABOUT_MEDIA` is
sixteen `null`s so every hero and callout falls back to a gradient panel. That
decision was correct for the risk it was managing — a finance site must not
assert regulation, capital or awards it does not have — and it is why §2 reads
"an empty collection renders NOTHING" and why the awards field carries the
comment "never populate this speculatively".

The consequence ADR-047 predicted has arrived. Its own Consequences section
says: _"Judging the work by 'does it look as full as forex.com' will read this
as incomplete."_ The owner (2026-09-07) has now asked for exactly that: a
section that reads as a finished, populated marketing site — awards, figures,
history, a map, imagery, hover and load behaviour — with the explicit framing
**"we'll replace with real data."**

So the requirement is no longer "do not assert what we cannot verify" alone.
It is "be visually complete now, and make replacing the placeholder content a
mechanical, unmissable step later." Those are compatible, but only if the
placeholder content is quarantined rather than typed into the real module.

The failure mode to design against is precise, and it is not "a demo value
renders". It is **a demo value silently surviving into production and being
read as a claim** — by a visitor, by a search engine, or by a regulator.

## Decision

### 1. Two datasets, one switch, never a mixture

`_content/about-facts.ts` keeps `REAL_ABOUT_FACTS` — still empty, still
`TODO(owner)`, still governed by every word of ADR-047 §2. The placeholder
dataset lives in a separate file, `_content/about-facts.demo.ts`, exporting
`DEMO_ABOUT_FACTS` of the same `AboutFacts` type.

`_content/about-content-mode.ts` exports the single resolved
`ABOUT_CONTENT_MODE`, and `about-facts.ts` picks:

```ts
export const ABOUT_FACTS = ABOUT_CONTENT_MODE === "demo" ? DEMO_ABOUT_FACTS : REAL_ABOUT_FACTS;
```

The mode defaults to `"demo"` and is overridden by the `ABOUT_CONTENT_MODE`
environment variable. There is no third state and no per-field merge: a build
shows all placeholder facts or none of them. A half-real About section, where
nobody can tell which number was checked, is worse than either pure state.

Filling the section in for real is therefore: move values from
`about-facts.demo.ts` into `REAL_ABOUT_FACTS`, set `ABOUT_CONTENT_MODE=real`,
delete the demo file. The switch is the checklist.

### 2. ADR-047 §2's empty rule is unchanged, and is still what runs in `real` mode

This ADR does not repeal the rule; it supplies a dataset the rule is not
currently gating. Every section keeps its `length === 0` guard, every guard
keeps its unit test, and setting `ABOUT_CONTENT_MODE=real` returns the pages
to exactly the shape ADR-047 describes. That round trip is itself a test.

### 3. Placeholder facts never enter structured data

The `Organization` JSON-LD in the About layout stays limited to the site name
and description, in both modes. Visible copy is read by a person who can see
the page it sits on; a JSON-LD graph is machine-read, syndicated and cached
out of context, and a fabricated `foundingDate` or `award` there outlives the
page it came from. Demo mode is a rendering state, not a publishing claim.

The section root also carries `data-about-content="demo"`, so an operator, a
test or a reviewer can tell the two states apart from the DOM without a banner
across the design the owner asked for.

### 4. No real third party is named by placeholder data

Award issuers, authorities and partners in `DEMO_ABOUT_FACTS` are plausible
but **fictional** ("Global Finance Education Awards", not a real regulator or
a real awarding body). Numbers, dates and history are invented freely; the
identity of an outside organisation is not.

The reason is that these two things fail differently. An invented figure is
wrong and is corrected by editing it. An invented endorsement names a party
who did not consent, cannot correct it, and may be a regulator whose name
appearing beside MBFX is itself the misrepresentation — the exact hazard
ADR-047 was written for. Under this rule a placeholder that leaks says
something false about MBFX; it never says something false about someone else.

Correspondingly, the map on `/about/security` is presented as **where MBFX's
teams and learners are**, not as a list of regulators MBFX answers to.

### 5. Imagery is generated vector art, committed to the repo

`ABOUT_MEDIA` is wired to SVG files under `apps/web/public/about/`, generated
by `apps/web/scripts/generate-about-art.mjs` and committed. No stock
photography, no external CDN, no runtime fetch.

Three reasons this beats the alternatives. Licensing: generated art has no
provenance question, where a downloaded photograph has one on every page.
Weight: the whole set is a few KB against the public Lighthouse budget
(ADR-006 / Module 14), where sixteen photographs are megabytes. Theming: the
art is authored against the brand's own hues and reads correctly in light and
dark without a `<picture>` fork per slot.

The generator is committed alongside its output so the set can be re-emitted
when the brand moves, and so a reviewer can read the artwork as source.

ADR-047 §3's guarantee survives: a `null` entry still renders the gradient
panel, so a missing or deleted file degrades rather than breaks.

### 6. Motion and hover are CSS, under ADR-018

Everything added here — panel-row hover, card lift and sheen, staggered
reveals, the count-up, image entrance, pin highlight — is CSS transitions, CSS
keyframes, or the one existing `IntersectionObserver` island. No animation
library, and every effect sits inside `prefers-reduced-motion: no-preference`
or is driven by tokens the global reset already neutralises. ADR-018 rules 1–3
are binding here without amendment.

"Late load" is Next's own streaming: the below-fold sections of `/about` are
wrapped in `Suspense` with skeletons that match their final proportions, so
the hero paints without waiting for them. It is not an artificial delay, and
nothing is hidden from a crawler.

## Consequences

- **The About section now looks finished, and is not.** That is the point, and
  it is the risk. Mitigated by §1's single switch, §3's DOM marker and JSON-LD
  abstention, §4's no-real-third-parties rule, and the launch-gate item below.
- **`ABOUT_CONTENT_MODE=real` is a Module 14 launch-gate item.** Going to
  production in `demo` is a decision someone has to take deliberately.
- **The catalog grows by the demo dataset's labels.** Timeline titles, award
  names and location names are catalog strings (they are prose, and ADR-043
  makes the public surface translatable), so `about.*` gains keys that are
  placeholder text. They are removed with the demo file.
- **ADR-047's compliance list still applies**, plus: a test asserting that
  `real` mode renders none of the gated sections, and a test asserting every
  label key the demo dataset names resolves in the catalog.

## Alternatives considered

- **Type the placeholder values straight into `ABOUT_FACTS`.** Rejected: it
  destroys the only signal distinguishing a checked fact from an invented one,
  and ADR-047's `TODO(owner)` markers go with it. Six months on, nobody can
  tell which of the numbers was ever verified.
- **A visible "demo content" banner or watermark.** Rejected: the owner asked
  for a section that reads as real so it can be evaluated as a design, and a
  banner across every page defeats the request. `data-about-content` gives a
  reviewer and a test the same information without touching the design.
- **Keep the pages empty and show the design in a throwaway branch.** Rejected:
  it splits the work in two and the branch rots. One switch in main is cheaper
  to keep honest than a parallel tree.
- **Real photography from a stock library.** Rejected on licensing provenance
  and on the public Lighthouse budget; see §5.
- **Use real regulator and award-body names for realism.** Rejected — §4.

## Compliance

- `pnpm check:catalog-completeness` — the new `about.*` keys are public and
  must be complete for every enforced locale (`en` today).
- `pnpm lint` — no hex literals in TS/TSX, logical properties only. The
  generated SVGs carry their own hex values by necessity and live in
  `public/`, which lint does not cover; the generator names its palette once.
- Unit: `real` mode renders no gated section; every `AboutKey` in
  `DEMO_ABOUT_FACTS` resolves.
- Review checklist: a value moved out of `about-facts.demo.ts` into
  `REAL_ABOUT_FACTS` must arrive with a source the owner can point at.
