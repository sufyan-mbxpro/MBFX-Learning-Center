// The announcements cron route's wiring: fail-closed auth, and one drain per
// authorised call. `@repo/core` is mocked — the drain itself is
// `announcements.integration.test.ts`, against a real database.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const summary = {
  started: 1,
  cancelled: 0,
  sent: 40,
  failed: 1,
  retried: 2,
  suppressed: 3,
  leaseExpired: 0,
  paused: false,
};
const drainAnnouncementQueue = vi.fn(async (_options?: unknown) => summary);

vi.mock("@repo/core", () => ({ drainAnnouncementQueue }));

const { POST } = await import("./route.ts");

const SECRET = "s3cret-value";

function post(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) headers.set("authorization", authorization);
  return new Request("http://localhost/api/cron/announcements", { method: "POST", headers });
}

const original = process.env.CRON_SECRET;

beforeEach(() => {
  drainAnnouncementQueue.mockClear();
  process.env.CRON_SECRET = SECRET;
});

afterEach(() => {
  if (original === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = original;
});

describe("POST /api/cron/announcements", () => {
  it("fails CLOSED when no secret is configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(post(`Bearer ${SECRET}`) as never);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expect(drainAnnouncementQueue).not.toHaveBeenCalled();
  });

  it("rejects a missing, malformed or wrong bearer token identically", async () => {
    for (const header of [undefined, "", "Basic abc", "Bearer ", "Bearer wrong", "Bearer x"]) {
      const res = await POST(post(header) as never);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    }
    expect(drainAnnouncementQueue).not.toHaveBeenCalled();
  });

  it("drains once within the 240-second budget and reports what it did, uncached", async () => {
    const res = await POST(post(`Bearer ${SECRET}`) as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ sent: 40, suppressed: 3, paused: false });
    expect(drainAnnouncementQueue).toHaveBeenCalledTimes(1);
    expect(drainAnnouncementQueue).toHaveBeenCalledWith({ budgetMs: 240_000 });
  });

  it("exports POST only, so a GET answers 405", async () => {
    const route = await import("./route.ts");
    expect(Object.keys(route).sort()).toEqual(["POST"]);
  });
});
