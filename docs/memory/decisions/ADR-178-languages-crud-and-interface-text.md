# ADR-178 — Languages are managed in the admin, and interface text is editable

- **Status:** Accepted
- **Date:** 2026-10-01
- **Module:** 06 (i18n), with 09 (admin) and 12 (public site)
- **Extends:** ADR-163 (activating a language), ADR-091 (only an active
  locale is served), ADR-165 (translatable settings). ADR-043 stands: the
  admin portal stays English-only.
- **Change set:** `docs/changes/changes-58-languages.md`

## Context

The owner asked for three things:

1. Several languages live at once, more languages to choose from, and
   create / edit / delete for languages.
2. One place to edit the site's fixed interface text, language by language:
   pick a language, see every string in English beside that language, and
   replace any of them. Settings text already has its own place (Site text,
   ADR-165), and dynamic content is translated in its own module's editor.
3. Every active language available everywhere, on the public site and in
   the admin.

Four facts about the code shaped the answer:

- `routing.locales` is a static list of four codes (`en es ar ur`).
  next-intl cannot route a prefix that is not in it, so a language added as
  a database row alone could never be served.
- Interface text is four JSON files. A string could only be changed by a
  developer, and a language without a file had no text at all.
- Several editors (articles, courses, lessons, quizzes) and the AI Writer
  listed `routing.locales` rather than the language rows, so the admin's
  language list was the code's list, not the admin's.
- next-intl's browser-language detection redirected `/` to any code in
  `routing.locales`, served or not. A visitor whose browser prefers Spanish
  (seeded, inactive) was sent to `/es`, which is a 404. With a longer list
  this would hit most visitors who do not read English first.

The owner chose (2026-10-01): pick new languages from a built-in list; admin
pickers list every language but the admin stays English; the text editor
covers public text only; deleting a language is refused while it has
content.

## Decision

1. **The languages the site can route are a code registry,
   `SUPPORTED_LOCALES`** (`@repo/i18n/routing`): code, English name, native
   name and direction for 28 languages. `routing.locales` and
   `LOCALE_DIRECTION` are derived from it, so they cannot drift apart. The
   set of routable codes stays code; which of them exist, their names and
   whether they are live is data. A language outside the registry needs a
   code change, the same as before, and the registry says so.
2. **Languages have create, edit and delete** at Settings → Translation →
   Languages, behind `locales.manage` (no new key):
   - **Add** picks a registry code that has no row yet. Names, flag,
     fallback and order are prefilled from the registry and editable. The
     row is created switched off.
   - **Edit** changes the names, flag, fallback language and order. The
     code and the direction are not editable: the code is the URL prefix,
     and the direction comes from the registry because `<html dir>` is
     decided before any database read.
   - **Delete** is refused for the default language, for a live language
     (switch it off first), and for a language that still has content
     translations in any `*Translation` table, settings translations and
     campaign emails included. Its interface-text overrides are deleted
     with it, and any language that fell back to it falls back to nothing.
   - **Switching on** keeps ADR-163's gates unchanged. Any number of
     languages may be live at once.
3. **Interface text has a database override layer, `MessageOverride`**
   (`locale`, `key`, `value`, `isMachine`). At request time the catalog for a
   locale is its file (or nothing, for a language that has no file) with the
   overrides laid over it, read through `"use cache"` under a new **`messages`**
   cache tag. The English fallback for a missing key uses the English
   overrides too. `publicCatalogGaps` and `catalogMessage` read the same
   merged catalog, so the activation gate and emails agree with the page.
4. **Settings → Translation → Interface text** is the editor
   (`translations.update`). Pick a language and a section; each row shows the
   key, the English and the language's text with a state: shipped, edited,
   machine, or missing. Editing opens a dialog; **Reset** removes the
   override after a confirmation. English can be edited too.
   - **Public namespaces only.** Admin keys are refused by the service, not
     only hidden (ADR-043 #2).
   - **A saved value must keep the English message's arguments and tags.**
     It must parse as ICU, and its set of `{arguments}` and `<tags>` must
     equal the English one's. Plural categories may differ, because they are
     per language. A broken message is refused and never written.
5. **"Translate missing with Google"** fills up to 200 missing public keys
   per press for a non-default language (`translations.approve`, the key
   Sync uses, because it spends). It reuses `translateCatalogMessages`, so
   arguments, tags and plurals are protected exactly as in
   `pnpm translate:catalog`. It goes through `translateSegments`, so it is
   metered and stops at the budget. It writes only keys that have no value,
   marks them `isMachine`, and never overwrites a person's text. A person's
   save clears `isMachine`.
6. **Admin pickers list the language rows.** Every editor and the AI Writer
   read `getAuthoringLocales()` (every row next-intl can route), never
   `routing.locales`. A language added in the admin appears in every editor
   at once.
7. **Browser-language detection only lands on a served language.** When
   next-intl would redirect to a locale that is not active, the proxy serves
   the default language instead. It asks a cached
   `GET /api/locales` for the served list, only on that redirect, so a
   normal request costs nothing extra.
8. **Every language row has a Live switch** (owner, 2026-10-01: "there
   should be an option to make it live or hide"). Off asks for confirmation
   and hides the language from the public site: its pages, the language
   menu, hreflang and the sitemap. It stays in the admin pickers, so it can
   still be written. On goes live after a confirmation when the language is
   ready. When it is not, the switch opens a checklist instead: missing
   interface strings and missing legal site text, each with a link to the
   screen that fixes it. ADR-163 #2's gate is unchanged, and the service
   still refuses.

## Consequences

- A new language goes live with no deploy: add it, fill its interface text
  (by hand or with Google), write its legal site text, switch it on.
  ADR-163's gate now counts overrides, so a language with no JSON file can
  pass it.
- `ENFORCED_LOCALES` and `check:catalog-completeness` are unchanged. They
  still guard the JSON files in CI; the database layer is guarded at
  activation time by the same `publicCatalogGaps`.
- The catalog sent to a page now depends on the database. A failed override
  read must not take pages down, so it falls back to the file alone.
- `messages` joins `locales` as a tag minted by `@repo/i18n` outside
  architecture.md #12's frozen list, for the same reason.
- 28 codes are now URL prefixes. A coded first segment equal to one of them
  would be shadowed; a test fails if any registry code is a reserved path.
