# ADR-118: The support page's last band names four places that exist

**Status:** Accepted
**Date:** 2026-09-16
**Module:** 12 (public site)
**Supersedes:** ADR-113 §5. Everything else in ADR-113 stands.
**Superseded by:** —

## Context

> replace some title instead of coming soon
> also replace the Community Forum with courses

ADR-113 §5 kept the reference's "Coming Soon" band and improved it: a card
LINKS when there is somewhere for it to go, is a `tel:` for phone support, and
is static otherwise. Three of the four ended up linked — a help centre
(`/glossary`), video tutorials, a phone number — and the argument for keeping
the heading was that a flagged-off section renders its card static, "because
the heading already says Coming Soon and that is what an unshipped section is".

That argument was load-bearing for one card out of four. The band's own lead
— "Explore more ways to get the information and help you need" — describes
something already true of three of them, and a heading that contradicts the
sentence under it teaches a reader to scroll past both.

The one card the heading was honest about was Community Forum, which this site
does not have, is not building, and has no entry in any registry that would
produce one.

## Decision

**1. The band is "More ways to get help".** The catalog subtree is renamed
`support.comingSoon` → `support.moreHelp`, and the code registry
`COMING_SOON` → `MORE_HELP`, because a key that says the opposite of what a
surface does is the next reader's wrong assumption.

**2. Community Forum is replaced by Courses**, pointing at `ROUTE_PATHS.learn`
and flagged on `courses`. Not an arbitrary substitution: what a forum stands
in for on a page like this is somewhere to go and learn the thing rather than
somewhere to ask about it, and that is what `/learn` already is. It is also
the destination a reader who could not find their answer in the FAQ actually
wants.

**3. The link-or-static rule from ADR-113 §5 is kept, unchanged**, and is now
the only thing keeping the band honest. Every entry has a destination, so
`href: null` fires for the flag-off case alone: a reader is told the thing
exists and is not handed a 404 (changes-11 D25). `support-page.test.ts` fails
on an entry added with no destination, which is the decision that should be
made deliberately rather than by copying the row above it.

## Consequences

The page no longer says anything about itself being unfinished, which is
correct and also removes a piece of cover. `/support` has now shipped twice
with a band that did not do what it looked like it did — once empty
(ADR-113's own context), once mislabelled — and both times the defect was
invisible to every check in the repo because the data was valid and the
markup rendered. The guard added here is a source test over the registry, not
a render test, for the same reason the rest of `support-page.test.ts` is.

`support.comingSoon` is deleted from `en.json` rather than left in place. It
is a public namespace, so under ADR-043 only `en` is owed and only `en` had
it; nothing else resolved those keys.

The `public.comingSoon*` keys are a different thing entirely and are
untouched — they belong to the `ComingSoon` component (changes-22), which
renders a page for a section that genuinely does not exist yet. That component
is still correct, and is still the thing to reach for when a section is
announced before it is built.
