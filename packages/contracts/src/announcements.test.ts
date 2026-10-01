import { describe, expect, it } from "vitest";
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_KINDS,
  ANNOUNCEMENT_TEMPLATE_KEYS,
  MAX_AUDIENCE_COURSES,
  MAX_AUDIENCE_USERS,
  announcementAudienceSchema,
  announcementSaveSchema,
  announcementScheduleSchema,
  announcementUserSearchSchema,
  emailSuppressionSchema,
  normaliseEmail,
  unsubscribeTokenSchema,
} from "./announcements.ts";
import { EMAIL_TEMPLATES } from "./email.ts";

const ids = (n: number, prefix = "id") => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe("the registries (ADR-171 #6)", () => {
  it("is courses only in Phase 1", () => {
    expect([...ANNOUNCEMENT_KINDS]).toEqual(["COURSE"]);
  });

  it("offers no audience the data model cannot back", () => {
    // KYC and deposits have no column; a card for them would count zero.
    expect(ANNOUNCEMENT_AUDIENCES).not.toContain("kyc_verified");
    expect(ANNOUNCEMENT_AUDIENCES).not.toContain("top_depositors");
    expect(new Set(ANNOUNCEMENT_AUDIENCES).size).toBe(ANNOUNCEMENT_AUDIENCES.length);
  });

  it("names a registered email template for every kind", () => {
    for (const kind of ANNOUNCEMENT_KINDS) {
      expect(Object.keys(EMAIL_TEMPLATES)).toContain(ANNOUNCEMENT_TEMPLATE_KEYS[kind]);
    }
  });
});

describe("announcementAudienceSchema", () => {
  it("accepts a plain selection of cards", () => {
    expect(
      announcementAudienceSchema.safeParse({ keys: ["verified", "subscribers"] }).success,
    ).toBe(true);
  });

  it("refuses an unknown key, an empty selection and a repeated key", () => {
    expect(announcementAudienceSchema.safeParse({ keys: ["kyc_verified"] }).success).toBe(false);
    expect(announcementAudienceSchema.safeParse({ keys: [] }).success).toBe(false);
    expect(announcementAudienceSchema.safeParse({ keys: ["active", "active"] }).success).toBe(
      false,
    );
  });

  it("requires ids exactly when their card is picked", () => {
    expect(announcementAudienceSchema.safeParse({ keys: ["course_learners"] }).success).toBe(false);
    expect(announcementAudienceSchema.safeParse({ keys: ["custom"], userIds: [] }).success).toBe(
      false,
    );
    expect(
      announcementAudienceSchema.safeParse({ keys: ["custom"], userIds: ["u1"] }).success,
    ).toBe(true);
    // A list of people nobody chose to email.
    expect(
      announcementAudienceSchema.safeParse({ keys: ["active"], userIds: ["u1"] }).success,
    ).toBe(false);
    expect(
      announcementAudienceSchema.safeParse({ keys: ["active"], courseIds: ["c1"] }).success,
    ).toBe(false);
  });

  it("caps course and user ids", () => {
    expect(
      announcementAudienceSchema.safeParse({
        keys: ["course_learners"],
        courseIds: ids(MAX_AUDIENCE_COURSES),
      }).success,
    ).toBe(true);
    expect(
      announcementAudienceSchema.safeParse({
        keys: ["course_learners"],
        courseIds: ids(MAX_AUDIENCE_COURSES + 1),
      }).success,
    ).toBe(false);
    expect(
      announcementAudienceSchema.safeParse({
        keys: ["custom"],
        userIds: ids(MAX_AUDIENCE_USERS + 1),
      }).success,
    ).toBe(false);
  });

  it("refuses a field it does not name (parse, don't spread)", () => {
    expect(
      announcementAudienceSchema.safeParse({ keys: ["active"], emails: ["x@example.test"] })
        .success,
    ).toBe(false);
  });
});

describe("announcementSaveSchema", () => {
  const base = { kind: "COURSE", targetId: "c1", name: "Forex Basics — launch" };

  it("reads an empty subject and note as the template's own", () => {
    const parsed = announcementSaveSchema.parse({ ...base, subject: "", message: "  " });
    expect(parsed.subject).toBeNull();
    expect(parsed.message).toBeNull();
  });

  it("strips CR/LF from the subject so it cannot inject a header", () => {
    const parsed = announcementSaveSchema.parse({ ...base, subject: "New\r\nBcc: x@evil.test" });
    expect(parsed.subject).toBe("New Bcc: x@evil.test");
    expect(parsed.subject).not.toMatch(/[\r\n]/);
  });

  it("bounds the note and the name", () => {
    expect(announcementSaveSchema.safeParse({ ...base, message: "x".repeat(500) }).success).toBe(
      true,
    );
    expect(announcementSaveSchema.safeParse({ ...base, message: "x".repeat(501) }).success).toBe(
      false,
    );
    expect(announcementSaveSchema.safeParse({ ...base, name: " \n " }).success).toBe(false);
  });

  it("refuses a kind outside the registry", () => {
    expect(announcementSaveSchema.safeParse({ ...base, kind: "ARTICLE" }).success).toBe(false);
  });

  it("allows a draft without an audience yet", () => {
    expect(announcementSaveSchema.safeParse(base).success).toBe(true);
  });
});

describe("the small schemas", () => {
  it("coerces a schedule instant", () => {
    const parsed = announcementScheduleSchema.parse({
      id: "a1",
      scheduledFor: "2026-10-14T09:00:00.000Z",
    });
    expect(parsed.scheduledFor.toISOString()).toBe("2026-10-14T09:00:00.000Z");
  });

  it("refuses an empty user search", () => {
    expect(announcementUserSearchSchema.safeParse({ query: "   " }).success).toBe(false);
  });

  it("normalises a suppression address the one way", () => {
    expect(emailSuppressionSchema.parse({ email: "  Reader@Example.TEST " }).email).toBe(
      "reader@example.test",
    );
    expect(normaliseEmail("  Reader@Example.TEST ")).toBe("reader@example.test");
  });
});

describe("unsubscribeTokenSchema (shape only)", () => {
  const sig = "A".repeat(43);

  it("accepts the v1 shape", () => {
    expect(unsubscribeTokenSchema.safeParse(`v1.dTpjbGFiYzEyMw.${sig}`).success).toBe(true);
  });

  it("refuses another version, a short signature and non-base64url characters", () => {
    expect(unsubscribeTokenSchema.safeParse(`v2.dTpjbGFiYzEyMw.${sig}`).success).toBe(false);
    expect(unsubscribeTokenSchema.safeParse(`v1.dTpjbGFiYzEyMw.${"A".repeat(42)}`).success).toBe(
      false,
    );
    expect(unsubscribeTokenSchema.safeParse(`v1.dTpj+GFi/zEyMw.${sig}`).success).toBe(false);
    expect(unsubscribeTokenSchema.safeParse("reader@example.test").success).toBe(false);
  });
});
