// changes-36 — the footer is a sitemap, and this is the test that makes that
// a fact rather than a comment.
//
// The sentence "every destination the header offers has a footer row too" has
// been at the top of the footer seed since Module 08. It stopped being true
// twice without anything failing: ADR-065 split Learn into two schools with
// four surfaces each, and ADR-086 put eight calculators behind one link. By
// the time the owner asked for it ("add all the available menu options in the
// footer... place all tools in the footer"), the header offered thirty-three
// destinations and the footer listed eight.
//
// Nothing catches that on its own, because both lists are valid data: every
// row resolves, every column renders, and the only symptom is a reader who
// cannot get to a calculator from the bottom of the page.
//
// A SOURCE guard, like `permission-groups.test.ts` and `role-exclusions.test.ts`
// beside it and for the same reason: the seed is a script that connects to a
// database, so importing it to inspect an array of literals would mean
// standing up MariaDB to compare two lists of strings.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const seed = readFileSync(fileURLToPath(new URL("../prisma/seed.ts", import.meta.url)), "utf8");

/**
 * The seed with its comments removed.
 *
 * A source guard that reads comments fails on its own explanation — the note
 * above `FOOTER_MENUS` names `footer_learn` while saying it is no longer
 * seeded, which a naive scan reads as the opposite of what happened. The
 * `tools-area.test.ts` header records the same trap.
 */
const code = seed
  .split("\n")
  .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
  .join("\n");

/** The text of a `const NAME = ...;` declaration, comments already stripped. */
function block(name: string, terminator: string): string {
  const start = code.indexOf(`const ${name} = `);
  expect(start, `${name} not found in seed.ts`).toBeGreaterThan(-1);
  const end = code.indexOf(terminator, start);
  expect(end, `${name} has no ${terminator} terminator`).toBeGreaterThan(-1);
  return code.slice(start, end);
}

/** Every `routeKey: "..."` (or a template literal's track-substituted form). */
function routeKeys(source: string): string[] {
  const literal = [...source.matchAll(/routeKey:\s*"([\w-]+)"/g)].map((m) => m[1]!);
  // `routeKey: \`learn-${track}-videos\`` — the two school menus and the two
  // header trees are both built by mapping over the tracks, so the keys exist
  // only as templates. Expanded here against the same two tracks the seed maps
  // over; a third school would need adding in both places, which is ADR-065's
  // own "adding a track means" list.
  const templated = [...source.matchAll(/routeKey:\s*`learn-\$\{track\}([\w-]*)`/g)].flatMap((m) =>
    ["forex", "crypto"].map((track) => `learn-${track}${m[1]!}`),
  );
  return [...new Set([...literal, ...templated])];
}

const headerKeys = new Set([
  ...routeKeys(block("NAV", "];")),
  ...routeKeys(block("TRACK_NAV", "}));")),
  ...routeKeys(block("TOOLS_NAV", "};")),
]);

const footerKeys = new Set([
  ...routeKeys(block("FOOTER_TRACK_MENUS", "}));")),
  ...routeKeys(block("FOOTER_MENUS", "] satisfies {")),
]);

describe("the footer is a sitemap", () => {
  it("has a row for every destination the header offers", () => {
    const missing = [...headerKeys].filter((key) => !footerKeys.has(key)).sort();
    expect(missing, "header destinations with no footer row").toEqual([]);
  });

  it("carries all eleven tools, which is the ask this change answers", () => {
    // Eight from changes-25, three more from changes-41 (ADR-135).
    const tools = [...footerKeys].filter((key) => key.startsWith("tool-"));
    expect(tools).toHaveLength(11);
  });

  it("carries both schools' four surfaces", () => {
    for (const track of ["forex", "crypto"]) {
      for (const suffix of ["", "-videos", "-quizzes", "-glossary"]) {
        expect(footerKeys.has(`learn-${track}${suffix}`), `learn-${track}${suffix}`).toBe(true);
      }
    }
  });

  it("points nowhere the header does not — a footer row is a second door, not a new one", () => {
    // The two exceptions are the pages that have no header entry BY DESIGN:
    // `sitemap` is reached from the footer alone (ADR-110), and `support` is
    // a flat header row that is also a company-column row.
    const extra = [...footerKeys].filter((key) => !headerKeys.has(key) && key !== "sitemap").sort();
    expect(extra).toEqual([]);
  });
});

describe("footer.menuColumns names exactly the menus the seed creates", () => {
  const columnKeys = [...block("SETTINGS", "];").matchAll(/menuKey:\s*"([\w-]+)"/g)].map(
    (m) => m[1]!,
  );

  const menuKeys = [
    ...block("FOOTER_TRACK_MENUS", "}));").matchAll(/key:\s*`(footer_learn_)\$\{track\}`/g),
  ]
    .flatMap(() => ["footer_learn_forex", "footer_learn_crypto"])
    .concat(
      [...block("FOOTER_MENUS", "] satisfies {").matchAll(/key:\s*"(footer_\w+)"/g)].map(
        (m) => m[1]!,
      ),
    );

  it("lists every seeded footer menu, and no menu it does not seed", () => {
    // A column naming a menu that does not exist renders nothing — `buildMenu`
    // returns an empty list and `footer.tsx` filters it out — so the failure
    // mode is a column that silently disappears, which is exactly the kind of
    // thing a person notices six weeks later.
    expect([...columnKeys].sort()).toEqual([...new Set(menuKeys)].sort());
  });

  it("does not seed footer_learn, whose two schools replaced it", () => {
    // Not deleted from existing databases, deliberately: an install whose
    // `footer.menuColumns` the changes-36 migration could not safely rewrite
    // still needs its Learn column to resolve. It is simply never created
    // again. Seeding a menu that nothing lists is the defect this change-set
    // removed from the settings table in the same breath (code-style.md #28).
    expect(menuKeys).not.toContain("footer_learn");
  });
});

describe("settings the seed no longer ships", () => {
  it("does not seed site.faviconUrl — the favicon is a BrandAsset", () => {
    // code-style.md #28. It was typed, grouped, admin-editable and read by
    // nothing: `faviconIcons()` in both root layouts reads the `favicon`
    // BrandAsset that Theme → Logos & Favicons writes. An admin could fill
    // this in, see "Saved", and change no page on the site.
    expect(code).not.toMatch(/"general",\s*"site\.faviconUrl"/);
  });
});
