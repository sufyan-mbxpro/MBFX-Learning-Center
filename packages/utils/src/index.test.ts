import { describe, expect, it } from "vitest";
import * as utils from "./index";

describe("@repo/utils", () => {
  it("is importable (scaffold smoke test — real coverage lands per consuming module)", () => {
    expect(utils).toBeDefined();
  });
});
