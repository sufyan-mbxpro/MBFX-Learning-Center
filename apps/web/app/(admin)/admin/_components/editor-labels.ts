// One place to build `RichTextLabels` (changes-10).
//
// The editor is mounted from three screens — the article editor, the
// glossary controls and the (hidden, ADR-042) website builder — and its
// toolbar went from 18 labels to ~50. Three hand-maintained copies of that
// object is three chances for a screen to fall behind by a toolbar button,
// which typechecks fine right up until the day a label renders `undefined`.
//
// ADR-043: `admin.*` is English-only by design, so only `en.json` carries
// values. The keys still go through the catalog (code-style.md #2) — that
// mechanism is unchanged.
import type { RichTextLabels } from "./rich-text-editor.tsx";

/**
 * `translate` resolves an `admin` namespace key. Callers holding a
 * namespaced `t` pass it directly; the website builder, whose `t` is rooted
 * one level up, passes `(key) => t(`admin.${key}`)`.
 */
export function richTextLabels(translate: (key: string) => string): RichTextLabels {
  return {
    toolbar: translate("editorToolbar"),
    bold: translate("editorBold"),
    italic: translate("editorItalic"),
    underline: translate("editorUnderline"),
    strike: translate("editorStrike"),
    paragraph: translate("editorParagraph"),
    heading2: translate("editorHeading2"),
    heading3: translate("editorHeading3"),
    heading4: translate("editorHeading4"),
    blockType: translate("editorBlockType"),
    bulletList: translate("editorBulletList"),
    orderedList: translate("editorOrderedList"),
    blockquote: translate("editorBlockquote"),
    codeBlock: translate("editorCodeBlock"),
    link: translate("editorLink"),
    unlink: translate("editorUnlink"),
    image: translate("editorImage"),
    horizontalRule: translate("editorHorizontalRule"),
    undo: translate("editorUndo"),
    redo: translate("editorRedo"),
    linkPrompt: translate("editorLinkPrompt"),
    placeholder: translate("editorPlaceholder"),
    fontFamily: translate("editorFontFamily"),
    fonts: {
      sans: translate("editorFontSans"),
      serif: translate("editorFontSerif"),
      mono: translate("editorFontMono"),
    },
    fontSize: translate("editorFontSize"),
    sizes: {
      sm: translate("editorSizeSm"),
      base: translate("editorSizeBase"),
      lg: translate("editorSizeLg"),
      xl: translate("editorSizeXl"),
      "2xl": translate("editorSize2xl"),
    },
    textColor: translate("editorTextColor"),
    highlight: translate("editorHighlight"),
    tones: {
      primary: translate("editorTonePrimary"),
      success: translate("editorToneSuccess"),
      warning: translate("editorToneWarning"),
      info: translate("editorToneInfo"),
      danger: translate("editorToneDanger"),
      muted: translate("editorToneMuted"),
    },
    defaultOption: translate("editorDefaultOption"),
    align: translate("editorAlign"),
    alignments: {
      start: translate("editorAlignStart"),
      center: translate("editorAlignCenter"),
      end: translate("editorAlignEnd"),
      justify: translate("editorAlignJustify"),
    },
    table: translate("editorTable"),
    insertTable: translate("editorInsertTable"),
    addRowAfter: translate("editorAddRow"),
    addColumnAfter: translate("editorAddColumn"),
    deleteRow: translate("editorDeleteRow"),
    deleteColumn: translate("editorDeleteColumn"),
    toggleHeaderRow: translate("editorToggleHeaderRow"),
    deleteTable: translate("editorDeleteTable"),
    video: translate("editorVideo"),
    videoPrompt: translate("editorVideoPrompt"),
    videoInvalid: translate("editorVideoInvalid"),
    clearFormatting: translate("editorClearFormatting"),
    modeVisual: translate("editorModeVisual"),
    modeHtml: translate("editorModeHtml"),
    htmlHint: translate("editorHtmlHint"),
  };
}
