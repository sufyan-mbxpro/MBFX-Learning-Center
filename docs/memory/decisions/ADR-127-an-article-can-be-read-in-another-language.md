# ADR-127: An article can be read in another language without changing the site's

**Status:** Accepted
**Date:** 2026-09-17
**Module:** 15 (articles), 06 (`@repo/i18n`), 12 (public site)
**Plan:** owner request, 2026-09-17
**Extends:** ADR-043 (multilingual scope), ADR-091 (only an active locale is served), ADR-097 (machine translations). Nothing in any of them is reversed.
**Superseded by:** —

## Context

The owner, with a screenshot of a "Translate" dropdown sitting above an
article's body:

> the multi language option should be available dropdown when we try to read
> the specific article, course, video, glossary in the public site.. first apply
> that on the news because there is setting available to set the different
> language.. when this module is completed we'll apply to the other modules

The "setting" is the article editor's locale switcher, which offers all four
`routing.locales`. So an admin can write a Spanish, Arabic or Urdu translation
today — and no reader can ever see it:

- ADR-091 serves a locale only when it is ACTIVE, and only `en` is. `/es/news/…`
  404s at the public root layout, correctly, because `es.json` is missing
  hundreds of public keys.
- The header's `LocaleSwitcher` lists active locales, so it renders nothing.

A dropdown that switched the SITE locale would therefore have nothing to offer,
and making it offer something would mean serving an interface with no catalog —
the defect ADR-091 exists to prevent.

## Decision

**1. A reading language is not an interface locale.** The article page takes a
`?lang=<code>` search parameter. The page chrome — header, breadcrumb labels,
meta row, sidebar, FAQ heading — stays in the URL's locale and its complete
catalog; only the ARTICLE's own words (title, body, takeaways, FAQ items, SEO
fields) come from the translation in `lang`. The content wrapper and the title
carry that translation's `lang` and `dir`, so an Arabic body is RTL inside an
LTR page and a screen reader pronounces it as Arabic. No catalog for the reading
language is needed, which is the whole reason this works while ADR-091 stands.

A search parameter, not a route segment, because the next consumers are courses,
lessons, videos and glossary terms, and a `[lang]` segment collides with a
`[lesson]` segment one level up. `?lang=` means the same thing on every page.

**2. Only a translation a human saved is readable.** The offered set is
translations whose `translationStatus` is `TRANSLATED` or `OUTDATED`
(`READABLE_TRANSLATION_STATUSES`, `@repo/core`). This is the first public read
that filters on the status, so ADR-097's recorded consequence applies:
`MACHINE_TRANSLATED` is excluded, and so is `DRAFT` (a duplicated article's
copies). `OUTDATED` stays — a human wrote it; the English moved on. A machine
translation becomes readable the way ADR-097 already promotes it: an editor
opens it and presses Save.

The status filter is ONLY on the reading path. The existing fallback read
(interface locale → `fallbackCode` → default) is unchanged.

**3. The menu links where the language actually lives.** An option whose
language is a SERVABLE locale (ADR-091) links to that locale's own article URL,
so once `es` is activated the reader lands on a fully Spanish page. Every other
option links to the current page with `?lang=`. The current language is marked
and not linked. Fewer than two readable languages ⇒ the menu is ABSENT, not
disabled.

**4. A reading view is not a second indexable page.** With a valid `lang`, the
page's metadata is `noindex, follow` and canonical to the article's own URL.
When the language is activated it gets a real, indexable URL through #3.

**5. An unknown, unreadable or same-as-default `lang` is ignored**, not a 404:
the article renders exactly as it does without the parameter. The value is
parsed through `@repo/contracts` (security.md #6).

## Consequences

- `ArticleView` gains `readingLanguages` (code, native name, direction, slug),
  `readingLocale` and `contentDirection`. `getArticleBySlug` takes an optional
  reading locale, which is part of its cache key.
- The rule is `@repo/core`'s `reading-languages.ts` (`READABLE_TRANSLATION_STATUSES`,
  `resolveReadingLanguages`), pure and shared, so the next module reuses the
  rule rather than restating it. It reads names and directions from EVERY
  seeded `Locale` row, active or not, because the menu names languages that
  are not served.
- `ReadingLanguageMenu` is generic (options in, links out) so the other four
  modules reuse it; each needs its own loader change and page wiring.
- The one Spanish article translation on the dev database is
  `MACHINE_TRANSLATED` and is therefore NOT offered until it is saved.
- Known and not changed here: `generateMetadata`'s hreflang `languages` still
  lists every translation, including locales that 404.

## Alternatives rejected

- **Activate the locales.** Blocked by their catalogs, and not this request.
- **A client island fetching the translation.** The title lives in the server
  band above; swapping it from an island means two renderings of the heading and
  a flash of English. It also makes the view unshareable.
- **Show machine translations with a label.** Reverses a recorded ADR-097
  consequence; needs its own ADR if the owner wants it.
