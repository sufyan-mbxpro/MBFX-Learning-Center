# ADR-113: `/support` is the owner's page, and the repo gets a second anonymous mutation

**Status:** Accepted
**Date:** 2026-09-16
**Module:** 12 (public site), 17 (email)
**Supersedes:** ADR-109's `/support` page composition. ADR-109's _withdrawal_
of the About section stands untouched — this ADR changes what the one
surviving page contains, not whether it survives. ADR-080 #3's "signup is the
ONE anonymous public mutation" is amended: it is now one of two, under the
conditions in §4.
**Superseded by:** —

## Context

> https://mbfx.co/support — make support page like that. add support form.
> when click on live chat it should redirect to whatsapp page, email popup the
> email app option & click on phone support ask the option. should be same
> text, same format, same question & answer.

ADR-109 kept one page when the About section was withdrawn, and gave it the
reference's **shape** with its own words: a lead panel, four "what we can help
with" tiles, four self-serve links, five qualitative FAQ items and a CTA band.

It shipped broken in a way that is worth naming precisely, because it was not
a bug. `SUPPORT_CHANNELS` was seeded empty with a `TODO(owner)`, and ADR-047
§2 rule 1 — an empty collection renders **nothing** — did exactly what it
says. So the "Ways to reach us" list never drew. The one page a reader arrives
at with a question offered no way to ask it, and the page looked finished.

That is the same failure ADR-109 itself diagnosed in the About section
(`ABOUT_FACTS` never filled in, five pages of catalog prose with the factual
half missing). It was reproduced one page later, one change-set later. The
lesson ADR-047 §2 encodes is right; what was missing is that **a data gate on
a collection nobody ever fills is not a gate, it is an outage with good
manners.** The fix is not to remove the gate — it is to fill the data and
guard the filled state with a test.

## Decision

### 1. The page is the reference's five bands, in its order

Hero → **How Can We Help?** (three channel cards) → **Frequently Asked
Questions** (seven) → **Still Need Help?** (a working contact form) → **Coming
Soon** (four cards). The `help`, `selfServe` and `cta` bands are deleted along
with their catalog keys, and `_components/hero-actions.tsx` with them — the
reference's hero carries no buttons and that component had no other importer.

The order is not only fidelity. The channels come first because a reader who
already knows they want to phone should not scroll past seven FAQ items to
find the number; the FAQ is next because it is cheaper for both sides than a
message; the form is the fallback its own heading calls it.

### 2. The contact channels are real, and the schemes are the reviewable part

`SUPPORT_CONTACT` records the owner's published details — `support@mbfx.co`,
`+18445880522`, WhatsApp `+447822035609` — and `SUPPORT_CHANNELS` builds one
href per card: `https://wa.me/…`, `mailto:`, `tel:`. Built in the facts file
rather than at the call site so that the one thing a reviewer must check about
an anonymous outbound link — its scheme — is in one place. The off-site link
alone carries `rel="noopener noreferrer"`; `mailto:` and `tel:` open no
document.

`SUPPORT_CONTACT.email` does double duty on purpose: it is the address the
Email Support card opens **and** the inbox the form delivers to. One source of
truth means the page cannot show a reader one address while quietly mailing
another. An empty value removes both the card and the form.

### 3. The FAQ moved out of the catalog and into the facts file

`support.faq.q1…a5` are gone; `SUPPORT_FAQ` holds the owner's seven questions
and answers. This is ADR-047 §2 rule 2 applied literally rather than
conveniently: those answers carry a $10 minimum, 1:100 leverage, MetaTrader 5,
a 15-minute-to-24-hour processing window, GMT+2. Every one is a claim about a
brokerage, and a translator should not be the person who decides what a
withdrawal window says — the same reasoning `SupportChannel.availability` has
always carried for opening hours.

**code-style #2 is not weakened.** The band's heading, lead, card titles,
button labels, every form label and placeholder, and all four result messages
stay in `en.json`. The split is: _how support works_ is interface text and is
translated; _what we charge, pay out and run on_ is a fact and is the owner's.
`support-page.test.ts` asserts the FAQ holds no markup, which is what makes
`FaqPanel format="text"` the correct renderer for it.

### 4. A second anonymous public mutation, and what a third costs

ADR-080 #3 said newsletter signup was the one mutation in this repo with no
subject. That sentence was load-bearing: it meant every defence against an
unknown caller could be read in one file. The support form is the second, and
it is deliberately built to be read the same way.

`requirePermission()` (security.md #1) cannot be the first line of a mutation
with no subject. Five parts replace it, and all five must be present:

1. **a recorded inbox** — this feature's equivalent of signup's `newsletter`
   flag. No destination, no endpoint, checked before anything is counted so an
   unconfigured install spends nobody's budget;
2. **a honeypot** — `company`, deliberately _not_ shared with signup's
   `website`: a bot that learns to leave one alone should not thereby pass the
   other, and the cost of a second constant is one line;
3. **`supportRequestSchema`** — bounds every field, lower-cases the address so
   the rate-limit bucket and the send agree on it, and refuses CR/LF in the two
   fields a Subject line is built from;
4. **a per-IP limit**;
5. **a per-email limit** — security.md #13 wants both, because one attacker
   and a distributed flood at one inbox are different attacks.

Two properties make this narrower than signup rather than wider. **It stores
nothing** — there is no `SupportRequest` model, so the endpoint has no table
an attacker can grow; what survives is the `EmailDelivery` row, which holds no
body and no variables (ADR-078 #5). And **it is not an open relay**: `to` comes
from the facts file and no submitted value can reach it. `support-page.test.ts`
asserts that directly.

**A third endpoint of this shape needs its own ADR.** The guard is real rather
than a sentence: the test enumerates `_actions/*.ts` files containing a
honeypot constant — the one thing only a subject-less mutation needs — and
fails on a third.

### 5. "Coming Soon" links what exists

The reference renders all four cards as dead buttons. Two of them describe
things this site already has: video tutorials at `/learn/forex/videos`, and a
help centre, which is what `/glossary` is. So a card links when there is
somewhere to go, is a `tel:` for phone support, and is static for Community
Forum. Each linked card is checked against its feature flag with an anonymous
subject; a flagged-off section renders the card static rather than absent,
because the heading already says "Coming Soon" and that is what an unshipped
section is.

### 6. The support template renders in English and prints the visitor's locale

`support.request` is `audience: "staff"` — the one template whose recipient is
us. Its `locale` is therefore **not** the visitor's: ADR-043 #2 makes staff
mail English, and rendering a Spanish reader's report in Spanish would
translate it away from the person who has to act on it. The locale is carried
as `{{contact.locale}}` and printed in the body instead, so support knows
which language to reply in. Every piece does a job; nothing is submitted and
then dropped (code-style #28's rule, applied to a form field).

The visitor's address is printed rather than set as a reply-to header:
`sendTemplatedEmail` has no per-send override, and inventing one so that
untrusted input reaches a header is the wrong direction.

## Consequences

- **`{{contact.message}}` loses its paragraph breaks.** Variables are escaped
  after the body is sanitised (`render.ts`), which is what makes a message
  containing markup safe, and it also means a newline in HTML is a space. The
  words all arrive. The alternative is a template language that can loop,
  which ADR-078 #6 refused on purpose. Stated in the template default's own
  comment rather than left to be rediscovered.
- **A delivery failure is reported as success.** The send runs in `after()`,
  so the visitor is not held on an SMTP handshake and a known inbox answers in
  the same time as an unknown one. The trade is that "sent" means "accepted",
  and a failure lands as a FAILED row in the delivery log. That log is the
  reason a message this repo deliberately does not store is still answerable.
- **`check:email-templates` now compares variables, not just keys.** The
  script only ever matched the two key lists. `emailTemplateSaveSchema` refuses
  an undeclared variable when an _admin_ saves a body, but the seeded defaults
  never pass through that schema — so a typo in the defaults file reached a
  real inbox as literal `{{braces}}`, and "Reset to default" put it back. Five
  variables in one template is what surfaced it; the check protects the other
  five templates too.
- **No migration.** `EmailTemplate.isActive` defaults true and the seed's
  template loop is create-only, so an existing database gets the new row from
  the next `pnpm db:seed` without overwriting any edited content.
- **Owed to Module 14:** axe over the rebuilt `/support`, an E2E that submits
  the form against Mailpit and asserts the delivery row, and a 390px overflow
  measurement for the new bands.
