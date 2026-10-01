import { describe, expect, it } from "vitest";

import {
  decodeEntities,
  escapeHtml,
  KEEP_ATTRIBUTE,
  stripKeepWrappers,
  substituteGlossary,
} from "./html.ts";

const keep = (text: string) => `<span translate="no" ${KEEP_ATTRIBUTE}="1">${text}</span>`;

describe("decodeEntities / escapeHtml", () => {
  it("decodes the entities Google answers with", () => {
    expect(decodeEntities("It&#39;s &quot;a&quot; &lt;b&gt; &amp; &#x41;&nbsp;")).toBe(
      'It\'s "a" <b> & A ',
    );
    expect(decodeEntities("&apos;")).toBe("'");
  });

  it("leaves an unknown named entity as written", () => {
    expect(decodeEntities("&bogus;")).toBe("&bogus;");
  });

  it("escapes what HTML needs escaped", () => {
    expect(escapeHtml(`a<b>&"c"`)).toBe("a&lt;b&gt;&amp;&quot;c&quot;");
    expect(decodeEntities(escapeHtml(`x < y & "z"`))).toBe(`x < y & "z"`);
  });
});

describe("substituteGlossary", () => {
  const glossary = [
    { source: "spread", target: "السبريد" },
    { source: "bid-ask spread", target: "فرق العرض والطلب" },
    { source: "pip", target: "النقطة" },
  ];

  it("replaces whole words in text with the human translation, kept from Google", () => {
    expect(substituteGlossary("<p>A pip is small.</p>", glossary)).toBe(
      `<p>A ${keep("النقطة")} is small.</p>`,
    );
  });

  it("prefers the longest term, and is case-insensitive", () => {
    expect(substituteGlossary("The Bid-Ask Spread widens.", glossary)).toBe(
      `The ${keep("فرق العرض والطلب")} widens.`,
    );
  });

  it("does not match inside a longer word", () => {
    expect(substituteGlossary("A pipeline of pips.", glossary)).toBe("A pipeline of pips.");
  });

  it("never touches a tag or an attribute", () => {
    const html = `<a href="/glossary/pip" title="pip">link</a>`;
    expect(substituteGlossary(html, glossary)).toBe(html);
  });

  it("leaves text already kept, and code, alone", () => {
    const html = `<span translate="no">pip</span> <code>spread</code> <br/>pip`;
    expect(substituteGlossary(html, glossary)).toBe(
      `<span translate="no">pip</span> <code>spread</code> <br/>${keep("النقطة")}`,
    );
  });

  it("escapes a translation that contains markup characters", () => {
    expect(substituteGlossary("pip", [{ source: "pip", target: "<b>&</b>" }])).toBe(
      keep("&lt;b&gt;&amp;&lt;/b&gt;"),
    );
  });

  it("does nothing with an empty glossary or blank pairs", () => {
    expect(substituteGlossary("<p>pip</p>", [])).toBe("<p>pip</p>");
    expect(substituteGlossary("<p>pip</p>", [{ source: " ", target: "x" }])).toBe("<p>pip</p>");
  });

  it("round-trips through stripKeepWrappers, leaving an author's spans", () => {
    const html = `<p><span class="ed-tone-muted">A</span> pip</p>`;
    expect(stripKeepWrappers(substituteGlossary(html, glossary))).toBe(
      `<p><span class="ed-tone-muted">A</span> النقطة</p>`,
    );
  });

  it("strips a wrapper whose attributes Google reordered", () => {
    expect(stripKeepWrappers(`<span ${KEEP_ATTRIBUTE}="1" translate="no">x</span>`)).toBe("x");
  });
});
