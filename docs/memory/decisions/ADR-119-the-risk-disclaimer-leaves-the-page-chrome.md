# ADR-119: The risk disclaimer leaves the page chrome, and the subscribe banner takes its place

**Status:** Accepted
**Date:** 2026-09-16
**Module:** 08 (navigation — footer), 12 (public site), 15 (articles)
**Supersedes:** the footer's legal band as written in changes-33 / ADR-110's
context ("the footer carries the disclaimer, the registration number, the
registered address"), and the article page's disclaimer paragraph (Module 15).
ADR-110's decisions about legal DOCUMENTS stand unchanged.
**Superseded by:** —

## Context

> Trading Contracts for Difference (CFDs) and spread bets involves a high
> level of risk … For more details, please review our Privacy Policy.
>
> remove this from all pages..replace with the subscribe banner

`legal.riskDisclaimer` was printed in two places that together cover every
public page: the footer's legal band (a labelled inset panel, changes-33) and
a paragraph under every article. The home page's own `risk_disclaimer` band
had already been switched off in changes-34 because the footer duplicated it.

The owner's request reverses a written position — the changes-33 footer was
built on the argument that a forex risk disclaimer is "the one paragraph down
here a regulator expects to find" — so it gets an ADR rather than a quiet
deletion. Whether the business needs that paragraph somewhere on the site is
the owner's call, not the code's; what the code owes is that the removal is
deliberate, recorded, and reversible.

## Decision

**1. No page chrome prints `legal.riskDisclaimer`.** The footer no longer
reads it, and the article page no longer reads it. The registration number and
registered address stay in the footer: they are separate settings (ADR-110),
and the request named the disclaimer text only.

**2. The setting is kept, and is not dead.** `risk_disclaimer` is still a home
section whose component reads the key, so code-style.md #28 ("a setting read
by nothing does not ship") is satisfied, and putting the disclaimer back on the
home page is a data change — enable the band — not a code change. No migration
touches the stored value.

**3. The footer's subscribe band becomes the subscribe BANNER.** It was a
muted strip on `--secondary`; it is now the same `CtaBand` (`--primary` fill,
paired ink) that `/news` closes on, placed where the disclaimer was. One
subscribe banner design on the site, not two. Both newsletter switches are
unchanged (ADR-080 #5): the `newsletter` flag and
`newsletter.placements.footer` still decide whether it is drawn.

**4. The footer shows how to reach a person.** Email, a call number and a
live-chat (WhatsApp) number under the brand description, read from
`SUPPORT_CONTACT` — the facts file `/support` already uses — so the two
surfaces cannot disagree, and the numbers stay out of the catalog (ADR-047 §2
rule 2). Only the "Call:" / "Live Chat:" labels are catalog keys.

## Consequences

- To restore the disclaimer site-wide is a code change reverting §1; to show
  it on the home page only is the `risk_disclaimer` band's `enabled` flag.
- `footer.riskDisclaimerLabel` is deleted from all four catalogs.
- `home-presentation.test.ts` now asserts the INVERSE of what it asserted in
  changes-34: neither the footer nor the article page reads the key, and the
  footer renders a `CtaBand`.
- On `/news` and `/analysis` a reader now sees two filled subscribe banners
  near the bottom — the page's own and the footer's. Each has its own placement
  setting, so an admin who finds that repetitive turns one off in Settings →
  Email; the code does not guess which.
