import { describe, expect, it } from "vitest";
import * as rbac from "./index";

describe("@repo/rbac", () => {
  it("is importable (scaffold smoke test — real coverage lands in Module 03)", () => {
    expect(rbac).toBeDefined();
  });
});
