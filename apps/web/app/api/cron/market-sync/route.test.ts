// ADR-087 #11 — the sweep's door. Three properties, and none of them is about
// market data: it fails closed with no secret, it rejects a wrong one in
// constant time, and it never evicts a cache it had no reason to.
import { beforeEach, describe, expect, it, vi } from "vitest";

const syncDailyBars = vi.fn(async () => ({
  attempted: 3,
  synced: 3,
  barsWritten: 7,
  failures: [] as { symbol: string; error: string }[],
  skipped: 0,
}));
const recordAudit = vi.fn(async () => {});
const revalidateTag = vi.fn();

vi.mock("@repo/core", () => ({ syncDailyBars, recordAudit, MARKET_CACHE_TAG: "market" }));
vi.mock("next/cache", () => ({ revalidateTag }));

const { POST } = await import("./route.ts");

function call(token?: string) {
  return POST(
    new Request("http://localhost/api/cron/market-sync", {
      method: "POST",
      ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
    }) as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  syncDailyBars.mockResolvedValue({
    attempted: 3,
    synced: 3,
    barsWritten: 7,
    failures: [],
    skipped: 0,
  });
  delete process.env.CRON_SECRET;
});

describe("authorization", () => {
  it("FAILS CLOSED with no CRON_SECRET set", async () => {
    // An unset variable must never mean "anyone may spend the provider's
    // request budget". 503 says the endpoint is not configured, which is true.
    const response = await call("anything");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "not_configured" });
    expect(syncDailyBars).not.toHaveBeenCalled();
  });

  it("rejects a request with no authorization header", async () => {
    process.env.CRON_SECRET = "s3cret";
    const response = await call();
    expect(response.status).toBe(401);
    expect(syncDailyBars).not.toHaveBeenCalled();
  });

  it("rejects a wrong token", async () => {
    process.env.CRON_SECRET = "s3cret";
    const response = await call("wrong");
    expect(response.status).toBe(401);
    expect(syncDailyBars).not.toHaveBeenCalled();
  });

  it("rejects a token of a DIFFERENT LENGTH without throwing", async () => {
    // The reason the comparison is over SHA-256 digests rather than the raw
    // strings: `timingSafeEqual` throws on a length mismatch, and the early
    // return that would force leaks the length through timing — the exact
    // thing the function exists to prevent.
    process.env.CRON_SECRET = "s3cret";
    const response = await call("a-very-much-longer-token-than-the-real-one");
    expect(response.status).toBe(401);
  });

  it("accepts the right token and runs the sweep", async () => {
    process.env.CRON_SECRET = "s3cret";
    const response = await call("s3cret");
    expect(response.status).toBe(200);
    expect(syncDailyBars).toHaveBeenCalledTimes(1);
  });
});

describe("the sweep's side effects", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret";
  });

  it("evicts the market cache when bars were written", async () => {
    await call("s3cret");
    expect(revalidateTag).toHaveBeenCalledWith("market", { expire: 0 });
  });

  it("does NOT evict when nothing was written", async () => {
    // A sweep that wrote no bars — the provider was down, or everything was
    // already current — has no reason to drop a snapshot that is still the
    // best available answer.
    syncDailyBars.mockResolvedValueOnce({
      attempted: 3,
      synced: 0,
      barsWritten: 0,
      failures: [{ symbol: "EUR/USD", error: "Provider rate-limited" }],
      skipped: 0,
    });
    await call("s3cret");
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("audits with userId null — there is no subject here", async () => {
    // security.md #1 governs mutations made BY someone. Inventing a system
    // user to satisfy it would put a fictional actor in the audit trail.
    await call("s3cret");
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, action: "market.sync" }),
    );
  });

  it("still answers 200 and audits when the provider failed", async () => {
    syncDailyBars.mockResolvedValueOnce({
      attempted: 1,
      synced: 0,
      barsWritten: 0,
      failures: [{ symbol: "EUR/USD", error: "Provider rate-limited" }],
      skipped: 0,
    });
    const response = await call("s3cret");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ failures: [{ symbol: "EUR/USD" }] });
    expect(recordAudit).toHaveBeenCalled();
  });

  it("never caches its own response", async () => {
    const response = await call("s3cret");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
