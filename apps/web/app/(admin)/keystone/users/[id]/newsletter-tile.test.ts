// changes-55 §11: the Controls card's Newsletter tile compared the stored
// subscriber status against "CONFIRMED", which `SubscriberStatus` has never
// had (PENDING | ACTIVE | UNSUBSCRIBED), so the tile was never ticked — not
// even for a confirmed subscriber. `loadUserDetail` now types the field as the
// enum, so a wrong literal fails `tsc`; this guard names the bug in English.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(join(import.meta.dirname, "page.tsx"), "utf8");

// Read from the schema, not imported: an app never depends on `@repo/db`
// (architecture.md #2), and the schema is where the enum is defined.
const schema = readFileSync(
  join(import.meta.dirname, "../../../../../../../packages/db/prisma/schema.prisma"),
  "utf8",
);
const enumBody = /enum SubscriberStatus \{([^}]*)\}/.exec(schema)?.[1] ?? "";
const subscriberStatuses = [...enumBody.matchAll(/^\s*([A-Z_]+)\b/gm)].map((match) => match[1]);

describe("the user detail Newsletter tile", () => {
  it("ticks for an ACTIVE subscription", () => {
    expect(page).toContain('checked={user.newsletter?.status === "ACTIVE"}');
  });

  it("compares only against statuses the enum actually has", () => {
    expect(subscriberStatuses).toEqual(["PENDING", "ACTIVE", "UNSUBSCRIBED"]);
    const compared = [...page.matchAll(/newsletter\?\.status === "([A-Z_]+)"/g)].map(
      (match) => match[1],
    );
    expect(compared.length).toBeGreaterThan(0);
    for (const status of compared) {
      expect(subscriberStatuses).toContain(status);
    }
  });
});
