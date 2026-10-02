# ADR-181 — One slug for every language, and one language switcher

- **Status:** Accepted
- **Date:** 2026-10-02
- **Module:** 06 (i18n), 11 (content), 12 (public site), 15 (articles)
- **Plan:** `docs/changes/changes-60.md`
- **Supersedes:** ADR-127 in full (the per-item "read this in" menu and
  `?lang=`). Amends ADR-161 #6: its collision rule is kept, but it is now the
  rule for EVERY non-default row, not only a machine-created one.

## Context

The owner, 2026-10-02:

> multi-language slug should be added once & should not be update..this will
> update on all modules..also update in public site as well..
>
> do not show seprate dropdown for the content like news..only will show the
> whole site language changer..

Every translation row of an article, category, tag, course, lesson, quiz,
glossary term, glossary topic, video topic and video category carries its own
`slug`, and each language's tab in the editor had its own slug field. So an
Arabic article could live at `/ar/news/<arabic-slug>` while the header's
language switcher — which swaps only the locale prefix — sent a reader from
`/news/<english-slug>` to `/ar/news/<english-slug>`, which did not exist. The
DEVLOG of 2026-10-01 patched that with a cross-language slug lookup on the
article route only. Separately, ADR-127 put a second language dropdown on five
kinds of detail page, beside the header's own.

## Decision

1. **The default locale's row owns the slug; every other row holds a copy.**
   The column stays on each translation row — every public lookup matches
   `(locale, slug)`, and keeping it makes this a rule about writes instead of
   a rewrite of every read. `@repo/core`'s `shared-slug.ts` is the rule:
   `sharedSlugFor` gives a non-default row its slug, `propagateSharedSlug`
   copies an English rename onto every sibling and reports what moved.
2. **A non-default save ignores any submitted slug.** The services take the
   English row's slug; a slug is typed once, on the English tab. When no
   English row exists yet (nothing to copy), the old derivation applies.
3. **An English rename moves every language**, in the same transaction as
   the English row, and writes one 301 per locale that moved, through each
   module's own path builder — exactly as the English rename already did for
   itself.
4. **A collision falls back, never fails.** If another item already holds the
   slug in that locale (only possible for data written before this ADR), the
   ADR-161 #6 rule applies: append the locale, then a piece of the id.
5. **The admin shows the slug once.** On a non-default tab the slug field is
   read-only, shows the shared slug, and says it is changed on the English
   tab.
6. **Existing rows are normalised** by migration
   `20261002090000_shared_translation_slugs_adr181`: every non-default row
   whose item has an English row takes the English slug, and the old
   translated address of every article, category, tag, glossary term and
   topic, course, lesson, quiz and video topic gets a 301 to the new one.
   Video categories get none: a category is a per-track view (ADR-068 §1).
7. **There is one language switcher: the header's.** The `ReadingLanguageMenu`
   and `?lang=` reading views are removed from every detail page, and so is
   the loader plumbing that served them. A `?lang=` in an old link is ignored
   and the page renders normally. With one slug per item, the header switcher
   lands on the same item in the chosen language.

## Consequences

- The header switcher works on every detail page without per-route lookups.
  The article route's cross-language lookup (DEVLOG 2026-10-01) stays: it
  still answers a locale with no translation yet by sending the reader to
  the fallback pick.
- A translated URL is no longer readable in its own script; the owner chose
  stable addresses over localized ones.
- A translation that is not in a SERVED locale has no public surface until
  its locale is switched on, which is ADR-091's position restored.
