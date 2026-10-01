// The translate cron route's wiring: fail-closed auth, and one drain per
// authorised call. `@repo/core` is mocked — the drain itself is
// `translation-admin.integration.test.ts`, against a real database.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const summary = {
  claimed: 4,
  done: 3,
  skipped: 0,
  backfillEnqueued: 2,
  backfillClaimed: 1,
  requeued: 0,
  retrying: 1,
  paused: 0,
  failed: 0,
  batches: 2,
  stoppedBy: "empty",
};
const drainTranslationQueue = vi.fn(async () => summary);

vi.mock("@repo/core", () => ({ drainTranslationQueue }));

const { POST } = await import("./route.ts");

const SECRET = "s3cret-value";

function post(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) headers.set("authorization", authorization);
  return new Request("http://localhost/api/cron/translate", { method: "POST", headers });
}

const original = process.env.CRON_SECRET;

beforeEach(() => {
  drainTranslationQueue.mockClear();
  process.env.CRON_SECRET = SECRET;
});

afterEach(() => {
  if (original === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = original;
});

describe("POST /api/cron/translate", () => {
  it("fails CLOSED when no secret is configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(post(`Bearer ${SECRET}`) as never);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expect(drainTranslationQueue).not.toHaveBeenCalled();
  });

  it("rejects a missing, malformed or wrong bearer token identically", async () => {
    for (const header of [undefined, "", "Basic abc", "Bearer ", "Bearer wrong", "Bearer x"]) {
      const res = await POST(post(header) as never);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    }
    expect(drainTranslationQueue).not.toHaveBeenCalled();
  });

  it("drains once and reports what it did, uncached", async () => {
    const res = await POST(post(`Bearer ${SECRET}`) as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ done: 3, backfillEnqueued: 2, stoppedBy: "empty" });
    expect(drainTranslationQueue).toHaveBeenCalledTimes(1);
  });

  it("exports POST only, so a GET answers 405", async () => {
    const route = await import("./route.ts");
    expect(Object.keys(route).sort()).toEqual(["POST"]);
  });
});
