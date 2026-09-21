// Formatted AI output → editor HTML, and editor HTML → text a prompt can read
// (ADR-126 §3).
//
// A model never writes the markup. It returns blocks, and this file is the ONE
// place that turns them into HTML: every character escaped, only
// `h2 h3 p ul ol li blockquote strong em` emitted, no attribute on any of them.
// `sanitizeRichText` already allows exactly that, so what the review dialog
// applies is what survives the save.
//
// The block type is declared structurally here rather than imported from
// `@repo/contracts`, which owns the schema: `@repo/utils` depends on nothing.

export type AiBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: readonly string[] }
  | { type: "quote"; text: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * `**bold**` and `*italic*`, and nothing else.
 *
 * Escaped FIRST, so an asterisk pair can only ever wrap text that is already
 * inert. An unpaired marker stays a literal asterisk rather than opening a tag
 * that never closes.
 */
export function aiInlineToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(?=\S)([^*]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?=\S)([^*]+?)\*(?!\*)/g, "$1<em>$2</em>");
}

export function aiBlocksToHtml(blocks: readonly AiBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `<h${block.level}>${aiInlineToHtml(block.text)}</h${block.level}>`;
        case "paragraph":
          return `<p>${aiInlineToHtml(block.text)}</p>`;
        case "list": {
          const tag = block.ordered ? "ol" : "ul";
          const items = block.items.map((item) => `<li><p>${aiInlineToHtml(item)}</p></li>`);
          return `<${tag}>${items.join("")}</${tag}>`;
        }
        case "quote":
          return `<blockquote><p>${aiInlineToHtml(block.text)}</p></blockquote>`;
      }
    })
    .join("");
}

/** Emphasis markers removed — for a preview that renders as text. */
function stripInline(text: string): string {
  return text.replace(/\*\*([^*]+?)\*\*/g, "$1").replace(/\*([^*]+?)\*/g, "$1");
}

/**
 * A readable plain-text rendering of the blocks, for the review dialog's
 * preview. Rendered as TEXT by the caller, never as HTML.
 */
export function aiBlocksToText(blocks: readonly AiBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return stripInline(block.text);
        case "paragraph":
          return stripInline(block.text);
        case "list":
          return block.items
            .map((item, index) => `${block.ordered ? `${index + 1}.` : "•"} ${stripInline(item)}`)
            .join("\n");
        case "quote":
          return `“${stripInline(block.text)}”`;
      }
    })
    .join("\n\n");
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
  nbsp: " ",
};

/**
 * Editor HTML → text that keeps its paragraph breaks.
 *
 * `htmlToText` collapses ALL whitespace, which is right for a word count and
 * wrong for a prompt: "shorten this" on a four-paragraph explanation should
 * still see four paragraphs.
 */
export function htmlToBlockText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/(p|h[1-6]|blockquote|ul|ol|pre|table|tr)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_m, name: string) => ENTITIES[name] ?? " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
