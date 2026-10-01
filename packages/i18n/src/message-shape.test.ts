import { describe, expect, it } from "vitest";
import { checkMessageShape } from "./message-shape.ts";

describe("checkMessageShape (ADR-178 #4)", () => {
  it("accepts plain text and a faithful replacement", () => {
    expect(checkMessageShape("Start learning", "Commencer")).toBeNull();
    expect(checkMessageShape("Hello {name}", "Bonjour {name}")).toBeNull();
    expect(checkMessageShape("Read <link>more</link>", "Lire <link>la suite</link>")).toBeNull();
  });

  it("lets plural categories differ by language", () => {
    expect(
      checkMessageShape(
        "{count, plural, one {# lesson} other {# lessons}}",
        "{count, plural, zero {لا دروس} one {درس} two {درسان} few {# دروس} many {# درسًا} other {# درس}}",
      ),
    ).toBeNull();
  });

  it("refuses broken ICU, a lost or renamed argument, and a lost tag", () => {
    expect(checkMessageShape("Hello {name}", "Bonjour {name")).toBe("invalidSyntax");
    expect(checkMessageShape("Hello {name}", "Bonjour")).toBe("argumentsDiffer");
    expect(checkMessageShape("Hello {name}", "Bonjour {nom}")).toBe("argumentsDiffer");
    expect(checkMessageShape("Read <link>more</link>", "Lire la suite")).toBe("tagsDiffer");
    expect(checkMessageShape("{n, plural, one {#} other {#}}", "{n, plural, one {#}}")).toBe(
      "invalidSyntax",
    );
  });

  it("checks only syntax when the English itself does not parse", () => {
    expect(checkMessageShape("Broken {", "Cassé")).toBeNull();
  });
});
