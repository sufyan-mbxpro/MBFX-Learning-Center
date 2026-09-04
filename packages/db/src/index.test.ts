import { describe, expect, it } from "vitest";
import { UserType, db } from "./index.ts";

describe("@repo/db", () => {
  it("exports the client singleton and generated enums without needing a live DB connection", () => {
    // The client is a lazy Proxy (see index.ts) — importing the module and
    // reading a re-exported enum must not touch DATABASE_URL at all.
    expect(db).toBeDefined();
    expect(UserType.LEARNER).toBe("LEARNER");
    expect(UserType.STAFF).toBe("STAFF");
  });
});
