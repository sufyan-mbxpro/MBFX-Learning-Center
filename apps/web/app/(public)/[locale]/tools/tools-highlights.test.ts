// The "why use this" band (ADR-114 #3).
//
// Two halves that have to agree and are written in different packages:
// `TOOL_HIGHLIGHT_ICONS` in `@repo/contracts` (the closed list), the seeded
// copy in `@repo/db`, and the component map in `app/_lib`. `@repo/db` does not
// depend on `@repo/contracts` and is not going to, so nothing type-checks the
// seed's `icon` against the list it has to be a member of. This file is what
// joins them.
//
// It also enforces the rule that makes rendering the text as TEXT correct
// rather than lucky: the copy holds no markup. `/support`'s FAQ guard
// (`support-page.test.ts`) is the precedent, and the reasoning is identical —
// a field the renderer prints verbatim must never contain something an author
// expected to be parsed.
import { describe, expect, it } from "vitest";

import { TOOL_HIGHLIGHT_ICONS, TOOL_KEYS, toolHighlightSchema } from "@repo/contracts";
import { TOOL_HIGHLIGHTS } from "../../../../../../packages/db/prisma/seed-tool-highlights.ts";
import {
  TOOL_HIGHLIGHT_ICON_COMPONENTS,
  hasComponentForEveryHighlightIcon,
} from "../../../_lib/tool-highlight-icons.ts";

describe("the glyph registry", () => {
  it("gives every declared name a component", () => {
    // `satisfies Record<ToolHighlightIcon, LucideIcon>` makes this a type error
    // too; the runtime assertion is what a reader of the test file sees.
    expect(hasComponentForEveryHighlightIcon()).toBe(true);
  });

  it("declares no component for a name the contract does not have", () => {
    // The half a `Partial` would let through: an extra entry here is dead
    // weight, a missing one is a gap in a row of four cards.
    expect(Object.keys(TOOL_HIGHLIGHT_ICON_COMPONENTS).sort()).toEqual(
      [...TOOL_HIGHLIGHT_ICONS].sort(),
    );
  });
});

describe("the seeded copy", () => {
  it("gives every registered tool a band", () => {
    // ADR-114 #3's correction to ADR-047 §2: the gate stays, and the data
    // ships in the same change. `/support` shipped with an empty collection
    // and a TODO, and the band it gated never drew (ADR-113).
    for (const key of TOOL_KEYS) {
      const cards = TOOL_HIGHLIGHTS[key];
      expect(cards, `no highlights seeded for "${key}"`).toBeDefined();
      expect(cards!.length, `"${key}" has too few cards to fill the row`).toBeGreaterThanOrEqual(3);
    }
  });

  it("seeds nothing for a key the registry does not know", () => {
    // A row the public page would never read and the admin list would drop.
    expect(Object.keys(TOOL_HIGHLIGHTS).sort()).toEqual([...TOOL_KEYS].sort());
  });

  it("passes the schema the save action runs", () => {
    // The seed writes these rows directly, so they never meet
    // `toolHighlightSchema` at runtime — which is exactly how a too-long
    // title reaches a page and nothing says so. Same reasoning as
    // `check:email-templates`' variable comparison (changes-35).
    for (const [key, cards] of Object.entries(TOOL_HIGHLIGHTS)) {
      for (const card of cards) {
        const parsed = toolHighlightSchema.safeParse(card);
        expect(
          parsed.success,
          `"${key}" → "${card.title}": ${parsed.error?.issues.map((i) => i.message).join("; ")}`,
        ).toBe(true);
      }
    }
  });

  it("names a glyph the contract declares", () => {
    // The join this file exists for. A typo here is not a build error in any
    // package — `parseHighlights` drops the row and the band renders three
    // cards, which is a bug that looks like a design choice.
    for (const [key, cards] of Object.entries(TOOL_HIGHLIGHTS)) {
      for (const card of cards) {
        expect(
          TOOL_HIGHLIGHT_ICONS as readonly string[],
          `"${key}" uses the unknown glyph "${card.icon}"`,
        ).toContain(card.icon);
      }
    }
  });

  it("holds no markup, which is what makes printing it as text correct", () => {
    for (const [key, cards] of Object.entries(TOOL_HIGHLIGHTS)) {
      for (const card of cards) {
        for (const [field, value] of [
          ["title", card.title],
          ["text", card.text],
        ] as const) {
          expect(value, `"${key}" → ${field} contains a tag`).not.toMatch(/<[a-z/!]/i);
          expect(value, `"${key}" → ${field} contains an entity`).not.toMatch(/&[a-z]+;/i);
        }
      }
    }
  });

  it("claims nothing about a broker, and nothing about what the market will do", () => {
    // ADR-113's rule for `SUPPORT_FAQ`, applied to a second body of seeded
    // copy: a fact about a brokerage belongs to the owner, not to a seed file
    // shipped with the software, and a forecast belongs to nobody (ADR-088).
    const forbidden = [
      // "the spread" — the cost, not the verb. Plain "spread" matched
      // "spreading the same risk across correlated markets", which is the
      // correlation tool describing itself correctly.
      "the spread",
      "our spread",
      "leverage of",
      "minimum deposit",
      "withdraw",
      "guarantee",
      "will rise",
      "will fall",
      "best broker",
      "real-time",
      "live rates",
    ];
    for (const [key, cards] of Object.entries(TOOL_HIGHLIGHTS)) {
      for (const card of cards) {
        const prose = `${card.title} ${card.text}`.toLowerCase();
        for (const phrase of forbidden) {
          expect(prose, `"${key}" → "${card.title}" says "${phrase}"`).not.toContain(phrase);
        }
      }
    }
  });
});
