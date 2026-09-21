// The learner profile page's inputs and its resume rule (ADR-123).
import { describe, expect, it } from "vitest";

import {
  ACCOUNT_PATH,
  AVATAR_MAX_BYTES,
  articleReadSchema,
  changePasswordFormSchema,
  learnerProfileSchema,
  pickResumeLesson,
  twoFactorCodeSchema,
  twoFactorPasswordSchema,
} from "./account.ts";
import { updateOwnProfileSchema } from "./admin.ts";

describe("articleReadSchema", () => {
  it("accepts an article id", () => {
    expect(articleReadSchema.parse({ articleId: " ck123 " })).toEqual({ articleId: "ck123" });
  });

  it("rejects an empty or oversized id", () => {
    expect(articleReadSchema.safeParse({ articleId: "" }).success).toBe(false);
    expect(articleReadSchema.safeParse({ articleId: "x".repeat(192) }).success).toBe(false);
  });

  // The mass-assignment defence (security.md #6): the reader is the session,
  // so a body that names one is not honoured — the field is simply dropped.
  it("has nowhere to put a user id", () => {
    const parsed = articleReadSchema.parse({ articleId: "a1", userId: "someone-else" });
    expect(parsed).toEqual({ articleId: "a1" });
  });
});

describe("learnerProfileSchema", () => {
  it("is the staff profile's schema, so the two cannot disagree", () => {
    expect(learnerProfileSchema).toBe(updateOwnProfileSchema);
  });

  it("requires a name and trims it", () => {
    expect(learnerProfileSchema.parse({ name: "  Sam  " }).name).toBe("Sam");
    expect(learnerProfileSchema.safeParse({ name: "   " }).success).toBe(false);
  });
});

describe("changePasswordFormSchema", () => {
  const valid = {
    currentPassword: "old-pass",
    newPassword: "new-password",
    confirmPassword: "new-password",
  };

  it("accepts a matching confirmation", () => {
    expect(changePasswordFormSchema.safeParse(valid).success).toBe(true);
  });

  it("puts a mismatch on the confirmation field", () => {
    const result = changePasswordFormSchema.safeParse({ ...valid, confirmPassword: "different" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("enforces the server's minimum on the new password", () => {
    const result = changePasswordFormSchema.safeParse({
      ...valid,
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("twoFactorCodeSchema", () => {
  it("accepts six digits, with the space authenticator apps display", () => {
    expect(twoFactorCodeSchema.parse({ code: "123 456" })).toEqual({ code: "123456" });
    expect(twoFactorCodeSchema.parse({ code: "000111" })).toEqual({ code: "000111" });
  });

  it("rejects anything that is not six digits", () => {
    for (const code of ["12345", "1234567", "12a456", ""]) {
      expect(twoFactorCodeSchema.safeParse({ code }).success, code).toBe(false);
    }
  });
});

describe("twoFactorPasswordSchema", () => {
  it("requires a password", () => {
    expect(twoFactorPasswordSchema.safeParse({ password: "" }).success).toBe(false);
    expect(twoFactorPasswordSchema.safeParse({ password: "secret" }).success).toBe(true);
  });
});

describe("constants", () => {
  it("keeps the avatar budget under the library's 5 MB image default", () => {
    expect(AVATAR_MAX_BYTES).toBeLessThan(5 * 1024 * 1024);
  });

  it("names the page without a locale", () => {
    expect(ACCOUNT_PATH).toBe("/account");
  });
});

describe("pickResumeLesson", () => {
  const lessons = [{ id: "l1" }, { id: "l2" }, { id: "l3" }, { id: "l4" }];

  it("opens the first lesson of an untouched course", () => {
    expect(pickResumeLesson(lessons, new Set(), null)).toEqual({ id: "l1" });
  });

  it("returns to the lesson they left in the middle of", () => {
    expect(pickResumeLesson(lessons, new Set(["l1"]), "l3")).toEqual({ id: "l3" });
  });

  it("sends a learner back to a lesson they skipped, not to the next page", () => {
    expect(pickResumeLesson(lessons, new Set(["l1", "l3", "l4"]), "l4")).toEqual({ id: "l2" });
  });

  it("ignores a last lesson that is no longer reachable", () => {
    expect(pickResumeLesson(lessons, new Set(["l1"]), "gone")).toEqual({ id: "l2" });
  });

  it("is null when every lesson is complete, or there are none", () => {
    expect(pickResumeLesson(lessons, new Set(["l1", "l2", "l3", "l4"]), "l4")).toBeNull();
    expect(pickResumeLesson([], new Set(), null)).toBeNull();
  });
});
