import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { unsubscribeTokenSchema } from "@repo/contracts";
import {
  LinkSecretMissingError,
  announcementUnsubscribeUrls,
  hasLinkSecret,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./links.ts";

const secrets = { current: "current-secret-32-bytes-long-xxxx", previous: undefined };

describe("the announcement unsubscribe token (ADR-171 #9)", () => {
  it("round-trips and matches the contracts shape", () => {
    const token = signUnsubscribeToken({ kind: "u", id: "cm1abc" }, secrets);
    expect(unsubscribeTokenSchema.safeParse(token).success).toBe(true);
    expect(verifyUnsubscribeToken(token, secrets)).toEqual({ kind: "u", id: "cm1abc" });
  });

  it("carries no email address", () => {
    const token = signUnsubscribeToken({ kind: "s", id: "cm1abc" }, secrets);
    expect(token).not.toContain("@");
  });

  it("refuses a token with one byte of the signature flipped", () => {
    const token = signUnsubscribeToken({ kind: "u", id: "cm1abc" }, secrets);
    const last = token.at(-1) === "A" ? "B" : "A";
    expect(verifyUnsubscribeToken(token.slice(0, -1) + last, secrets)).toBeNull();
  });

  it("does not accept a user's signature for a subscriber with the same id", () => {
    const token = signUnsubscribeToken({ kind: "u", id: "same" }, secrets);
    const [, , sig] = token.split(".");
    const forged = `v1.${Buffer.from("s:same").toString("base64url")}.${sig}`;
    expect(verifyUnsubscribeToken(forged, secrets)).toBeNull();
  });

  it("accepts the previous secret during a rotation, and refuses an unknown one", () => {
    const old = signUnsubscribeToken(
      { kind: "u", id: "cm1abc" },
      { current: "old", previous: undefined },
    );
    expect(verifyUnsubscribeToken(old, { current: "new", previous: "old" })).toEqual({
      kind: "u",
      id: "cm1abc",
    });
    expect(verifyUnsubscribeToken(old, { current: "new", previous: undefined })).toBeNull();
  });

  it("refuses to sign without a secret, and verifies nothing without one", () => {
    const none = { current: undefined, previous: undefined };
    expect(hasLinkSecret(none)).toBe(false);
    expect(() => signUnsubscribeToken({ kind: "u", id: "x" }, none)).toThrow(
      LinkSecretMissingError,
    );
    const token = signUnsubscribeToken({ kind: "u", id: "x" }, secrets);
    expect(verifyUnsubscribeToken(token, none)).toBeNull();
  });

  it("returns null, never throws, for malformed input", () => {
    for (const bad of ["", "v1", "v1..", "v2.a.b", "v1.@@@.x", "v1.dTo.AAAA"]) {
      expect(verifyUnsubscribeToken(bad, secrets)).toBeNull();
    }
    // A payload with no kind separator, correctly signed, is still refused.
    const payload = Buffer.from("nokind").toString("base64url");
    expect(verifyUnsubscribeToken(`v1.${payload}.${"A".repeat(43)}`, secrets)).toBeNull();
  });

  it("round-trips any id (property)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("u" as const, "s" as const),
        fc.string({ minLength: 1, maxLength: 191 }),
        (kind, id) => {
          const token = signUnsubscribeToken({ kind, id }, secrets);
          expect(verifyUnsubscribeToken(token, secrets)).toEqual({ kind, id });
        },
      ),
    );
  });
});

describe("announcementUnsubscribeUrls", () => {
  it("builds the page in the reader's locale and the handler without one", () => {
    expect(announcementUnsubscribeUrls("t.o.k", "https://example.test/", "ar")).toEqual({
      page: "https://example.test/ar/email/unsubscribe?t=t.o.k",
      oneClick: "https://example.test/api/email/unsubscribe?t=t.o.k",
    });
    expect(announcementUnsubscribeUrls("tok", "https://example.test", "en").page).toBe(
      "https://example.test/email/unsubscribe?t=tok",
    );
  });
});
