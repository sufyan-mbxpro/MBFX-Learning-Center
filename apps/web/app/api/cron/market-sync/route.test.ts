// ADR-087 #11 + ADR-096 #1 — the sweep's door. None of these properties is
// about market data: it fails closed with no secret, it rejects a wrong one in
// constant time, it never evicts a cache it had no reason to, and it does not
// spend a provider request before the admin's interval has elapsed.
import { beforeEach, describe, expect, it, vi } from "vitest";

const syncDailyBars = vi.fn(async () => ({
  attempted: 3,
  synced: 3,
  barsWritten: 7,
  failures: [] as { symbol: string; error: string }[],
  skipped: 0,
  unsupported: [] as string[],
}));
const recordAudit = vi.fn(async () => {});
const getSyncDueState = vi.fn(async () => ({
  due: true,
  lastSyncAt: null as Date | null,
  nextDueAt: null as Date | null,
  intervalSeconds: 300,
}));
const revalidateTag = vi.fn();

vi.mock("@repo/core", () => ({
  syncDailyBars,
  recordAudit,
  getSyncDueState,
  MARKET_CACHE_TAG: "market",
}));
vi.mock("next/cache", () => ({ revalidateTag }));

const { POST } = await import("./route.ts");

function call(token?: string, query = "") {
  return POST(
    new Request(`http://localhost/api/cron/market-sync${query}`, {
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
    unsupported: [] as string[],
  });
  getSyncDueState.mockResolvedValue({
    due: true,
    lastSyncAt: null,
    nextDueAt: null,
    intervalSeconds: 300,
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
      unsupported: [] as string[],
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
      unsupported: [] as string[],
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

describe("the due check (ADR-096 #1)", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret";
  });

  it("sweeps nothing and answers 200 when the interval has not elapsed", async () => {
    // 200, not 429 or 204: the call succeeded and the system is in the state
    // the operator asked for. A scheduler alerting on non-2xx must not page
    // anyone for "not yet".
    const nextDueAt = new Date("2026-09-15T00:00:00.000Z");
    getSyncDueState.mockResolvedValue({
      due: false,
      lastSyncAt: new Date("2026-09-14T00:00:00.000Z"),
      nextDueAt,
      intervalSeconds: 86_400,
    });

    const response = await call("s3cret");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      swept: false,
      reason: "not_due",
      nextDueAt: nextDueAt.toISOString(),
      intervalSeconds: 86_400,
    });
    // The whole point: no provider request is spent.
    expect(syncDailyBars).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("sweeps when the interval has elapsed", async () => {
    getSyncDueState.mockResolvedValue({
      due: true,
      lastSyncAt: new Date("2026-09-01T00:00:00.000Z"),
      nextDueAt: new Date("2026-09-02T00:00:00.000Z"),
      intervalSeconds: 86_400,
    });

    const response = await call("s3cret");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ swept: true, forced: false, synced: 3 });
    expect(syncDailyBars).toHaveBeenCalledTimes(1);
  });

  it("does not even ASK when the caller forces", async () => {
    // An operator holding the secret saying "now" is the same statement the
    // admin's button makes: the interval governs the scheduler, not people.
    const response = await call("s3cret", "?force=1");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ swept: true, forced: true });
    expect(getSyncDueState).not.toHaveBeenCalled();
    expect(syncDailyBars).toHaveBeenCalledTimes(1);
  });

  it("still rejects a wrong token on a forced call", async () => {
    // force is not a bypass of anything but the CADENCE.
    const response = await call("wrong", "?force=1");
    expect(response.status).toBe(401);
    expect(syncDailyBars).not.toHaveBeenCalled();
  });

  it("treats any other force value as absent", async () => {
    getSyncDueState.mockResolvedValue({
      due: false,
      lastSyncAt: new Date("2026-09-14T00:00:00.000Z"),
      nextDueAt: new Date("2026-09-15T00:00:00.000Z"),
      intervalSeconds: 86_400,
    });
    const response = await call("s3cret", "?force=true");
    expect(await response.json()).toMatchObject({ swept: false });
    expect(syncDailyBars).not.toHaveBeenCalled();
  });
});
