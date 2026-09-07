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

// ── changes-10 / ADR-046: the widened editorial vocabulary ──
//
// The three lists that have to agree are `EDITORIAL_CLASSES` here, the
// `.ed-*` rules in @repo/ui's globals.css, and the enums in the admin's
// editor-extensions.ts. A value in the editor that the sanitizer drops is
// invisible in the admin (it looks applied until you reload) — which is
// exactly why the round-trip is pinned rather than eyeballed.

const EDITORIAL_OUTPUT = [
  '<p class="ed-align-center">centred</p>',
  '<p>a <span class="ed-tx-warning">toned</span> word</p>',
  '<p>a <mark class="ed-hl-success">highlighted</mark> word</p>',
  '<p><span class="ed-ff-serif">serif</span> and <span class="ed-fs-lg">large</span></p>',
  "<table><tbody><tr><th>h</th><td>c</td></tr></tbody></table>",
].join("");

describe("sanitizeRichText × editorial classes (ADR-046)", () => {
  it("passes the class-based tone/highlight/family/size/alignment vocabulary through unchanged", () => {
    expect(sanitizeRichText(EDITORIAL_OUTPUT)).toBe(EDITORIAL_OUTPUT);
  });

  it("strips a class outside the closed set, keeping the element", () => {
    const out = sanitizeRichText('<p class="ed-tx-chartreuse hacker">text</p>');
    expect(out).not.toContain("chartreuse");
    expect(out).not.toContain("hacker");
    expect(out).toContain("text");
  });

  it("still refuses inline styles — allowedStyles stays {} (security.md #8)", () => {
    const out = sanitizeRichText('<p style="color:#c0392b;position:fixed">x</p>');
    expect(out).not.toContain("style");
    // Asserted without the leading "#" on purpose: a bare hex string literal
    // is what code-style.md #1's lint rule forbids, and this file is not
    // exempt just because the hex is the thing being proven absent. Dropping
    // the "#" is also a strictly stronger assertion.
    expect(out).not.toContain("c0392b");
  });
});

describe("sanitizeRichText × video embeds (ADR-046)", () => {
  const YT = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";

  it("keeps a derived provider frame and rebuilds its attributes", () => {
    const out = sanitizeRichText(
      `<figure class="ed-embed"><iframe src="${YT}" title="clip"></iframe></figure>`,
    );
    expect(out).toContain(`src="${YT}"`);
    expect(out).toContain('title="clip"');
    // Rebuilt, not passed through: these were never in the input.
    expect(out).toContain('loading="lazy"');
    expect(out).toContain("allowfullscreen");
  });

  it("drops attributes the author added to a frame", () => {
    const out = sanitizeRichText(
      `<iframe src="${YT}" onload="steal()" sandbox="allow-scripts" srcdoc="<script>1</script>"></iframe>`,
    );
    expect(out).not.toContain("onload");
    expect(out).not.toContain("srcdoc");
    expect(out).not.toContain("sandbox");
    expect(out).toContain(`src="${YT}"`);
  });

  it.each([
    ["a non-provider host", "https://evil.example/embed/x"],
    ["a provider's own non-embed path", "https://www.youtube-nocookie.com/watch?v=dQw4w9WgXcQ"],
    ["a look-alike hostname", "https://www.youtube-nocookie.com.evil.example/embed/dQw4w9WgXcQ"],
    ["a malformed video id", "https://www.youtube-nocookie.com/embed/../../etc"],
    ["a javascript: src", "javascript:alert(1)"],
    ["no src at all", ""],
  ])("drops a frame with %s", (_case, src) => {
    const out = sanitizeRichText(
      `<figure class="ed-embed"><iframe src="${src}"></iframe></figure>`,
    );
    expect(out).not.toContain("<iframe");
  });

  it("accepts the other two providers' derived embed URLs", () => {
    for (const src of [
      "https://player.vimeo.com/video/123456",
      "https://www.dailymotion.com/embed/video/x7tgad0",
    ]) {
      expect(sanitizeRichText(`<iframe src="${src}"></iframe>`)).toContain(`src="${src}"`);
    }
  });
});
