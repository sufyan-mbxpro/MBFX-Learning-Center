// The anonymous signup action's five guards (ADR-080 #3).
//
// This is the ONE mutation in the repo with no subject, so
// `requirePermission()` — the first line of every other one — is replaced
// rather than skipped. Five parts stand in for it, and this file exists to
// prove each one refuses on its own: remove any of them and exactly one test
// here goes red, which is the only way that claim stays true as the file is
// edited later.
//
// Everything below the action is faked, and only at the module edge: the
// service, the limiter, the flag reader and `after()`. What is under test is
// the ORDER and completeness of the gates, not what `subscribe()` does with
// the address — `newsletter.integration.test.ts` owns that against a real
// database.
import { beforeEach, describe, expect, it, vi } from "vitest";

const subscribe = vi.fn(async () => {});
// The parameter list is declared, not inferred: `vi.fn(async () => …)` types
// its params as the empty tuple, and `mock.calls[0][0]` — which is how the
// bucket-name assertions read the KEY — then has no element 0.
const rateLimit = vi.fn(async (_key: string, _limit: number, _windowSeconds: number) => ({
  ok: true,
  remaining: 4,
  retryAfterSeconds: 600,
}));
const isFeatureVisible = vi.fn(async () => true);

vi.mock("@repo/core", () => ({
  subscribe,
  confirmSubscription: vi.fn(async () => "confirmed"),
  unsubscribe: vi.fn(async () => "unsubscribed"),
}));
vi.mock("@repo/auth", () => ({ rateLimit }));
vi.mock("@repo/settings", () => ({ isFeatureVisible }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));
// `after()` defers the write past the response in production. Running the
// callback inline here is what lets a test assert the write happened at all.
vi.mock("next/server", () => ({
  after: (callback: () => Promise<void> | void) => void callback(),
}));

const { subscribeAction, confirmSubscriptionAction, unsubscribeAction } =
  await import("./newsletter.ts");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const VALID = { email: "Reader@Example.test", locale: "en", source: "footer" };

beforeEach(() => {
  vi.clearAllMocks();
  isFeatureVisible.mockResolvedValue(true);
  rateLimit.mockResolvedValue({ ok: true, remaining: 4, retryAfterSeconds: 600 });
});

describe("the happy path", () => {
  it("subscribes and reports sent", async () => {
    const result = await subscribeAction({ status: "idle" }, form(VALID));

    expect(result).toEqual({ status: "sent" });
    // Lower-cased by the schema, not the service — so the unique constraint
    // and the per-email rate-limit bucket see the same string.
    expect(subscribe).toHaveBeenCalledWith({
      email: "reader@example.test",
      locale: "en",
      source: "footer",
    });
  });

  it("counts the address against a per-EMAIL budget as well as a per-IP one", async () => {
    await subscribeAction({ status: "idle" }, form(VALID));

    const keys = rateLimit.mock.calls.map((call) => String(call[0]));
    // security.md #13 wants BOTH: per-IP stops one attacker, per-email stops a
    // distributed mail-bomb aimed at one inbox.
    expect(keys.some((key) => key.startsWith("newsletter:ip:"))).toBe(true);
    expect(keys).toContain("newsletter:email:reader@example.test");
  });
});

describe("guard 1 — the feature flag", () => {
  it("writes nothing when the flag is off", async () => {
    isFeatureVisible.mockResolvedValue(false);

    expect(await subscribeAction({ status: "idle" }, form(VALID))).toEqual({ status: "failed" });
    expect(subscribe).not.toHaveBeenCalled();
    // Refused before it was counted: an off feature must not spend anyone's
    // rate-limit budget.
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("evaluates the flag against a NULL subject, because that is who signs up", async () => {
    await subscribeAction({ status: "idle" }, form(VALID));
    expect(isFeatureVisible).toHaveBeenCalledWith("newsletter", null);
  });
});

describe("guard 2 — the honeypot", () => {
  it("writes nothing, and says SENT anyway", async () => {
    const result = await subscribeAction({ status: "idle" }, form({ ...VALID, website: "bot" }));

    // The success message is the point: telling a bot it was detected is how
    // it learns to stop filling the field.
    expect(result).toEqual({ status: "sent" });
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("lets a human through when the field is present but empty", async () => {
    const result = await subscribeAction({ status: "idle" }, form({ ...VALID, website: "  " }));
    expect(result).toEqual({ status: "sent" });
    expect(subscribe).toHaveBeenCalled();
  });
});

describe("guard 3 and 4 — both limits", () => {
  it("refuses on the per-IP limit before touching the per-email one", async () => {
    rateLimit.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfterSeconds: 42 });

    expect(await subscribeAction({ status: "idle" }, form(VALID))).toEqual({ status: "limited" });
    expect(rateLimit).toHaveBeenCalledTimes(1);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("refuses on the per-email limit even when the IP has budget left", async () => {
    rateLimit
      .mockResolvedValueOnce({ ok: true, remaining: 4, retryAfterSeconds: 600 })
      .mockResolvedValueOnce({ ok: false, remaining: 0, retryAfterSeconds: 900 });

    expect(await subscribeAction({ status: "idle" }, form(VALID))).toEqual({ status: "limited" });
    expect(subscribe).not.toHaveBeenCalled();
  });
});

describe("guard 5 — the schema", () => {
  it.each([
    ["a malformed address", { ...VALID, email: "not-an-email" }],
    ["a missing address", { locale: "en", source: "footer" }],
    // A tampered form, not a typo — so it answers exactly as a bad address
    // does rather than naming the field and confirming the tamper worked.
    ["an unknown source", { ...VALID, source: "evil" }],
    ["a missing locale", { email: "reader@example.test", source: "footer" }],
  ])("refuses %s", async (_label, fields) => {
    expect(await subscribeAction({ status: "idle" }, form(fields))).toEqual({ status: "invalid" });
    expect(subscribe).not.toHaveBeenCalled();
  });
});

describe("confirm and unsubscribe (ADR-080 #4)", () => {
  const TOKEN = "a".repeat(64);

  it.each([
    ["confirm", confirmSubscriptionAction],
    ["unsubscribe", unsubscribeAction],
  ])("%s refuses a malformed token before any lookup", async (_label, action) => {
    expect(await action("not-a-token")).toBe("invalid");
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it.each([
    ["confirm", confirmSubscriptionAction, "newsletter:confirm:"],
    ["unsubscribe", unsubscribeAction, "newsletter:unsub:"],
  ])("%s is rate limited on its own bucket", async (_label, action, prefix) => {
    await action(TOKEN);
    expect(String(rateLimit.mock.calls[0]?.[0])).toContain(prefix);
  });

  it.each([
    ["confirm", confirmSubscriptionAction],
    ["unsubscribe", unsubscribeAction],
  ])("%s is NOT gated on the flag — an old link must keep working", async (_label, action) => {
    isFeatureVisible.mockResolvedValue(false);
    // Turning the newsletter off must not trap the people already on the
    // list: the unsubscribe link in a message sent last month is theirs.
    await expect(action(TOKEN)).resolves.not.toBe("failed");
    expect(isFeatureVisible).not.toHaveBeenCalled();
  });
});
