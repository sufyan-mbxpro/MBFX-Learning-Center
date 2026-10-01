import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "@formatjs/icu-messageformat-parser";
import { printAST } from "@formatjs/icu-messageformat-parser/printer.js";
import { describe, expect, it } from "vitest";

import {
  PlaceholderMismatchError,
  planMessage,
  rebuildMessage,
  translateCatalogMessages,
  UnsupportedMessageError,
} from "./icu.ts";

/** A translator that returns every unit unchanged. */
const identity = async (units: string[]) => units;

/** The fake Google: "[xx] " in front of each unit. */
const prefix = (locale: string) => async (units: string[]) => units.map((u) => `[${locale}] ${u}`);

function flatten(value: unknown, prefix = ""): Array<[string, string]> {
  if (typeof value === "string") return [[prefix, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

describe("planMessage", () => {
  it("protects arguments and keeps tags as translatable spans", () => {
    const plan = planMessage("Hello {name}, read <link>the guide</link>.");
    expect(plan.units).toEqual([
      'Hello <span translate="no" data-ph="0">{name}</span>, read <span data-tg="0">the guide</span>.',
    ]);
  });

  it("escapes literal text for the HTML request", () => {
    expect(planMessage("a & b").units).toEqual(["a &amp; b"]);
  });

  it("lifts a plural so each branch is a whole sentence", () => {
    const plan = planMessage("You have {n, plural, one {# lesson} other {# lessons}} left");
    expect(plan.units).toEqual([
      'You have <span translate="no" data-ph="0">#</span> lesson left',
      'You have <span translate="no" data-ph="0">#</span> lessons left',
    ]);
  });

  it("refuses a plural inside a tag, which cannot be lifted", () => {
    expect(() => planMessage("<b>{n, plural, one {a} other {b}}</b>")).toThrow(
      UnsupportedMessageError,
    );
  });

  it("expands two selectors into every combination, each a whole sentence", () => {
    const plan = planMessage("{a, select, x {1} other {2}} and {n, plural, one {c} other {d}}");
    expect(plan.units).toEqual(["1 and c", "1 and d", "2 and c", "2 and d"]);
    const rebuilt = rebuildMessage(plan, ["1 y c", "1 y d", "2 y c", "2 y d"], "es");
    expect(parse(rebuilt.message)).toHaveLength(1);
    expect(rebuilt.message).toContain("1 y c");
  });

  it("refuses a message that is not valid ICU", () => {
    expect(() => planMessage("broken {")).toThrow(UnsupportedMessageError);
  });
});

describe("rebuildMessage", () => {
  it("puts arguments and tags back where the translator moved them", () => {
    const plan = planMessage("Hello {name}, read <link>the guide</link>.");
    const rebuilt = rebuildMessage(
      plan,
      ['Lee <span data-tg="0">la guía</span>, <span translate="no" data-ph="0">x</span>.'],
      "es",
    );
    expect(rebuilt.message).toBe("Lee <link>la guía</link>, {name}.");
    expect(rebuilt.pluralsRebuilt).toBe(false);
  });

  it("decodes entities Google returns", () => {
    const plan = planMessage("It is {name}");
    expect(
      rebuildMessage(plan, ['C&#39;est <span translate="no" data-ph="0">{name}</span>'], "fr")
        .message,
    ).toBe("C'est {name}");
  });

  it("keeps a span Google added, dropping only the element", () => {
    const plan = planMessage("Hi {name}");
    expect(
      rebuildMessage(
        plan,
        ['<span class="x">Hola</span> <span translate="no" data-ph="0">{name}</span>'],
        "es",
      ).message,
    ).toBe("Hola {name}");
  });

  it("keeps a placeholder Google wrapped in a span of its own", () => {
    const plan = planMessage("Hi {name}");
    expect(
      rebuildMessage(
        plan,
        ['<span class="x">Hola <span translate="no" data-ph="0">{name}</span></span>'],
        "es",
      ).message,
    ).toBe("Hola {name}");
  });

  it("refuses an unknown tag", () => {
    const plan = planMessage("<b>Bold</b>");
    expect(() => rebuildMessage(plan, ['<span data-tg="3">x</span>'], "es")).toThrow(
      PlaceholderMismatchError,
    );
  });

  it("builds Arabic's six plural forms from English's two, and says so", () => {
    const plan = planMessage("{n, plural, one {# lesson} other {# lessons}}");
    const rebuilt = rebuildMessage(
      plan,
      ["ONE #", "OTHER #"].map((t) => t.replace("#", '<span translate="no" data-ph="0">#</span>')),
      "ar",
    );
    const ast = parse(rebuilt.message);
    const options = (ast[0] as { options: Record<string, unknown> }).options;
    expect(Object.keys(options)).toEqual(["zero", "one", "two", "few", "many", "other"]);
    // The printer writes the compact form; both are the same ICU.
    expect(rebuilt.message).toContain("one{ONE #}");
    expect(rebuilt.message).toContain("few{OTHER #}");
    expect(rebuilt.pluralsRebuilt).toBe(true);
  });

  it("keeps exact matches and drops categories the target does not have", () => {
    const plan = planMessage("{n, plural, =0 {none} one {one} other {many}}");
    const rebuilt = rebuildMessage(plan, ["none", "one", "many"], "ja");
    const options = (parse(rebuilt.message)[0] as { options: Record<string, unknown> }).options;
    expect(Object.keys(options).sort()).toEqual(["=0", "other"]);
    expect(rebuilt.pluralsRebuilt).toBe(true);
  });

  it("keeps a select's keys", () => {
    const plan = planMessage("{kind, select, article {Read it} other {Open it}}");
    expect(rebuildMessage(plan, ["Léelo", "Ábrelo"], "es").message).toBe(
      "{kind,select,article{Léelo} other{Ábrelo}}",
    );
  });

  it("refuses a lost, repeated or invented placeholder", () => {
    const plan = planMessage("Hi {name}");
    expect(() => rebuildMessage(plan, ["Hola"], "es")).toThrow(PlaceholderMismatchError);
    expect(() =>
      rebuildMessage(plan, ['<span data-ph="0">a</span> <span data-ph="0">b</span>'], "es"),
    ).toThrow(PlaceholderMismatchError);
    expect(() => rebuildMessage(plan, ['<span data-ph="7">a</span>'], "es")).toThrow(
      PlaceholderMismatchError,
    );
  });

  it("refuses unbalanced markup and a missing unit", () => {
    const plan = planMessage("Hi {name}");
    expect(() => rebuildMessage(plan, ['<span data-ph="0">a'], "es")).toThrow(
      PlaceholderMismatchError,
    );
    expect(() => rebuildMessage(plan, ["</span>"], "es")).toThrow(PlaceholderMismatchError);
    expect(() => rebuildMessage(plan, [], "es")).toThrow(PlaceholderMismatchError);
  });

  it("refuses a lost tag", () => {
    const plan = planMessage("<b>Bold</b> text");
    expect(() => rebuildMessage(plan, ["Negrita texto"], "es")).toThrow(PlaceholderMismatchError);
  });
});

describe("translateCatalogMessages", () => {
  it("translates across keys in one call and reports what it could not do", async () => {
    let calls = 0;
    const result = await translateCatalogMessages(
      {
        "a.greeting": "Hello {name}",
        "a.count": "{n, plural, one {# item} other {# items}}",
        "a.broken": "oops {",
      },
      "ar",
      async (units) => {
        calls += 1;
        return prefix("ar")(units);
      },
    );
    expect(calls).toBe(1);
    expect(result.translated["a.greeting"]).toBe("[ar] Hello {name}");
    expect(result.review).toEqual(["a.count"]);
    expect(result.failed.map((f) => f.key)).toEqual(["a.broken"]);
  });

  it("does not call the translator for nothing", async () => {
    let called = false;
    await translateCatalogMessages({}, "ar", async (u) => {
      called = true;
      return u;
    });
    expect(called).toBe(false);
  });

  it("reports a key the translator broke", async () => {
    const result = await translateCatalogMessages({ k: "Hi {name}" }, "es", async () => ["Hola"]);
    expect(result.failed).toEqual([{ key: "k", reason: expect.stringContaining("argument") }]);
  });
});

describe("every public message in en.json survives the round trip", () => {
  // The whole catalog, planned and rebuilt with an identity translator. A
  // message this pipeline would corrupt fails here, before any money is spent.
  const en = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../i18n/messages/en.json", import.meta.url)), "utf8"),
  ) as Record<string, unknown>;
  const publicMessages = Object.fromEntries(
    flatten(en).filter(([key]) => !["admin", "cms"].includes(key.split(".")[0] ?? "")),
  );

  it("plans and rebuilds every message without loss", async () => {
    const result = await translateCatalogMessages(publicMessages, "en", identity);
    expect(result.failed).toEqual([]);
    expect(Object.keys(result.translated)).toHaveLength(Object.keys(publicMessages).length);
  });

  it("gives back the canonical form of every message with no plural", async () => {
    const result = await translateCatalogMessages(publicMessages, "en", identity);
    for (const [key, message] of Object.entries(publicMessages)) {
      if (/\{[^{}]*,\s*(plural|select|selectordinal)\s*,/.test(message)) continue;
      expect(result.translated[key], key).toBe(printAST(parse(message)));
    }
  });
});
