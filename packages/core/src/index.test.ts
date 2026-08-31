import { describe, expect, it } from "vitest";
import * as core from "./index";

describe("@repo/core", () => {
  it("is importable (scaffold smoke test — real coverage lands in Modules 08/11/13)", () => {
    expect(core).toBeDefined();
  });
});
