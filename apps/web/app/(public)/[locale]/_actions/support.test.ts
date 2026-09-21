// The support form action's five guards (ADR-113).
//
// This is the SECOND mutation in the repo with no subject, so
// `requirePermission()` — the first line of every other one — is replaced
// rather than skipped. Five parts stand in for it, and this file exists to
// prove each one refuses ON ITS OWN: remove any of them and exactly one test
// here goes red, which is the only way that claim survives later edits. It is
// deliberately the same file, test for test, as
// `newsletter.test.ts` — if the two ever diverge, the difference is the thing
// to look at.
//
// Everything below the action is faked, and only at the module edge: the
// service, the limiter and `after()`. What is under test is the ORDER and
// completeness of the gates, not what `sendSupportRequest()` does with the
// message.
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendSupportRequest = vi.fn(async () => ({ status: "SENT", deliveryId: "d1" }));
// The parameter list is declared, not inferred: `vi.fn(async () => …)` types
// its params as the empty tuple, and `mock.calls[0][0]` — which is how the
// bucket-name assertions read the KEY — then has no element 0.
const rateLimit = vi.fn(async (_key: string, _limit: number, _windowSeconds: number) => ({
  ok: true,
  remaining: 4,
  retryAfterSeconds: 600,
}));

vi.mock("@repo/core", () => ({ sendSupportRequest }));
vi.mock("@repo/auth", () => ({ rateLimit }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));
// `after()` defers the send past the response in production. Running the
// callback inline here is what lets a test assert the send happened at all.
vi.mock("next/server", () => ({
  after: (callback: () => Promise<void> | void) => void callback(),
}));

// The inbox is the `site.supportEmail` setting (ADR-131). Mocked so the "no
// inbox recorded" case is reachable without a database.
const contact: { email: string | null } = { email: "support@mbfx.co" };
const getSetting = vi.fn(async (_key: string) => contact.email);
vi.mock("@repo/settings", () => ({ getSetting }));

const { sendSupportRequestAction } = await import("./support.ts");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const VALID = {
  name: "Alex Morgan",
  email: "Reader@Example.test",
  subject: "I cannot sign in",
  message: "The reset link says it has expired.",
  locale: "en",
};

beforeEach(() => {
  vi.clearAllMocks();
  contact.email = "support@mbfx.co";
  rateLimit.mockResolvedValue({ ok: true, remaining: 4, retryAfterSeconds: 600 });
});

describe("the happy path", () => {
  it("sends and reports sent", async () => {
    const result = await sendSupportRequestAction({ status: "idle" }, form(VALID));

    expect(result).toEqual({ status: "sent" });
    expect(getSetting).toHaveBeenCalledWith("site.supportEmail");
    // Lower-cased by the schema, not the service — so the per-email limit
    // bucket and the send see the same string.
    expect(sendSupportRequest).toHaveBeenCalledWith({
      to: "support@mbfx.co",
      name: "Alex Morgan",
      email: "reader@example.test",
      subject: "I cannot sign in",
      message: "The reset link says it has expired.",
      locale: "en",
    });
  });

  // The property that stops this being an open relay. A `to` taken from the
  // form would let anyone send mail from our domain to anyone.
  it("ignores a `to` posted with the form", async () => {
    await sendSupportRequestAction(
      { status: "idle" },
      form({ ...VALID, to: "victim@example.test" }),
    );

    expect(sendSupportRequest).toHaveBeenCalledWith(
      expect.objectContaining({ to: "support@mbfx.co" }),
    );
  });

  it("counts the address against a per-EMAIL budget as well as a per-IP one", async () => {
    await sendSupportRequestAction({ status: "idle" }, form(VALID));

    const keys = rateLimit.mock.calls.map((call) => String(call[0]));
    // security.md #13 wants BOTH: per-IP stops one attacker, per-email stops a
    // distributed flood aimed at one inbox.
    expect(keys.some((key) => key.startsWith("support:ip:"))).toBe(true);
    expect(keys).toContain("support:email:reader@example.test");
  });

  // Its own namespace, not the newsletter's: sharing a bucket would let a
  // reader who subscribed this hour be refused a support message.
  it("uses buckets of its own", async () => {
    await sendSupportRequestAction({ status: "idle" }, form(VALID));
    for (const call of rateLimit.mock.calls) {
      expect(String(call[0]).startsWith("support:")).toBe(true);
    }
  });
});

describe("guard 1 — a recorded inbox", () => {
  it.each([
    ["an empty setting", ""],
    ["no setting row", null],
  ])("sends nothing when there is nowhere to send (%s)", async (_label, email) => {
    contact.email = email;

    expect(await sendSupportRequestAction({ status: "idle" }, form(VALID))).toMatchObject({
      status: "failed",
    });
    expect(sendSupportRequest).not.toHaveBeenCalled();
    // Refused before it was counted: an unconfigured install must not spend
    // anyone's rate-limit budget.
    expect(rateLimit).not.toHaveBeenCalled();
  });
});

describe("guard 2 — the honeypot", () => {
  it("sends nothing, and says SENT anyway", async () => {
    const result = await sendSupportRequestAction(
      { status: "idle" },
      form({ ...VALID, company: "bot" }),
    );

    // The success message is the point: telling a bot it was detected is how
    // it learns to stop filling the field.
    expect(result).toEqual({ status: "sent" });
    expect(sendSupportRequest).not.toHaveBeenCalled();
  });

  it("lets a human through when the field is present but empty", async () => {
    const result = await sendSupportRequestAction(
      { status: "idle" },
      form({ ...VALID, company: "  " }),
    );
    expect(result).toEqual({ status: "sent" });
    expect(sendSupportRequest).toHaveBeenCalled();
  });
});

describe("guard 3 and 4 — both limits", () => {
  it("refuses on the per-IP limit before touching the per-email one", async () => {
    rateLimit.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfterSeconds: 42 });

    expect(await sendSupportRequestAction({ status: "idle" }, form(VALID))).toMatchObject({
      status: "limited",
    });
    expect(rateLimit).toHaveBeenCalledTimes(1);
    expect(sendSupportRequest).not.toHaveBeenCalled();
  });

  it("refuses on the per-email limit even when the IP has budget left", async () => {
    rateLimit
      .mockResolvedValueOnce({ ok: true, remaining: 4, retryAfterSeconds: 600 })
      .mockResolvedValueOnce({ ok: false, remaining: 0, retryAfterSeconds: 900 });

    expect(await sendSupportRequestAction({ status: "idle" }, form(VALID))).toMatchObject({
      status: "limited",
    });
    expect(sendSupportRequest).not.toHaveBeenCalled();
  });

  // React resets the form after the action settles; handing the words back is
  // what stops "try again later" also deleting the message.
  it("hands back what was typed, so a refusal does not lose the message", async () => {
    rateLimit.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfterSeconds: 42 });

    expect(await sendSupportRequestAction({ status: "idle" }, form(VALID))).toEqual({
      status: "limited",
      values: {
        name: VALID.name,
        email: VALID.email,
        subject: VALID.subject,
        message: VALID.message,
      },
    });
  });
});

describe("guard 5 — the schema", () => {
  it.each([
    ["a malformed address", { ...VALID, email: "not-an-email" }],
    ["a missing address", { ...VALID, email: "" }],
    ["an empty message", { ...VALID, message: "   " }],
    ["a missing subject", { ...VALID, subject: "" }],
    ["a missing name", { ...VALID, name: "" }],
    // A tampered form, not a typo — the form posts this as a hidden input —
    // so it answers exactly as a bad address does rather than naming the field.
    ["a missing locale", { ...VALID, locale: "" }],
    ["a newline smuggled into the subject", { ...VALID, subject: "Hi\r\nBcc: x@evil.test" }],
  ])("refuses %s", async (_label, fields) => {
    expect(await sendSupportRequestAction({ status: "idle" }, form(fields))).toMatchObject({
      status: "invalid",
    });
    expect(sendSupportRequest).not.toHaveBeenCalled();
  });
});
