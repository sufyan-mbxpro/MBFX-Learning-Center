import { describe, expect, it } from "vitest";
import { DESK_SEATS, deskEntries } from "./desk-entries.ts";

const news = ["n1", "n2", "n3", "n4"];
const analysis = ["a1", "a2", "a3", "a4"];

describe("deskEntries — the desk band's four seats (ADR-121 §1)", () => {
  it("splits the row evenly when both feeds are full", () => {
    expect(deskEntries(news, analysis)).toEqual(["n1", "n2", "a1", "a2"]);
  });

  it("gives a short analysis feed's seats to news", () => {
    expect(deskEntries(news, ["a1"])).toEqual(["n1", "n2", "n3", "a1"]);
  });

  it("gives a short news feed's seats to analysis", () => {
    expect(deskEntries(["n1"], analysis)).toEqual(["n1", "a1", "a2", "a3"]);
  });

  it("fills the row from one feed when the other is absent", () => {
    expect(deskEntries([], analysis)).toEqual(analysis);
    expect(deskEntries(news, [])).toEqual(news);
  });

  it("never exceeds the seats, and is empty when both feeds are", () => {
    expect(deskEntries(news, analysis)).toHaveLength(DESK_SEATS);
    expect(deskEntries([], [])).toEqual([]);
    expect(deskEntries(["n1"], ["a1"])).toEqual(["n1", "a1"]);
  });
});
