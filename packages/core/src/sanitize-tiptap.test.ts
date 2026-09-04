// ADR-009 compliance: "when the Tiptap editor UI lands … confirm its
// emitted HTML stays inside the sanitizer's allowlist (a test comparing
// editor.getHTML() output through sanitizeRichText() unchanged)". The
// fixture is the exact vocabulary StarterKit 3.x + Link + Image emit for
// the toolbar the admin editor exposes (rich-text-editor.tsx).
import { describe, expect, it } from "vitest";
import { sanitizeRichText } from "./content.ts";

const TIPTAP_OUTPUT = [
  "<h2>Heading two</h2>",
  "<h3>Heading three</h3>",
  "<p>Plain <strong>bold</strong> <em>italic</em> <u>underline</u> <s>strike</s> <code>code</code></p>",
  '<p><a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">link</a></p>',
  "<ul><li><p>one</p></li><li><p>two</p></li></ul>",
  "<ol><li><p>first</p></li></ol>",
  "<blockquote><p>quoted</p></blockquote>",
  '<pre><code class="language-ts">const x = 1;</code></pre>',
  "<hr />",
  '<p><img src="/uploads/0123456789abcdef01234567.png" alt="cover" title="t" /></p>',
  "<p>line<br />break</p>",
].join("");

describe("sanitizeRichText × Tiptap output (ADR-009)", () => {
  it("passes StarterKit/Link/Image markup through unchanged", () => {
    expect(sanitizeRichText(TIPTAP_OUTPUT)).toBe(TIPTAP_OUTPUT);
  });

  it("still neutralises hostile payloads pasted into the editor", () => {
    const hostile =
      '<p onclick="x()">a</p><script>1</script><img src="javascript:alert(1)"><a href="javascript:void(0)">b</a>';
    const out = sanitizeRichText(hostile);
    expect(out).not.toContain("<script");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("javascript:");
  });
});
