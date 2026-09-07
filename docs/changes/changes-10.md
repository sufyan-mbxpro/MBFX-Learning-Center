# changes-10 — News Edit page: UI, UX and a real article editor

**Date:** 2026-09-07. **Status:** shipped.
**Modules touched:** 15 (articles), 11 (content — sanitizer), 07 (`@repo/ui`), 09 (admin conventions), 06 (`en` catalog).
**Governance:** ADR-046 (editorial vocabulary + intent colour). Read it before
changing anything in §7–§9 below.

Owner review of `/admin/articles/[id]`, ten items. Recorded here as
requested → shipped, with the decisions that were not obvious.

## Two clarifications taken before building

| #   | Question                                                                                                                | Answer (owner, 2026-09-07)                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Item 8 wants colour and font control, but the sanitizer strips inline styles and code-style.md #1 bans colour literals. | **Theme-token palette, class-based.** Six semantic tones, three families, a five-step size scale, all as `ed-*` classes. No arbitrary hex. → ADR-046 |
| Q2  | Item 2 lists Total / Published / Draft / Archived counts, which are not on the edit page.                               | "These are the buttons" — i.e. those names belong to item 1. Count cards = the editor's Words / Characters / Reading time / Keywords tiles.          |

## Item by item

| #   | Asked                              | Shipped                                                                                                                                                                                      |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Action buttons coloured by purpose | `Button` gains `success` / `warning` / `info` (ADR-046 §4). Preview → info; Cancel → ghost; Revert to draft → warning; Archive → destructive **+ confirmation**; Update & Publish → primary. |
| 2   | Count cards visually distinct      | The four stat tiles become accent cards — tinted surface, border and icon each (`content-stats.tsx`).                                                                                        |
| 3   | Highlighted keywords stand out     | Keyword density moves onto its own tinted panel; each keyword is a chip with a pass/caution dot **and** its percentage (colour is never the only carrier).                                   |
| 4   | FAQ section                        | Own tinted section body; **Add FAQ** opens a dialog; rows collapse to one line and expand to show the answer; edit reopens the dialog; remove confirms (ADR-044 #7). All client state.       |
| 5   | Add category / tag inline          | Both buttons open a dialog calling the **same** server action the dedicated screens call. The new term is selected and merged into the option list immediately, deduped by id.               |
| 6   | Clear section separation           | One `EditorSection` shell: accent icon, heading, one-line description, header rule, optional footer band. Every panel composes it.                                                           |
| 7   | Visual / HTML modes                | A Visual ⇄ HTML toggle on the body. Safe by construction — the source view can only express what `sanitizeRichText` already allows.                                                          |
| 8   | Richer editor                      | Family, size, tone, highlight, alignment, tables, video embed, block-type picker, clear formatting — on top of the existing marks. See ADR-046 §1–§2 for how each is stored.                 |
| 9   | No horizontal page expansion       | `minmax(0,1fr)` grid track + `min-w-0` at every level + `break-words` + scroll containers. Verified live (see DEVLOG).                                                                       |
| 10  | Professional CMS feel              | The sum of 1–9, plus consistent `Field` groups and tabular-nums on every count.                                                                                                              |

## Deliberately NOT done

- **Image/video _upload_ into the body beyond what exists.** Image upload was
  already wired to `storeImage()`; video is an embed, not an upload, and
  hosting our own video is a storage-and-bandwidth decision, not a UI one.
- **Arbitrary colour picking.** Q1 above.
- **Table column resizing.** `resizable: false` — the widths are inline
  styles the sanitizer strips, so the handles would lie.
- **A stat row on the articles LIST page.** Q2 resolved item 2 to the editor's
  tiles. If Total / Published / Draft / Archived cards are wanted on
  `/admin/articles`, that is a separate change and needs a status-count query
  in `@repo/core`.
- **Autosave.** Still on the Module 11 editor backlog; one explicit save
  remains the contract (changes-07).
