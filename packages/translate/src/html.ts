// HTML around a machine translation. Pure.
//
// **Glossary substitution (ADR-160 #9).** Basic (v2) has no glossary
// resource, so consistency is arranged before the call instead: each glossary
// term that has a HUMAN-saved translation in the target language is replaced
// in the source by that translation, wrapped in `<span translate="no">`, which
// Google leaves alone. The article then uses the glossary's own word. The
// wrappers are stripped from the answer before anything else sees it, and the
// caller sanitizes the result as it would any editor save (security.md #8):
// nothing here is a sanitizer.

/** Marks a wrapper as ours, so stripping cannot touch an author's own span. */
export const KEEP_ATTRIBUTE = "data-mt-keep";

export interface GlossaryPair {
  /** The English term as authors write it. */
  source: string;
  /** Its human-saved translation in the target language. */
  target: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decodes the entities Google's HTML answers use. Unknown ones stay as written. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    }
    if (body.startsWith("#")) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    return NAMED_ENTITIES[body] ?? whole;
  });
}

/** Escapes text for placing inside HTML (content or a double-quoted attribute). */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replaces glossary terms in the TEXT of an HTML body (never inside a tag or
 * an attribute) with their target-language translation, kept from Google.
 *
 * Longest term first, so "bid-ask spread" wins over "spread". Case-insensitive
 * and whole-word: "pip" does not match inside "pipeline". Text already inside
 * a `translate="no"` element or a `<code>` is left alone.
 */
export function substituteGlossary(html: string, glossary: readonly GlossaryPair[]): string {
  const pairs = glossary
    .filter((pair) => pair.source.trim() !== "" && pair.target.trim() !== "")
    .sort((a, b) => b.source.length - a.source.length);
  if (pairs.length === 0) return html;

  const byLower = new Map(pairs.map((pair) => [pair.source.toLowerCase(), pair.target]));
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(${pairs.map((p) => escapeRegExp(p.source)).join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );

  // Split into tags and text; track whether we are inside something Google
  // is already told to keep, where a substitution would nest wrappers.
  const parts = html.split(/(<[^>]*>)/);
  let protectedDepth = 0;
  const protectedStack: boolean[] = [];

  return parts
    .map((part) => {
      if (part.startsWith("<")) {
        const closing = /^<\//.test(part);
        const selfClosing = /\/>$/.test(part);
        const name = /^<\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(part)?.[1]?.toLowerCase() ?? "";
        if (closing) {
          if (protectedStack.pop()) protectedDepth -= 1;
        } else if (!selfClosing && name !== "br" && name !== "img" && name !== "hr") {
          const isProtected = name === "code" || /\btranslate\s*=\s*["']?no\b/i.test(part);
          protectedStack.push(isProtected);
          if (isProtected) protectedDepth += 1;
        }
        return part;
      }
      if (protectedDepth > 0 || part === "") return part;
      return part.replace(pattern, (match: string) => {
        const target = byLower.get(match.toLowerCase()) ?? match;
        return `<span translate="no" ${KEEP_ATTRIBUTE}="1">${escapeHtml(target)}</span>`;
      });
    })
    .join("");
}

const KEEP_WRAPPER = new RegExp(
  `<span\\b[^>]*\\b${KEEP_ATTRIBUTE}\\b[^>]*>([\\s\\S]*?)<\\/span>`,
  "gi",
);

/** Removes our keep-wrappers, leaving their content. An author's spans stay. */
export function stripKeepWrappers(html: string): string {
  return html.replace(KEEP_WRAPPER, "$1");
}
