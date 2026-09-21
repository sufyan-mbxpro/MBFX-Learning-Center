# ADR-138 — One AI affordance per field, and it follows the CONTROL

- **Status:** Accepted
- **Date:** 2026-09-18
- **Module:** 18 (AI platform), 09 (Admin shell)
- **Amends:** ADR-126 (a brief fills every editor). `form_fill` is **not**
  withdrawn — the key, the registry, the "Generate with AI" brief and the
  review dialog all stay. Only where its per-field menu is DRAWN changes.
- **Related:** ADR-097 (AI never writes to the database), changes-29 B1 (the
  writing assistant in the rich-text toolbar).

## Context

Two features arrived four days apart and overlapped on one control.

changes-29 B1 put the **writing assistant** inside the rich-text editor's own
toolbar: a ✨ menu that works on the selection, streams into the document, and
knows the block structure it is editing.

ADR-126 then put `AiFieldMenu` — regenerate, improve, shorten, expand — beside
**every** text field of every editor, rich-text fields included.

So a lesson body, an article body, four glossary explanations and a tool's
intro each carried two ✨ buttons a few pixels apart, doing overlapping jobs
with different blast radii: the inner one edits a passage, the outer one
replaces the whole field. The owner asked for the outer one to go from the
rich-text fields, and was explicit that nothing else about the AI writing
assistant should move.

## Decision

**The split is by CONTROL, not by feature.**

- A **rich-text** field's AI lives in the editor's toolbar. That is the
  assistant, and it is the better of the two there for the reasons above.
- A **plain-text** field — an `Input` or a `Textarea`: a title, a summary, an
  SEO description, a tagline — keeps `AiFieldMenu`. The toolbar does not exist
  on those controls, so there is nothing to duplicate.

`form_fill` itself is untouched. The "Generate with AI" brief still writes
every field of a module, rich ones included, because that is one action a human
reviews in one place — not a second control sitting permanently on the field.

Removed from: the article body; the glossary's simple, detailed and advanced
explanations and its example scenario; a glossary topic's description; a
course's description; a lesson's and a video topic's content; a tool's intro
and body. Nine fields across seven editors.

## Consequences

- One ✨ per control, and which one you get tells you what it will do.
- No permission, feature key, setting, schema or prompt changed. Switching
  `form_fill` off still removes the brief bar and every plain-text menu, and
  the assistant is still gated on its own key.
- **`AI_FILL_FIELDS` still declares the rich fields**, and must: the brief
  writes them. A future reader who finds a rich field in that registry with no
  menu beside it is looking at this decision, not at a bug.
- Guarded by `apps/web/app/changes-40-fixes.test.ts`, which walks every
  `<RichTextEditor` back to the `<Field` that owns it and fails on a
  `fieldMenu(` in between — and, in the same block, fails if the toolbar
  assistant stops being passed.
