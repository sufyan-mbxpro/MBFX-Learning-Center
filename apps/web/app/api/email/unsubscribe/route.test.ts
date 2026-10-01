// The announcement unsubscribe route's five guards (ADR-171 #9), one red test
// per guard the ADR-080 way: remove a guard and exactly one test here fails.
// `@repo/core` and the rate limiter are mocked — the services themselves are
// `announcements.integration.test.ts`, against a real database.
import { beforeEach, describe, expect, it, vi } from "vitest";

const unsubscribeFromAnnouncements = vi.fn(async (_token: string) => ({
  newsletterActive: true,
}));
const resubscribeToAnnouncements = vi.fn(async (_token: string) => true);
const unsubscribeNewsletterByAnnouncementToken = vi.fn(async (_token: string) => true);
const rateLimit = vi.fn(async (_key: string, _limit: number, _window: number) => ({
  ok: true as boolean,
  retryAfterSeconds: 0,
}));

vi.mock("@repo/core", () => ({
  unsubscribeFromAnnouncements,
  resubscribeToAnnouncements,
  unsubscribeNewsletterByAnnouncementToken,
}));
vi.mock("@repo/auth", () => ({ rateLimit }));

const { POST } = await import("./route.ts");
const { NextRequest } = await import("next/server");

const TOKEN = `v1.dTpsZWFybmVyLWE.${"A".repeat(43)}`;

function post(query: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost/api/email/unsubscribe${query}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: "List-Unsubscribe=One-Click",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  unsubscribeFromAnnouncements.mockResolvedValue({ newsletterActive: true });
});

describe("POST /api/email/unsubscribe (ADR-171 #9)", () => {
  it("unsubscribes on an RFC 8058 one-click, and tells the page about the newsletter", async () => {
    const res = await POST(post(`?t=${TOKEN}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, newsletter: true });
    expect(unsubscribeFromAnnouncements).toHaveBeenCalledWith(TOKEN);
  });

  it("guard 1: an unknown token gets the same answer as a real one with no subscription", async () => {
    unsubscribeFromAnnouncements.mockResolvedValue(null as never);
    const res = await POST(post(`?t=${TOKEN}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, newsletter: false });
  });

  it("guard 2: a malformed token never reaches the service, and still answers 200", async () => {
    for (const query of ["", "?t=", "?t=reader@example.test", "?t=v2.abc.def"]) {
      const res = await POST(post(query));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, newsletter: false });
    }
    expect(unsubscribeFromAnnouncements).not.toHaveBeenCalled();
  });

  it("guard 2: an unknown op falls back to the unsubscribe, the safe direction", async () => {
    await POST(post(`?t=${TOKEN}&op=delete-everything`));
    expect(unsubscribeFromAnnouncements).toHaveBeenCalledTimes(1);
    expect(resubscribeToAnnouncements).not.toHaveBeenCalled();
  });

  it("guard 3: limits each IP to 20 per ten minutes", async () => {
    rateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 42 });
    const res = await POST(post(`?t=${TOKEN}`, { "x-forwarded-for": "203.0.113.9" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    expect(unsubscribeFromAnnouncements).not.toHaveBeenCalled();
    expect(rateLimit).toHaveBeenCalledWith(expect.stringMatching(/^announce:unsub:/), 20, 600);
  });

  it("guard 4 + 5: a repeat answers exactly the same", async () => {
    const first = await (await POST(post(`?t=${TOKEN}`))).json();
    const second = await (await POST(post(`?t=${TOKEN}`))).json();
    expect(second).toEqual(first);
  });

  it("runs the page's Undo and newsletter buttons, and nothing else, for their op", async () => {
    expect(await (await POST(post(`?t=${TOKEN}&op=undo`))).json()).toEqual({
      ok: true,
      newsletter: false,
    });
    expect(resubscribeToAnnouncements).toHaveBeenCalledWith(TOKEN);
    await POST(post(`?t=${TOKEN}&op=newsletter`));
    expect(unsubscribeNewsletterByAnnouncementToken).toHaveBeenCalledWith(TOKEN);
    expect(unsubscribeFromAnnouncements).not.toHaveBeenCalled();
  });

  it("exports POST only, so a mail scanner's GET answers 405", async () => {
    const route = await import("./route.ts");
    expect(Object.keys(route).sort()).toEqual(["POST"]);
  });
});
