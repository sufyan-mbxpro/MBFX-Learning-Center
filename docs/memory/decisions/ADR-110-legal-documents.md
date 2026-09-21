# ADR-110: A legal document is an admin-chosen file at a stable public path

**Status:** Accepted
**Date:** 2026-09-15
**Module:** 05 (settings), 12 (public site), 08 (footer), 01 (`@repo/db`)
**Supersedes:** —
**Superseded by:** —

## Context

> Terms / Privacy / Agreement — the above 3 should be dynamically add from the
> admin site, when click on that pages then the pdf file should be visible on
> new tab. also add the sitemap.
>
> add this info in the seeder: Trading risk Disclaimer … Company registration
> number: 2023-00532 … Registered address … © 2026 MBFX Global Limited.

The footer already had `legal.riskDisclaimer` and `legal.copyrightNotice`,
both seeded with generic placeholder text. It had no registration number, no
registered address, and no way to reach the documents a broker is required to
publish. Three PDFs were sitting in `storage/uploads/policies/`.

Four decisions follow from that, and the two interesting ones are about WHERE
the file lives and WHAT the public URL is.

## Decision

**1. The set of documents is CODE; the file behind each one is DATA.**
`LEGAL_DOCUMENT_KEYS` in `@repo/contracts` is `terms | privacy | agreement`.
A legal document is not something an editor adds — it is something the company
is required to publish — so an admin chooses the file and never the key. That
is ADR-042's split for the fourth time, after email templates (ADR-078), the
tools registry (ADR-086) and the AI features (ADR-097).

**2. The public address is `/legal/[doc]`, which is OURS.** Not a link to the
stored path. Three things follow and each of them is a reason on its own:
the address survives an admin swapping the file, so a link printed in a
message sent last year still resolves; it is shareable and indexable; and it
does not publish a storage key in the page source of every page on the site.

It lives under `[locale]` rather than beside `/uploads` for one practical
reason: the proxy locale-prefixes every path without a dot in it, so a
root-level `/legal/terms` would be rewritten to a route that does not exist.
Route handlers ignore layouts, so the segment costs nothing.

**3. The setting holds a site-relative PATH, and the route branches on the
`/uploads/` prefix.** Two shapes reach it, both internal:

- a committed file under `public/legal/`, which is what a seeded install
  points at — the route 307-redirects, because Next already serves it with
  the right type and no `Content-Disposition` at all;
- `/uploads/<key>`, once an admin uploads a replacement — the route streams
  the bytes through `readStoredFile`, which serves only keys the MediaAsset
  table knows.

External URLs are refused by the schema. A legal document hosted elsewhere can
be moved, paywalled or edited by someone who does not work here, while the
footer link keeps asserting it is ours. The regex carries the same negative
lookahead `internalPathSchema` does, because `//evil.example` is a
protocol-relative URL that passes every naive `startsWith("/")`.

**The seeded files are committed to `public/legal/`, not seeded as MediaAsset
rows**, for the reason changes-32 recorded beside the brand logos: a MediaAsset
row asserts that bytes exist in the storage driver's root, which is
git-ignored, so a seeded row 404s in every picker on a fresh checkout.

**4. `/legal/[doc]` is the one route that serves an uploaded file INLINE, and
PDF is the whole allowlist.** ADR-034 §1's `Content-Disposition: attachment`
default for a DOCUMENT is unchanged everywhere else — `/uploads/[file]` still
sends every one as an attachment, because nothing there knows the file was
asked for on purpose. Here it was: the reader clicked a link labelled
"Privacy", and a download is the wrong answer to that. The exception is
defensible only for a format browsers render in a sandboxed viewer of their
own, so the MIME **recorded at upload** decides — not the extension, and not
the route's wish. An admin who points the setting at a `.docx` gets a 404
rather than a PDF header over bytes that are not one.

**5. A document with no file is ABSENT, not a link to a 404.** Empty is a
legitimate third state — an installation that has not published this document
yet — and the footer omits that row. Direct navigation 404s, which is the same
answer from the other side.

**6. `DOCUMENT` is a new `SettingType`, not a widened `IMAGE`.** The two
render different controls and accept different bytes: an image field's whole
affordance is the PREVIEW, and a thumbnail of page one of a forty-page
agreement tells an admin nothing. `DocumentPickerField` shows the file's name
and a way to open it instead. It has **no upload of its own** — the picker it
opens already uploads, and a second upload path would mean a second set of
size limits, a second error surface and a second place for the category to be
wrong.

**7. The registration number and the registered address are their own settings.**
Not two more sentences inside the disclaimer. The footer prints them as
separate lines, a translator handles an address differently from a paragraph
of risk prose, and either can be read alone by a page the disclaimer does not
appear on. Both may be empty — an installation that is not a registered
company prints neither line rather than an empty label.

**8. `/sitemap` is a page for a PERSON.** `sitemap.xml` already exists and is
for crawlers; handing a reader raw XML is a worse answer than no link at all.
It is built from the footer's own `footer.menuColumns` and `buildMenu`, so it
inherits every rule that comes with them — a feature-flagged section prunes,
an empty column disappears, an admin's reordering shows up here too. A second
hand-maintained list is how a sitemap ends up advertising a page that was
deleted two releases ago.

## Consequences

- `20260915190000_legal_documents_changes33` widens the `SettingType` enum and
  carries the new copy to an existing database. It is the FOURTH data
  migration in the series the settings upsert's create-only `value` makes
  necessary, and it is bounded the same way: each `WHERE` matches only a row
  still holding the value Module 08 seeded.
- Three PDFs (5.5 MB) join the repository. They are legal documents that must
  be publicly servable, they change rarely, and the alternative — a seed that
  only works on the machine the files were uploaded on — is worse.
- `legal` was already an unpaused settings group, so the three documents and
  the two new facts are admin-editable with no new screen.
- **A fourth document is an entry in `LEGAL_DOCUMENT_KEYS`, a setting key and
  a catalog string.** `legal-documents.test.ts` names whichever half is
  missing. Nothing hardcodes three.
- Owed to Module 14: an E2E that follows each footer link and asserts a PDF
  comes back inline, and axe over `/sitemap`.
