# ADR-117: A masthead shows its photograph; the scrim carries the contrast

**Status:** Accepted
**Date:** 2026-09-16
**Module:** 07 (`@repo/ui`), 12 (public site)
**Supersedes:** `PageHero`'s `tone="brand"` default and its 25% backdrop
ceiling (changes-09, ADR-047 §3). ADR-018 rule 5 and ADR-003's derivation
rules are untouched and are what this decision is argued from.
**Superseded by:** —

## Context

> remove the yellow cover/shade on all banners, also the text should be
> visible after remove the yellow shade

`PageHero` has defaulted to `tone="brand"` since it was written — a full-band
gradient from `--primary` to `--primary-active` with the engine-derived
`--primary-foreground` on top. That was the right call when there was nothing
behind it: it is the one large-area pairing ADR-003 guarantees legible, and
exactly the case ADR-018 rule 5 allows a raw `--primary` fill in.

Then changes-33 imported the owner's photography into eleven slots. Nine of
those are `PageHero` backdrops, and the component renders a backdrop at
`opacity-25` under the gradient — a ceiling with a real reason behind it
(above 25%, generated artwork started eating the contrast the tone had been
checked for), which produced a result nobody would have chosen: a photograph
at a quarter strength beneath a solid wash of `#C28D5A`. The default brand
primary is a warm tan, so every section front on the site opened on a yellow
panel with a ghost of a picture in it.

The owner's second clause is the harder half. Removing the fill removes the
contrast guarantee with it, and there is no guarantee to be had over an
arbitrary photograph — a text-shadow is a hope, not a derivation.

## Decision

**1. A new `photo` tone, and a `backdrop` selects it.** `tone` is now
optional and resolves to `photo` when the caller supplies a backdrop and
`brand` when it does not. An explicit `tone` always wins.

A default that keys off another prop rather than a value every call site
passes, because the rule it encodes is "a masthead that was given artwork is a
masthead whose job is to show it" — and nine call sites that each have to
remember a tone name is nine chances to add the tenth photographic masthead
under a fill again. It is the same reasoning `size` already carries in this
component: a density is several numbers that have to move together, so it is
one named thing rather than a set of props a call site assembles.

**2. `photo` is `--secondary` / `--secondary-foreground`,** the pairing the
homepage hero and the footer already run on. Not because it is neutral — in
light mode `--secondary` is a light neutral, in dark mode it is dark — but
because it is a fill the theme engine has derived an ink AGAINST. That is the
only property that matters here, and it is what makes clause two of the
owner's sentence answerable at all.

**3. The legibility guarantee moves from a clamp on the picture to a scrim
under the words.** The backdrop renders at full strength; between it and the
copy sits a gradient built from `--secondary` at varying alpha. The copy is
therefore reading against a known fill in a known direction, whatever the
photograph happens to contain at that point.

**The scrim's two shapes are the design, not a convenience.** A start-aligned
masthead keeps its words in the inline-start half, so the scrim is opaque
there and clears **completely** on the other side — which is the whole point,
and the reason a reader now sees the photograph rather than a tint of it. That
is the homepage hero's exact idiom, restated in the component that needed it.
A centred masthead (`/support`) has copy across the full width and gets a
vertical scrim instead, softest through the middle. The start-aligned copy
column is capped at `md:max-w-3xl` so the headline cannot run out of the
opaque half; `text-balance` was already keeping most titles inside it, and
this makes it a guarantee rather than a property of the words that happen to
be there.

**4. The brand colour moves from the band to the button.** Every masthead's
primary action is now the default filled `Button` — `--primary` with its own
paired `--primary-foreground`, a small element, which is precisely what
ADR-018 rule 5 permits and what a full-bleed gradient never was. The second
action takes a new `Button variant="inverted"`: opacities of
`--secondary-foreground`, readable on `--secondary` by construction.

`inverted` exists because `outline` (`border-input bg-background`) is a pale
chip on this band and `secondary` (`bg-secondary`) is a control the same
colour as the surface under it. Four call sites had already written the
substitute class string out by hand — the homepage hero, the footer's social
buttons, the connect band — so this is that string once rather than a fifth
copy.

**5. A band with no artwork keeps `brand`.** This is not "the brand fill was
wrong". `/sitemap`, `/economic-calendar`, `ComingSoon` and the eight tool
pages have nothing behind them and still need a surface, and the one the
engine guarantees an ink for is the one they should have.

## Consequences

**A missing piece of art now yields a plain `--secondary` band, not the brand
gradient.** The `_content/*-media.ts` files each promised the old fallback in
a comment; those comments are corrected rather than the behaviour restored.
The reason is mechanical and worth stating: `backdrop={<NewsBackdrop … />}` is
a JSX element, so it is truthy even when the component returns `null`, and the
tone is decided by the parent before the child renders. The consequence is
acceptable — an un-arted masthead is `inverted`, which is a surface this site
already uses on two of its largest bands — and the alternative (threading the
media constant up to the call site) would put the registry's own data in nine
page files to answer a question the registry already answers.

**The glossary term page's breadcrumb changed ink.** It was
`--primary-foreground` at opacities, hand-written because the band was filled.
It is the same construction against `--secondary-foreground` now.
`ListingCrumbs tone="onFill"` needed nothing: it was already built from
opacity off `currentcolor`, which is the tone-agnostic form, and this is the
second time that choice has paid.

**Not settled here:** whether the scrim's alpha steps are right for every one
of the owner's eleven images. They are a reasonable default over photography
with a subject, and a picture that is nearly white in its inline-start third
will still be a light ground under dark text — legible, because the ink is
derived, but flatter than intended. That is a per-image crop question, not a
component one, and the place to fix it is the source file.

**Owed to Module 14:** axe over the nine recomposed mastheads (the ink pairing
is derived and therefore safe by construction, but the scrim's mid-gradient
alpha is a computed value axe should actually measure), and an RTL pass — the
horizontal scrim is flipped by hand under `[dir="rtl"]`, the same place-by-place
honesty `.reveal-start` needs, and hand-written flips are what RTL smoke exists
for.
