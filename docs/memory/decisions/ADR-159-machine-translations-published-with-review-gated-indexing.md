# ADR-159 — Machine translations are published immediately; indexing waits for a human

- **Status:** Accepted
- **Date:** 2026-09-25
- **Module:** 06 (i18n), 11 (content), 12 (public site), 15 (articles)
- **Plan:** `docs/changes/multilingual-automation-plan.md` (revision 2), owner
  decisions of 2026-09-25: machine translations go live instantly, and an
  admin can review or change any translation at any time.
- **Amends:** ADR-097's consequence "a future public read that filters on
  `translationStatus` must exclude `MACHINE_TRANSLATED`"; ADR-127 §"reading
  language" (the `?lang=` path's exclusion of `MACHINE_TRANSLATED`) and its
  open hreflang item; ADR-113 §3 (FAQ wording only, see #6). ADR-007's
  fallback rule is confirmed unchanged (#7). Nothing else in those ADRs moves.

## Context

Content saved in English is to appear in every active language
automatically (ADR-160 names the translator, ADR-162 the queue), and
activating a language is to backfill what already exists. Until now a
`MACHINE_TRANSLATED` row was meant to stay unseen by readers until a human
saved it.

In practice the read paths already disagree. The ordinary locale read path
does not filter on `translationStatus` at all (the enum's comment in
`schema.prisma` says so), while `reading-languages.ts` excludes
`MACHINE_TRANSLATED` and `DRAFT` from `?lang=`. With only `en` served
(ADR-091) nobody has seen the difference.

Two risks stand against "just show it". On a forex site, unreviewed machine
output of leverage figures, risk wording and quiz answers is a quality risk.
And many machine-translated pages that are indexed but never reviewed are
the pattern Google's scaled-content policy targets.

## Decision

1. **`MACHINE_TRANSLATED` is served on every read path.** The `?lang=` path
   stops excluding it, so there is one rule everywhere. `DRAFT` stays
   excluded from `?lang=`: it still means a duplicated article's copies
   (ADR-127).
2. **Machine-written PROSE is not indexed.** An article, lesson, glossary
   term, tool page (intro, body, FAQ), quiz or video topic whose translation
   row is `MACHINE_TRANSLATED` renders `robots: { index: false, follow: true }`
   through a conditional spread (code-style.md #26), keeps a self-referencing
   canonical, and is left out of the locale sitemap and of every page's
   `hreflang` alternates.
3. **Labels and chrome are published with no restriction.** Menu items,
   categories, tags, catalog strings, attachment and link labels, social link
   labels: short strings, low risk, and not pages of their own.
4. **A human's Save lifts it.** Saving a translation writes `TRANSLATED`
   (the existing behaviour). That removes `noindex` and adds the page to the
   sitemap and hreflang. There is no separate approve step.
5. **Review is a queue, not a gate.** The translation dashboard lists
   `MACHINE_TRANSLATED` and `OUTDATED` rows. Nothing waits on it.
6. **The support FAQ's WORDING becomes catalog text; its FIGURES do not.**
   ADR-113 §3 moved `SUPPORT_FAQ` out of the catalog so a translator would
   not decide what a withdrawal window says. That reason still holds for the
   numbers and none other: the $10 minimum, 1:100 leverage, the processing
   window and the time zone stay in the facts file and are interpolated into
   catalog messages as ICU arguments, so no translation (human or machine)
   can change a figure. The sentences around them are interface text in
   every other band on the page, and leaving them in code would make
   `/ar/support` the one page with English inside it. `support-page.test.ts`
   gains the assertion that no FAQ message contains a digit.
7. **ADR-007 stands.** ar/ur keep `fallbackCode: null`; a missing
   translation shows the "not yet translated" notice, never English inside
   an RTL page. ADR-162 bounds how long that lasts. Legal PDFs are the stated
   exception: a PDF is a download, not text inside the page, so a locale with
   no uploaded document links the English file with a note saying so.

## Consequences

- The enum comment in `schema.prisma` is rewritten in the change that
  unifies the read paths, since that comment is where the next person looks.
- ADR-127's known issue (hreflang listing locales that 404) is closed by #2:
  alternates are built only from translations that exist, are in an active
  locale, and are indexable.
- A reader can meet an awkward machine sentence on a page that is live. The
  cost is accepted by the owner; the review queue and the number check
  (ADR-160 #8) are how it shrinks.
- Every public loader that returns a translation must return its status, so
  `generateMetadata` can decide #2. That is a field added to the view types,
  not a second query.

## Alternatives rejected

- **Hold machine rows until reviewed (the ADR-097 position).** Every new
  language would open as a site of notices until a person had read every
  page. That is the opposite of the requirement.
- **Show machine rows AND index them.** The SEO risk above, on the domain
  the whole site depends on.
- **Fall back to English while a translation is pending.** Rejected by
  ADR-007 for RTL, and nothing here changes its reasoning.
