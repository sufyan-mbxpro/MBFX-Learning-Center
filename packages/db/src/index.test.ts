import { describe, expect, it } from "vitest";
import * as db from "./index";

describe("@repo/db", () => {
  it("is importable (scaffold smoke test — real coverage lands in Module 01)", () => {
    expect(db).toBeDefined();
  });
});
