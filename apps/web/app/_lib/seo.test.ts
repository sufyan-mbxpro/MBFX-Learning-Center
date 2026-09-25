// The pure halves of the public SEO helpers. `languageAlternates` reads the
// servable locales from the database and is covered by the source guards in
// `seo-metadata.test.ts` instead.
import { describe, expect, it } from "vitest";
import {
  descriptionFrom,
  jsonLd,
  localizedPath,
  pagedCanonical,
  titleFrom,
  truncateHeadline,
} from "./seo.ts";

describe("descriptionFrom", () => {
  it("takes the first candidate with text", () => {
    expect(descriptionFrom(null, "  ", "Plain line", "later")).toEqual({
      description: "Plain line",
    });
  });

  it("returns NO key when nothing has text, so the layout's description survives", () => {
    const result = descriptionFrom(undefined, null, "");
    expect(result).toEqual({});
    expect("description" in result).toBe(false);
  });
});

describe("localizedPath", () => {
  it("leaves the default locale unprefixed and prefixes the rest", () => {
    expect(localizedPath("en", "/tools/pip-value")).toBe("/tools/pip-value");
    expect(localizedPath("es", "/tools/pip-value")).toBe("/es/tools/pip-value");
    expect(localizedPath("es", "/")).toBe("/es");
  });
});

describe("pagedCanonical", () => {
  it("keeps the page number past the first page and nothing else", () => {
    expect(pagedCanonical("/news", 0)).toBe("/news");
    expect(pagedCanonical("/news", 3)).toBe("/news?page=3");
  });
});

describe("jsonLd", () => {
  it("cannot close its own script element", () => {
    const body = jsonLd({ name: "</script><script>alert(1)</script>" });
    expect(body).not.toContain("</script>");
    expect(JSON.parse(body)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});

describe("titleFrom", () => {
  it("puts the page title into the template", () => {
    expect(titleFrom("%s | MBX Pro", "Pip Calculator")).toBe("Pip Calculator | MBX Pro");
  });

  it("keeps a dollar sign in an admin-typed title literally", () => {
    // A string replacer would read `$&` as "the match" and `$$` as "$".
    expect(titleFrom("%s | Site", "Earn $$ with $& tips")).toBe("Earn $$ with $& tips | Site");
  });
});

describe("truncateHeadline", () => {
  it("leaves a short title alone", () => {
    expect(truncateHeadline("How a rate decision moves EUR/USD")).toBe(
      "How a rate decision moves EUR/USD",
    );
  });

  it("cuts a long one on a word boundary to Google's 110", () => {
    const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    const cut = truncateHeadline(long);
    expect(cut.length).toBeLessThanOrEqual(110);
    expect(cut.endsWith("…")).toBe(true);
    expect(long.startsWith(cut.slice(0, -1))).toBe(true);
  });
});
