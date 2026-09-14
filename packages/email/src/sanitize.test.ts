// The email allowlist is WIDER than the site's rich-text one (table layout,
// inline styles), so it gets its own corpus. Everything here is something a
// template author could paste, deliberately or by accident.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { sanitizeEmailHtml } from "./sanitize.ts";

const XSS_CORPUS = [
  `<script>alert(1)</script>`,
  `<img src=x onerror="alert(1)">`,
  `<a href="javascript:alert(1)">click</a>`,
  `<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">click</a>`,
  `<iframe src="https://evil.example"></iframe>`,
  `<object data="evil.swf"></object>`,
  `<embed src="evil.swf">`,
  `<form action="https://evil.example"><input name="password"></form>`,
  `<body onload="alert(1)">hi</body>`,
  `<div onclick="alert(1)">hi</div>`,
  `<svg/onload=alert(1)>`,
  `<math><mtext><script>alert(1)</script></mtext></math>`,
  `<a href="vbscript:msgbox(1)">click</a>`,
  `<link rel="stylesheet" href="https://evil.example/x.css">`,
  `<meta http-equiv="refresh" content="0;url=https://evil.example">`,
  `<base href="https://evil.example/">`,
  `<img src="https://evil.example/pixel.gif" onmouseover="alert(1)">`,
  `<style>@import url(https://evil.example/x.css);</style>`,
];

const FORBIDDEN = /<script|<iframe|<object|<embed|<form|<input|<link|<meta|<base|\son\w+\s*=/i;

/**
 * The schemes that EXECUTE, checked per URL attribute — and as a denylist,
 * because both obvious shortcuts test the wrong thing. A substring search
 * fails on `class="javascript:alert(1)"`, which is inert; an allowlist of
 * URL shapes fails on a relative `src="x"`, which is ordinary. What must
 * never survive is a scheme a mail client will run.
 */
const DANGEROUS_SCHEME = /^\s*(javascript|vbscript|data|file):/i;

function urlAttributes(html: string): string[] {
  return [...html.matchAll(/(?:href|src)\s*=\s*"([^"]*)"/gi)].map((match) => match[1] ?? "");
}

function expectNoExecutableUrls(html: string) {
  for (const url of urlAttributes(html)) {
    expect(url, `dangerous URL survived: ${url}`).not.toMatch(DANGEROUS_SCHEME);
  }
}

describe("sanitizeEmailHtml", () => {
  it.each(XSS_CORPUS)("neutralises %s", (input) => {
    for (const mode of ["RICH", "HTML"] as const) {
      const output = sanitizeEmailHtml(input, mode);
      expect(output).not.toMatch(FORBIDDEN);
      expectNoExecutableUrls(output);
    }
  });

  it("keeps the table layout email actually needs", () => {
    const html = `<table role="presentation" width="600" cellpadding="0" bgcolor="#ffffff"><tr><td align="center" style="padding:16px;color:#111111">hi</td></tr></table>`;
    const output = sanitizeEmailHtml(html, "RICH");
    expect(output).toContain("<table");
    expect(output).toContain('width="600"');
    expect(output).toContain('bgcolor="#ffffff"');
    expect(output).toContain("padding:16px");
  });

  it("keeps an http(s) link and a mailto", () => {
    const output = sanitizeEmailHtml(
      `<a href="https://example.com">a</a><a href="mailto:x@example.com">b</a>`,
      "RICH",
    );
    expect(output).toContain("https://example.com");
    expect(output).toContain("mailto:x@example.com");
  });

  it("keeps an unsubstituted variable in an href, because it is not a URL yet", () => {
    // The sanitiser sees a relative path. render.ts is what validates the
    // value that replaces it.
    expect(sanitizeEmailHtml(`<a href="{{reset.url}}">reset</a>`, "RICH")).toContain(
      "{{reset.url}}",
    );
  });

  it("drops a style ELEMENT in rich mode and keeps it in HTML mode", () => {
    const html = `<style>.x{color:red}</style><p>hi</p>`;
    expect(sanitizeEmailHtml(html, "RICH")).not.toContain("<style");
    // A hand-built email needs media queries to survive (ADR-078 #7); it is
    // only ever rendered inside a sandboxed frame on our side.
    const asDocument = sanitizeEmailHtml(html, "HTML");
    expect(asDocument).toContain("<style");
    expect(asDocument).toContain("color:red");
  });

  it("strips a style property that is not on the allowlist", () => {
    const output = sanitizeEmailHtml(
      `<p style="color:#111111;position:fixed;behavior:url(x.htc)">hi</p>`,
      "RICH",
    );
    expect(output).toContain("color:#111111");
    expect(output).not.toContain("position:fixed");
    expect(output).not.toContain("behavior");
  });

  it("keeps the text of an unknown wrapper rather than the wrapper", () => {
    expect(sanitizeEmailHtml(`<section><p>kept</p></section>`, "RICH")).toContain("kept");
  });

  it("never emits an executable construct, for any input (property)", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (raw) => {
        for (const mode of ["RICH", "HTML"] as const) {
          expect(sanitizeEmailHtml(raw, mode)).not.toMatch(FORBIDDEN);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("never emits an executable construct when fed real-looking markup (property)", () => {
    const tag = fc.constantFrom("script", "iframe", "img", "a", "div", "style", "form", "p");
    const attr = fc.constantFrom("onerror", "onclick", "href", "src", "style", "class");
    const value = fc.constantFrom("javascript:alert(1)", "alert(1)", "https://ok.example", "x");
    const markup = fc
      .tuple(tag, attr, value, fc.string({ maxLength: 40 }))
      .map(([t, a, v, text]) => `<${t} ${a}="${v}">${text}</${t}>`);

    fc.assert(
      fc.property(markup, (html) => {
        for (const mode of ["RICH", "HTML"] as const) {
          const output = sanitizeEmailHtml(html, mode);
          expect(output).not.toMatch(FORBIDDEN);
          expectNoExecutableUrls(output);
        }
      }),
      { numRuns: 300 },
    );
  });
});
