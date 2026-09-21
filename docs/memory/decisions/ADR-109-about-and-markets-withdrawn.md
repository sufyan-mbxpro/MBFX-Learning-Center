# ADR-109: About and Markets are withdrawn; Support stands alone

**Status:** Accepted
**Date:** 2026-09-15
**Module:** 12 (public site), 08 (navigation), 01 (`@repo/db` seed)
**Supersedes:** ADR-047 (the About section) in full, and ADR-051 (its demo
content dataset) with it. ADR-081 #1's `/markets` half.
**Superseded by:** —

## Context

> remove the about section on the public site & all pages that has been used
> in that … and follow this support page
>
> http://localhost:3000/markets — remove this

ADR-047 built five About pages in changes-09: an overview, Why MBX,
How we operate, Security & trust, and Support. Its §2 laid down the rule that
made shipping them defensible — **an empty collection renders NOTHING** — and
then `ABOUT_FACTS` was never filled in. Eleven months later every one of its
seven collections is still `[]` and `foundedYear` is still `null`, which is
the rule working exactly as designed and also a verdict: the pages rendered as
catalog prose about ourselves with the factual half missing. ADR-051 responded
by adding an invented dataset behind a switch, which is a second answer to the
same question and one nobody turned on.

`/markets` has the shorter story. ADR-081 #1 gave it a coded route rendering
`ComingSoon`, because the header, the footer and the homepage carousel all
named it and it was falling through `[...slug]` onto the 404. changes-25 then
built `/tools` — the market surface that actually exists — and changes-32
removed the Markets card from the carousel. What was left was a header entry
leading to a page that says a section is being built.

## Decision

**1. The About section is deleted, and Support survives as `/support`.** One
page, at the top level, with no section bar: a strip of one tab is chrome that
tells the reader nothing, which is ADR-076 §1's own rule applied to a section
that is now a single page. It keeps the data gate — `SUPPORT_CHANNELS` is the
one collection worth carrying forward, still governed by ADR-047 §2's rule,
still empty, so the "here is how to reach us" band is absent rather than
placeholdered.

Everything else in `about/_content/` goes with the pages that read it,
including both halves of ADR-051. A dataset of invented company facts has no
remaining consumer, and keeping one around is how it eventually renders.

**2. The page is re-presented as data, not prose.** A lead panel beside a
dense grid rather than five full-width bands of text, and a FAQ at the foot
answering the five questions support actually receives. The old page was six
bands tall and said less than four of them are worth.

**3. `/markets` is deleted.** `ComingSoon` itself is kept — deleting the one
page that mounts a component is a different decision from deleting the
component, and `COMING_SOON_SECTIONS` is now empty rather than gone, so the
next announced-but-unbuilt destination is a three-line route file again.

**4. Both segments leave `RESERVED_PATHS`, and that is load-bearing.**
`scripts/check-reserved-paths.mjs` fails a reservation with no route behind it
— but the real reason is `resolvePublicPage`, which returns not-found for a
reserved first segment **before** it consults the redirect table. `/about` and
`/markets` had to stop being reserved for decision 5 to work at all.

**5. Six seeded redirects, and only one of them is a move.**
`/about/support → /support` is the genuine one: the page a reader arrives at
with a question is still here, at a shorter address. The other four About
paths and `/markets` are not moves — nothing replaced them — and they go to
`/support` and `/tools` rather than to a 404 for the reason changes-22 built
`ComingSoon`: a reader who followed a link deserves a page, and the nearest
true thing beats an error.

They are seeded `create`-only, so an admin who repoints one keeps their
version.

**6. `support` and `sitemap` are the new route keys; the five About keys and
`markets` are gone from `ROUTE_PATHS`.** That registry is what a seeded menu
row links THROUGH, so a key that outlives its page is a header entry pointing
at a 404. The seed deletes the superseded rows by `routeKey` — safe in exactly
the way overwriting a settings VALUE is not, because a row whose key is not in
`ROUTE_PATHS` cannot resolve to a URL at all, so leaving it preserves nothing.

**7. Support is a FLAT header row, not a panel.** The About entry was a root
with five children and the first consumer of the mega-menu machinery
(ADR-048). One page needs no dropdown, and a mega panel over a single
destination is a popup that says the page's own name.

**8. The `about` catalog namespace is deleted.** A namespace nothing reads is
the same defect as a setting nothing reads (code-style.md #28): it looks
maintained, so the next translator translates it. `support` replaces it, and
under ADR-043 it is a PUBLIC namespace — complete for every ACTIVE locale,
which today is `en` alone.

## Consequences

- The explore carousel drops to six cards. `/support` did **not** take the
  About card's place: that band is "explore the platform" — six things a
  reader can go and use — and a help page is not one of them.
- `public-chrome.test.ts`'s StatCard/StatBand allow-list drops to ONE entry.
  It was an allow-list of two because ADR-076 found the banned counted strip
  copied into four mastheads; a SECOND entry now needs its own ADR, which is
  a tighter rule than before, not a looser one.
- ADR-020…036 are the precedent for what "withdrawn" means here and this
  follows it only partly: those were **retained** code. This is a deletion,
  because unlike the Website Builder there is no admin surface, no seeded
  data and no public rendering to keep working — five route files and a
  content module, all of which are in git history if the decision reverses.
- The one thing genuinely lost is `HotspotMap` and `AwardGrid`'s only call
  sites. Both components stay in `@repo/ui`, unreferenced. That is the
  ADR-042 posture, and it is cheap: they are tested, and a future
  company-facts page will want them.
- `about` and `markets` are now claimable by a CMS page. With the Website
  Builder cancelled (ADR-042) nobody is authoring one, and if that changes,
  a page at `/about` is a reasonable thing for an owner to want.
