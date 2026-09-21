import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  aiBlocksToHtml,
  aiBlocksToText,
  aiInlineToHtml,
  htmlToBlockText,
  type AiBlock,
} from "./ai-blocks.ts";

describe("aiBlocksToHtml", () => {
  it("renders every block kind with plain, attribute-free tags", () => {
    const html = aiBlocksToHtml([
      { type: "heading", level: 2, text: "What a pip is" },
      { type: "paragraph", text: "A **pip** is the *smallest* move." },
      { type: "list", ordered: false, items: ["EUR/USD", "USD/JPY"] },
      { type: "list", ordered: true, items: ["Open", "Close"] },
      { type: "quote", text: "Risk first." },
      { type: "heading", level: 3, text: "Next" },
    ]);
    expect(html).toBe(
      "<h2>What a pip is</h2>" +
        "<p>A <strong>pip</strong> is the <em>smallest</em> move.</p>" +
        "<ul><li><p>EUR/USD</p></li><li><p>USD/JPY</p></li></ul>" +
        "<ol><li><p>Open</p></li><li><p>Close</p></li></ol>" +
        "<blockquote><p>Risk first.</p></blockquote>" +
        "<h3>Next</h3>",
    );
  });

  it("escapes markup a model writes, so it arrives as visible text", () => {
    const html = aiBlocksToHtml([
      { type: "paragraph", text: '<script>alert("x")</script> & <img src=x onerror=1>' },
    ]);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  it("emits only the tags the sanitizer allows, and never an attribute", () => {
    const block = fc.oneof(
      fc.record({
        type: fc.constant("heading" as const),
        level: fc.constantFrom(2 as const, 3 as const),
        text: fc.string({ minLength: 1 }),
      }),
      fc.record({ type: fc.constant("paragraph" as const), text: fc.string({ minLength: 1 }) }),
      fc.record({
        type: fc.constant("list" as const),
        ordered: fc.boolean(),
        items: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 4 }),
      }),
      fc.record({ type: fc.constant("quote" as const), text: fc.string({ minLength: 1 }) }),
    );
    fc.assert(
      fc.property(fc.array(block, { maxLength: 6 }), (blocks) => {
        const html = aiBlocksToHtml(blocks as AiBlock[]);
        for (const tag of html.match(/<\/?([a-z0-9]+)[^>]*>/gi) ?? []) {
          expect(tag).toMatch(/^<\/?(h2|h3|p|ul|ol|li|blockquote|strong|em)>$/);
        }
      }),
    );
  });
});

describe("aiInlineToHtml", () => {
  it("leaves an unpaired marker as a literal asterisk", () => {
    expect(aiInlineToHtml("2 * 3 = 6")).toBe("2 * 3 = 6");
    expect(aiInlineToHtml("**unclosed")).toBe("**unclosed");
  });
});

describe("aiBlocksToText", () => {
  it("reads as text, with list markers and no emphasis markers", () => {
    expect(
      aiBlocksToText([
        { type: "heading", level: 2, text: "Pips" },
        { type: "paragraph", text: "A **pip** matters." },
        { type: "list", ordered: true, items: ["One", "Two"] },
        { type: "quote", text: "Quoted" },
      ]),
    ).toBe("Pips\n\nA pip matters.\n\n1. One\n2. Two\n\n“Quoted”");
  });
});

describe("htmlToBlockText", () => {
  it("keeps paragraph breaks and list items", () => {
    expect(
      htmlToBlockText("<h2>Title</h2><p>One &amp; two</p><ul><li><p>A</p></li><li>B</li></ul>"),
    ).toBe("Title\n\nOne & two\n\n• A\n\n• B");
  });

  it("drops script bodies", () => {
    expect(htmlToBlockText("<p>ok</p><script>bad()</script>")).toBe("ok");
  });
});
