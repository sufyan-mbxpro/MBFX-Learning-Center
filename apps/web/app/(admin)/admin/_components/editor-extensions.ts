// Class-based editorial extensions for the Tiptap body editor
// (changes-10, ADR-046).
//
// Why these are hand-written instead of `@tiptap/extension-text-style`'s
// Color/FontFamily/FontSize and `@tiptap/extension-text-align`: every one of
// those emits an INLINE STYLE. `sanitizeRichText` keeps `allowedStyles: {}`
// (security.md #8), so a stock Color mark would round-trip to nothing —
// the admin would pick red, save, and watch it vanish. Worse, the values it
// wants to store are colour literals, which is the thing code-style.md #1
// exists to prevent.
//
// So each mark below renders a NAMED CLASS from a closed set instead. The
// set is defined once in `@repo/ui`'s globals.css, gated once in
// `sanitizeRichText`'s EDITORIAL_CLASSES, and enumerated once here. All
// three lists must agree — a value present here but missing from the
// sanitizer is silently dropped on save, which is exactly the bug the
// editor-vocabulary test in `@repo/core` pins.
//
// None of these declare typed commands. The toolbar drives them through
// Tiptap's generic `setMark` / `unsetMark` / `updateAttributes` /
// `insertContent`, which avoids a `declare module "@tiptap/core"`
// augmentation for a package `apps/web` does not (and should not) depend on
// directly.
import { Extension, Mark, Node, mergeAttributes } from "@tiptap/react";

/** Semantic tones, not colours. Each resolves to a theme token in CSS. */
export const EDITOR_TONES = ["primary", "success", "warning", "info", "danger", "muted"] as const;
export type EditorTone = (typeof EDITOR_TONES)[number];

export const EDITOR_FONTS = ["sans", "serif", "mono"] as const;
export type EditorFont = (typeof EDITOR_FONTS)[number];

export const EDITOR_SIZES = ["sm", "base", "lg", "xl", "2xl"] as const;
export type EditorSize = (typeof EDITOR_SIZES)[number];

/** Logical, never left/right — an RTL article aligns correctly untouched. */
export const EDITOR_ALIGNMENTS = ["start", "center", "end", "justify"] as const;
export type EditorAlignment = (typeof EDITOR_ALIGNMENTS)[number];

/**
 * One mark shape, four instances. Each stores a single enum-valued
 * attribute and renders it as `{prefix}{value}` on `tag`; anything not in
 * `values` parses back to null, so pasted markup carrying a class we no
 * longer ship degrades to unstyled text rather than to a broken attribute.
 */
function classMark<T extends string>({
  name,
  tag,
  prefix,
  values,
}: {
  name: string;
  tag: "span" | "mark";
  prefix: string;
  values: readonly T[];
}) {
  return Mark.create({
    name,
    // Two tones cannot both apply to one run of text — the later choice
    // replaces the earlier one rather than nesting.
    excludes: name,
    addAttributes() {
      return {
        value: {
          default: null as T | null,
          parseHTML: (element: HTMLElement): T | null => {
            for (const value of values) {
              if (element.classList.contains(`${prefix}${value}`)) return value;
            }
            return null;
          },
          renderHTML: (attributes: Record<string, unknown>) => {
            const value = attributes.value;
            return typeof value === "string" && (values as readonly string[]).includes(value)
              ? { class: `${prefix}${value}` }
              : {};
          },
        },
      };
    },
    parseHTML() {
      return [
        {
          tag: `${tag}[class*="${prefix}"]`,
          // Reject the element outright when no known value is present, so
          // ProseMirror does not create an attribute-less mark.
          getAttrs: (element: HTMLElement | string) => {
            if (typeof element === "string") return false;
            return values.some((value) => element.classList.contains(`${prefix}${value}`))
              ? null
              : false;
          },
        },
      ];
    },
    renderHTML({ HTMLAttributes }) {
      return [tag, mergeAttributes(HTMLAttributes), 0];
    },
  });
}

/** Text colour, as a semantic tone. `<span class="ed-tx-warning">` */
export const TextTone = classMark({
  name: "textTone",
  tag: "span",
  prefix: "ed-tx-",
  values: EDITOR_TONES,
});

/** Highlighter. `<mark class="ed-hl-warning">` */
export const HighlightTone = classMark({
  name: "highlightTone",
  tag: "mark",
  prefix: "ed-hl-",
  values: EDITOR_TONES,
});

/** Font family, from the three the design system actually ships. */
export const FontFamilyClass = classMark({
  name: "fontFamily",
  tag: "span",
  prefix: "ed-ff-",
  values: EDITOR_FONTS,
});

/** Font size, stepping the shared type scale rather than taking px. */
export const FontSizeClass = classMark({
  name: "fontSize",
  tag: "span",
  prefix: "ed-fs-",
  values: EDITOR_SIZES,
});

/** The node types alignment may be set on. */
export const ALIGNABLE_TYPES = ["paragraph", "heading", "blockquote"] as const;

/**
 * Block alignment as a global attribute. Not `@tiptap/extension-text-align`
 * for the inline-style reason above, and not a wrapper node because
 * alignment is a property of the block, not a container around it.
 */
export const TextAlignClass = Extension.create({
  name: "textAlignClass",
  addGlobalAttributes() {
    return [
      {
        types: [...ALIGNABLE_TYPES],
        attributes: {
          align: {
            default: null as EditorAlignment | null,
            parseHTML: (element: HTMLElement): EditorAlignment | null => {
              for (const alignment of EDITOR_ALIGNMENTS) {
                if (element.classList.contains(`ed-align-${alignment}`)) return alignment;
              }
              return null;
            },
            renderHTML: (attributes: Record<string, unknown>) => {
              const align = attributes.align;
              return typeof align === "string" &&
                (EDITOR_ALIGNMENTS as readonly string[]).includes(align)
                ? { class: `ed-align-${align}` }
                : {};
            },
          },
        },
      },
    ];
  },
});

/**
 * An in-body provider embed.
 *
 * The node stores the DERIVED embed URL — the toolbar runs the author's
 * pasted link through `parseVideoUrl` first, so an unrecognised host never
 * becomes a node at all. `sanitizeRichText` then re-derives it on save
 * (`parseVideoEmbedUrl`) and rebuilds every attribute, which is what keeps
 * the guarantee ADR-015 #9 wrote for the article-level video field: an
 * author contributes a provider and a video id, never markup.
 */
export const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: { default: null as string | null },
      title: { default: null as string | null },
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure.ed-embed",
        getAttrs: (element: HTMLElement | string) => {
          if (typeof element === "string") return false;
          const src = element.querySelector("iframe")?.getAttribute("src");
          if (!src) return false;
          return { src, title: element.querySelector("iframe")?.getAttribute("title") ?? null };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const { src, title } = HTMLAttributes as { src?: string; title?: string };
    return [
      "figure",
      { class: "ed-embed" },
      [
        "iframe",
        {
          ...(src ? { src } : {}),
          ...(title ? { title } : {}),
          loading: "lazy",
          allowfullscreen: "true",
        },
      ],
    ];
  },
});

/** Everything above, in the order the editor registers them. */
export const EDITORIAL_EXTENSIONS = [
  TextTone,
  HighlightTone,
  FontFamilyClass,
  FontSizeClass,
  TextAlignClass,
  VideoEmbed,
];
