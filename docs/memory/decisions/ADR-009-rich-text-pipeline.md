# ADR-009: Rich text stored as sanitized HTML; Tiptap is the editor, landing after the pipeline

**Status:** Accepted
**Date:** 2026-09-01
**Module:** 11 (content system) — reserved for this decision at kickoff.
**Supersedes:** —
**Superseded by:** —

## Context

plan.md Part F #8 locks Tiptap (open-source core only) as the rich-text
editor. Two genuinely separate questions hide under that lock:

1. **What is the STORAGE format**, and where does the security boundary
   sit? security.md #8 is unambiguous: sanitized **server-side on save,
   regardless of editor behavior** — the editor is never the boundary.
2. **When does the editor UI land?** The content services (status machine,
   translation lifecycle, sanitize-on-save, redirects) are testable and
   shippable with any HTML source, including a plain textarea; the Tiptap
   editor is a client-side authoring convenience on top.

## Decision

- **Storage format: sanitized HTML strings** (LongText columns), not
  Tiptap's JSON document model. Sanitization by `sanitize-html@2.17.7` in
  `@repo/core`'s `sanitizeRichText()` — an allowlist matching the
  vocabulary Tiptap's core extensions emit (headings, lists, links, code,
  tables, images), `https`/`http`/`mailto` schemes only, **zero inline
  styles** (styling is the theme engine's job, code-style.md #1 in spirit).
  Every content save path goes through it; the XSS regression suite in
  `content.integration.test.ts` pins script tags, event handlers,
  `javascript:` URLs, and style attributes/tags.
- **Tiptap core, when the editor UI lands, emits/ingests exactly this
  HTML** (`editor.getHTML()` / `content` input) — no migration, because
  HTML-in/HTML-out is Tiptap's native interchange. The admin screens ship
  first with a plain textarea against the same save actions; swapping the
  input widget for Tiptap changes zero server code.
- Tiptap remains the ONLY editor candidate (the Part F lock is untouched);
  nothing else is being adopted in the interim — a textarea is not an
  editor choice, it's the absence of one.

## Consequences

- The security-relevant surface shipped WITH Module 11's services, not
  after the editor: pasting a hostile payload through the API or textarea
  today is already neutralized on save.
- HTML storage means public rendering (Module 12) is
  `dangerouslySetInnerHTML` of ALREADY-SANITIZED content — re-sanitizing
  on render is optional depth, not the boundary.
- Choosing HTML over Tiptap JSON trades away structured-document queries
  (rarely needed for a learning site) for zero-migration interchange and
  human-auditable rows.

## Alternatives considered

- **Store Tiptap JSON.** Rejected: ties rows to one editor's document
  schema, needs a render pipeline to HTML anyway, and makes server-side
  sanitization a JSON-tree walk instead of one battle-tested HTML pass.
- **Sanitize on render instead of save.** Rejected outright by
  security.md #8 — and stored-hostile content is a liability even if the
  renderer is careful (exports, feeds, emails all become re-audit points).

## Compliance

- Every new content save path MUST call `sanitizeRichText()` — reviewed at
  each content-bearing module (12's page model, future comments).
- When the Tiptap editor UI lands: pin exact versions in stack.md (MIT
  core packages only, per the Part F lock), and confirm its emitted HTML
  stays inside the sanitizer's allowlist (a test comparing
  `editor.getHTML()` output through `sanitizeRichText()` unchanged).
