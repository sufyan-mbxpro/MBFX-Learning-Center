// The newsletter contracts after ADR-124: placements are no longer the whole
// set of sources, and the two new writes accept exactly what they need.
import { describe, expect, it } from "vitest";

import {
  NEWSLETTER_PLACEMENTS,
  NEWSLETTER_SOURCES,
  adminAddSubscriberSchema,
  newsletterAccountOptInSchema,
  newsletterSubscribeSchema,
  subscriberFilterSchema,
} from "./newsletter.ts";

describe("placements and sources (ADR-124)", () => {
  it("keeps the four placements, and sources add signup and admin to them", () => {
    expect(NEWSLETTER_PLACEMENTS).toEqual(["footer", "home", "news", "analysis"]);
    expect(NEWSLETTER_SOURCES).toEqual(["footer", "home", "news", "analysis", "signup", "admin"]);
  });

  it("the anonymous form may only claim a placement, never signup or admin", () => {
    // A tampered form claiming `admin` would plant a row that reads as an
    // administrator's invitation on the list screen.
    for (const source of ["signup", "admin"]) {
      expect(
        newsletterSubscribeSchema.safeParse({ email: "a@example.test", locale: "en", source })
          .success,
      ).toBe(false);
    }
    expect(
      newsletterSubscribeSchema.safeParse({ email: "a@example.test", locale: "en", source: "news" })
        .success,
    ).toBe(true);
  });

  it("the admin filter accepts every source", () => {
    for (const source of NEWSLETTER_SOURCES) {
      expect(subscriberFilterSchema.safeParse({ source }).success).toBe(true);
    }
  });
});

describe("newsletterAccountOptInSchema", () => {
  it("takes a locale and nothing that names a mailbox", () => {
    const parsed = newsletterAccountOptInSchema.parse({
      locale: "en",
      email: "victim@example.test",
      userId: "someone-else",
    });
    // Unknown keys are stripped: the address can only come from the session.
    expect(parsed).toEqual({ locale: "en" });
  });

  it("refuses a missing or oversized locale", () => {
    expect(newsletterAccountOptInSchema.safeParse({}).success).toBe(false);
    expect(newsletterAccountOptInSchema.safeParse({ locale: "x".repeat(11) }).success).toBe(false);
  });
});

describe("adminAddSubscriberSchema", () => {
  it("normalises the address the way the public form does", () => {
    const parsed = adminAddSubscriberSchema.parse({
      email: "  Reader@Example.TEST ",
      locale: "en",
    });
    expect(parsed.email).toBe("reader@example.test");
  });

  it("refuses a malformed address, an overlong one, and a missing locale", () => {
    expect(
      adminAddSubscriberSchema.safeParse({ email: "not-an-email", locale: "en" }).success,
    ).toBe(false);
    expect(
      adminAddSubscriberSchema.safeParse({ email: `${"a".repeat(250)}@example.test`, locale: "en" })
        .success,
    ).toBe(false);
    expect(adminAddSubscriberSchema.safeParse({ email: "a@example.test" }).success).toBe(false);
  });

  it("cannot be used to set a status or a source", () => {
    const parsed = adminAddSubscriberSchema.parse({
      email: "a@example.test",
      locale: "en",
      status: "ACTIVE",
      source: "footer",
    });
    expect(parsed).toEqual({ email: "a@example.test", locale: "en" });
  });
});
