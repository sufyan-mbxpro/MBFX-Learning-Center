# SKILL — Module 11: Content system (courses, lessons, glossary, media)

plan.md Module 11 + A7 (new models). Services in `@repo/core`; admin CRUD in
`app/(admin)`. ADR-009 (Tiptap) pinned at this module's kickoff.

## Requirements

- Course/Module/Lesson/Glossary CRUD with the translation workflow:
  `ContentStatus` state machine; publish requires `*.publish`; OUTDATED
  queue screen (sourceHash flow from Module 06).
- **Tiptap** (open-source MIT core only — no paid cloud add-ons). Server-side
  sanitization on save is mandatory regardless of editor behavior.
- New models (A7): `MediaAsset` (+ usage tracking), `Article`/
  `ArticleTranslation` (one model + `kind` enum for analysis & news),
  `Comment`, `Page`/`PageTranslation` (admin-editable static pages).
- S3 uploads: presigned, MIME/size validated server-side, image variants.
- `ContentRelation` linking UI.
- **Slug change writes a `Redirect` row automatically** (per-locale slugs;
  old slug 301s — the SEO-preserving detail).
- Soft delete + restore round-trip.

## Required tests

Status-machine: illegal transitions rejected (DRAFT→PUBLISHED without
APPROVED; publish without permission); **XSS regression suite** (script-tag
payloads stripped server-side); slug change → old slug 301 (E2E);
translation OUTDATED flow E2E; upload rejects oversized/wrong-MIME;
soft-delete restore.
