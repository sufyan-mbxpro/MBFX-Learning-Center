# ADR-168 — An untranslated tool keeps its calculator, and its NAME comes from the catalog

- **Status:** Accepted
- **Date:** 2026-09-29
- **Module:** 13 (market / tools), 06 (i18n)
- **Plan:** `docs/changes/multilingual-automation-plan.md` §6 Phase 6.
- **Amends:** ADR-086 #1 ("every word is data") for ONE fallback string per
  tool. It does not move any word the admin edits.

## Context

Arabic was switched on locally (DEVLOG 2026-09-28). No content table holds an
Arabic row, and this install has no Google key, so the ADR-163 backfill cannot
write one. Every other content module resolves its words through
`pickTranslation`, and Arabic has no `fallbackCode` (ADR-007's rule), so an
untranslated course, term or article is absent or shows the "not yet
translated" notice.

Tools did not use the chain. `getToolPage` and `getEnabledTools` read the
requested locale's row only, fell back to the REGISTRY KEY, and `/ar/tools/pip-value`
rendered the heading "pip-value" over an empty explainer, as an indexable page.
The homepage's tool bands, the `/ar/tools` index and the header search
printed the same keys.

A tool is not like a course. The calculator's own labels are catalog strings
(`tools.*`, complete in Arabic since ADR-166), so the thing a reader came for
works in Arabic even when the explainer does not exist. The header's Tools
menu (Arabic since `seed-menu-ar.ts`) links to every tool, so a 404 would
break every link in it.

## Decision

1. **Tools resolve through the fallback chain** like every other module:
   `pickTranslation(translations, locale, defaultLocale, locales)`.
2. **No row anywhere in the chain means `title: null`**, and nothing else is
   invented. `ToolPageView.title` and `EnabledTool.title` are nullable, so the
   compiler finds every caller that has to name the tool.
3. **The fallback name is a catalog string, `tools.names.<key>`**, in every
   public catalog (so `en` and `ar` today). It is used ONLY when the row is
   absent. It never overrides a saved title. An admin rename changes the
   page and leaves this string alone, which is acceptable: the string exists
   only for the window before a translation lands.
4. **The page keeps the calculator** and puts `tools.untranslated` (the
   calculator works; the explanation is not in this language yet) where the
   explainer would be. The highlights and FAQ bands are absent, as they are
   for any tool with no words.
5. **An untranslated tool page is `noindex, follow`.** The URL's own locale
   has no row, so there is nothing a person approved at that address
   (ADR-159 #2). The sitemap already lists only (tool, locale) pairs that have
   an indexable row (`loadToolSitemapEntries`), so it is unchanged.
6. The registry key is never shown to a reader again. `tools-fallback.test.ts`
   checks that `names` covers `TOOL_KEYS` in both catalogs and that no public
   caller falls back to `.key` for a title.

## Consequences

- An eleventh-tool PR adds `tools.names.<key>` in `en` and `ar`, or the test
  fails. `check:catalog-completeness` enforces the Arabic half anyway.
- The admin's Tools screen is unchanged: it reads English rows, which exist.
- When Google (or a person) writes the Arabic row, the page switches to it
  on the next `content` revalidation with no code change.

## Alternatives rejected

- **404 until translated**, as the glossary does. It is consistent with
  courses, but it breaks every Tools link in the Arabic header for a page
  whose working part is already in Arabic.
- **Author Arabic tool rows in the session**, as `seed-menu-ar.ts` did for
  menus. That is eleven pages of risk-bearing prose (leverage, margin,
  position sizing) written by a machine, and it would still leave the fallback
  bug in place for the next language.
