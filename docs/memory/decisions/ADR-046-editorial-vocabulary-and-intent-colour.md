# ADR-046: Article body styling is a closed, token-backed class vocabulary — and admin action colour carries consequence

**Status:** Accepted
**Date:** 2026-09-07
**Module:** 15 (News & Analysis), 11 (content — sanitizer), 07 (`@repo/ui` — button), 09 (admin conventions)
**Supersedes:** —
**Superseded by:** —

## Context

`docs/changes/changes-10.md` is an owner review of the News Edit page. Most
of its ten items are ordinary UI work — sections get headings and icons, FAQ
rows collapse, categories and tags can be created without leaving the screen —
and those live in the DEVLOG. Three of them are not ordinary, because they
collide with rules already written down:

1. **"Add font family, font size, text colour and highlight colour"** hits
   `sanitizeRichText`'s `allowedStyles: {}` (security.md #8) and code-style.md
   #1's ban on colour literals. Every stock Tiptap extension for these
   (`@tiptap/extension-text-style`'s Color/FontFamily/FontSize,
   `@tiptap/extension-text-align`) emits an inline `style` attribute. Shipped
   as-is, an author would pick a colour, save, and watch it vanish — and if
   the sanitizer were opened to let it through, article bodies would carry
   frozen hex values that survive neither a re-brand nor dark mode.

2. **"Video upload/embed"** in the body hits ADR-015 #9, which froze "embed
   URLs and iframes are DERIVED at render, never stored". That rule was
   written for the article-level `videoUrl` field, where it is exactly right.
   It cannot be applied literally in the body, because the body renders
   through `dangerouslySetInnerHTML` — whatever is stored IS what renders.

3. **"Action buttons should use different colours based on their purpose"**
   is a design-system change, not a screen change: `Button` had no
   success/warning/info variants, so every lifecycle action on the publish
   panel rendered as the same outline button.

The first two are the reason this is an ADR rather than a DEVLOG entry. Both
touch the sanitizer, which is a security boundary, and both would otherwise
be decided again — differently — the next time someone wants a coloured word
in a lesson body.

## Decision

### 1. Author styling is a closed class vocabulary, not inline style

Tone, highlight, font family, font size and block alignment are stored as
named classes from a fixed set, all prefixed `ed-`:

| Axis      | Shape                                  | Values                                         |
| --------- | -------------------------------------- | ---------------------------------------------- |
| Tone      | `<span class="ed-tx-{tone}">`          | primary, success, warning, info, danger, muted |
| Highlight | `<mark class="ed-hl-{tone}">`          | same six                                       |
| Family    | `<span class="ed-ff-{family}">`        | sans, serif, mono                              |
| Size      | `<span class="ed-fs-{step}">`          | sm, base, lg, xl, 2xl                          |
| Alignment | `class="ed-align-{side}"` on the block | start, center, end, justify                    |

The set is defined in exactly three places, which must agree:

- `packages/ui/src/styles/globals.css` — the CSS. Every value resolves to a
  **theme token**, so re-branding the site re-colours every article ever
  written and dark mode keeps working.
- `packages/core/src/content.ts` — `EDITORIAL_CLASSES`, the sanitizer's
  `allowedClasses` allowlist.
- `apps/web/app/(admin)/admin/_components/editor-extensions.ts` — the
  hand-written Tiptap marks that emit them.

Consequences taken deliberately:

- **`allowedStyles` stays `{}`.** Nothing in this ADR relaxes it. There is
  still no path from stored content to arbitrary CSS.
- **This is a net TIGHTENING of the sanitizer.** `class` used to be allowed
  on `span` and `code` with no value filtering at all; it is now allowlisted.
- **No arbitrary hex.** An author cannot pick "that particular red". This was
  the explicit trade the owner chose over a free colour picker
  (2026-09-07): brand consistency and theme-survival over expressive range.
  Alignment is logical (`start`/`end`), never `left`/`right`, so an Arabic
  article aligns correctly with no author action (code-style.md #3).
- **The extensions are hand-written.** Not NIH: the stock ones cannot emit a
  class instead of a style, so there is nothing to reuse.

### 2. In-body video embeds are re-derived on every save

An `<iframe>` survives `sanitizeRichText` only when `parseVideoEmbedUrl`
(`@repo/utils`) recognises its `src` as one of the three embed URL shapes
`parseVideoUrl` derives. When it does, the frame is **rebuilt** — src,
`loading`, `allow`, `allowfullscreen` — from the parsed provider and video
id. Only the author's `title` survives, as escaped text. `allowedIframeHostnames`
is a second, independent lock.

This preserves what ADR-015 #9 was actually protecting: an author contributes
a provider and an eleven-character id, never markup. ADR-015 #9 remains in
force unchanged for the article-level `videoUrl` field, which still stores a
URL and derives its frame at render. The editor also whitelist-parses before
insertion, so an unrecognised host never becomes a node at all.

Adding a provider is still one entry in `PARSERS`, plus its embed-host branch
in `parseVideoEmbedUrl` and its hostname in `allowedIframeHostnames`.

### 3. An HTML source view is safe and is offered on the body

The body editor has a Visual / HTML toggle. This adds no attack surface:
whatever is typed there goes through `sanitizeRichText` on save exactly like
editor output, so the source view can only express what the vocabulary
already allows. It is opt-in per call site (`allowHtmlMode`) — body-length
prose wants it; a one-line hint field does not.

### 4. `Button` gains `success`, `warning` and `info` intent variants

Same tinted-surface shape as `destructive`: the semantic token at 10% for the
surface, its `*-interactive` derivation for the label — that derivation is
what `@repo/theme` contrast-checks (ADR-003), never the raw brand hue.

Colour marks **consequence**, not prominence:

| Intent        | Used for                                                |
| ------------- | ------------------------------------------------------- |
| `default`     | The one primary action on a screen                      |
| `success`     | Publishing, approving, going live                       |
| `info`        | Previewing, scheduling — informational, reversible      |
| `warning`     | Un-publishing, reverting — reversible but consequential |
| `destructive` | Archiving, deleting, removing                           |
| `ghost`       | Cancel and other no-op exits                            |

A screen where six buttons each shout a different colour communicates less
than one where only the consequential ones do. These are not decoration.

Archiving additionally goes through `ConfirmDialog`: it is the one lifecycle
transition that takes a live post off the public site, and colour alone is
not a speed bump. Restoring and reverting to draft are not confirmed —
ADR-044 #7's reasoning about not gating the way back applies.

## Consequences

- `@tiptap/extension-table@3.31.0` joins the pinned Tiptap set
  (`docs/memory/stack.md`). Configured `resizable: false` — resizing persists
  column widths as inline styles, which the sanitizer strips, so the handles
  would lie.
- The three-list agreement in §1 is a real coupling. A value added to the
  editor but not to `EDITORIAL_CLASSES` is dropped on save and looks applied
  until the page reloads — which is why
  `packages/core/src/sanitize-tiptap.test.ts` pins the round trip rather than
  leaving it to review.
- `RichTextLabels` grew from 18 to ~50 keys, so the three mount sites build it
  through one `richTextLabels(t)` helper instead of three hand-maintained
  copies. Admin namespace, English-only (ADR-043).
- Existing article bodies are unaffected: the vocabulary is additive, and the
  only removal is unallowlisted `class` values, which nothing was emitting.

## Alternatives rejected

- **Open `allowedStyles` to a regex-validated colour/size/align set.** What
  the brief literally asked for, and defensible as sanitization. Rejected
  because it stores colour literals in content: the values would not follow a
  re-brand, would not adapt to dark mode, and would be the one place in the
  codebase where code-style.md #1 does not hold.
- **Token palette plus a hex escape hatch.** Carries the same risk for the
  sake of an option most authors would reach for by default, defeating the
  point.
- **No in-body video; point authors at the article-level Video tab.** Honest,
  and it was the fallback if §2 could not be made safe. It can, and one video
  per article is a real limitation for an explainer piece.
- **Render the body through a component tree instead of
  `dangerouslySetInnerHTML`**, so embeds could stay derived-at-render. The
  right long-term answer and a much larger change than this brief; §2's
  derive-on-save keeps the security property without it.
