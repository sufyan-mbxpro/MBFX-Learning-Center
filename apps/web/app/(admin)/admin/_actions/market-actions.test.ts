// The market actions' gate (security.md #1) — `requirePermission()` first,
// then the parse, then the service.
//
// The shape of the assertion matters: it is not enough that a denied call
// rejects. It has to reject WITHOUT reaching `@repo/core`, because the service
// trusts the subject it is handed — the action is where the boundary is, and a
// service called with an unauthorised subject would have written the row.
import { beforeEach, describe, expect, it, vi } from "vitest";

class ForbiddenError extends Error {}
class UnauthenticatedError extends Error {}

const subject = { id: "actor-1" };
const requirePermission = vi.fn(async () => subject);

// Typed by its parameters, not just its return: the "strips an unknown
// property" assertion below reads `mock.calls[0][1]`, and an inferred `() =>`
// makes that a zero-length tuple.
const saveInstrument = vi.fn(async (_subject: unknown, _input: unknown) => "instrument-1");
const setInstrumentActive = vi.fn(async () => {});
const deleteInstrument = vi.fn(async () => {});
const reorderInstruments = vi.fn(async () => {});
const saveMarketProvider = vi.fn(async () => ({}));
const testMarketProvider = vi.fn(async () => ({ ok: true, symbol: "EUR/USD", latencyMs: 1 }));
const revalidateTag = vi.fn();

vi.mock("@repo/rbac", () => ({ requirePermission, ForbiddenError, UnauthenticatedError }));
vi.mock("@repo/core", () => ({
  MARKET_CACHE_TAG: "market",
  saveInstrument,
  setInstrumentActive,
  deleteInstrument,
  reorderInstruments,
  saveMarketProvider,
  testMarketProvider,
}));
vi.mock("next/cache", () => ({ revalidateTag }));

const actions = await import("./market-actions.ts");

const VALID_INSTRUMENT = {
  id: null,
  kind: "PAIR",
  symbol: "EUR/USD",
  displayName: "Euro / US Dollar",
  base: "EUR",
  quote: "USD",
  providerSymbol: null,
  pipSize: null,
  decimals: 5,
  isActive: true,
  sortOrder: 0,
};

const VALID_PROVIDER = {
  driver: "ALPHAVANTAGE",
  baseUrl: null,
  apiKey: "k",
  refreshSeconds: 300,
  staleSeconds: 86_400,
  isEnabled: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue(subject);
});

describe("the instrument key", () => {
  it.each([
    ["saveInstrumentAction", () => actions.saveInstrumentAction(VALID_INSTRUMENT)],
    ["setInstrumentActiveAction", () => actions.setInstrumentActiveAction("i1", false)],
    ["deleteInstrumentAction", () => actions.deleteInstrumentAction("i1")],
    ["reorderInstrumentsAction", () => actions.reorderInstrumentsAction(["i1", "i2"])],
  ])("%s checks market.instruments.manage", async (_name, call) => {
    await call();
    expect(requirePermission).toHaveBeenCalledWith("market.instruments.manage");
  });

  it.each([
    ["saveInstrumentAction", () => actions.saveInstrumentAction(VALID_INSTRUMENT), saveInstrument],
    [
      "setInstrumentActiveAction",
      () => actions.setInstrumentActiveAction("i1", false),
      setInstrumentActive,
    ],
    ["deleteInstrumentAction", () => actions.deleteInstrumentAction("i1"), deleteInstrument],
    [
      "reorderInstrumentsAction",
      () => actions.reorderInstrumentsAction(["i1"]),
      reorderInstruments,
    ],
  ])("%s never reaches the service when denied", async (_name, call, service) => {
    requirePermission.mockRejectedValueOnce(new ForbiddenError("nope"));
    await expect(call()).rejects.toThrow(ForbiddenError);
    expect(service).not.toHaveBeenCalled();
    // Nor does it flush a cache it did not change.
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe("the provider key", () => {
  it("saveMarketProviderAction checks market.providers.manage, not the instrument key", async () => {
    // Editing where the numbers come from is a different privilege from
    // renaming EUR/USD (ADR-087 #5).
    await actions.saveMarketProviderAction(VALID_PROVIDER);
    expect(requirePermission).toHaveBeenCalledWith("market.providers.manage");
  });

  it("testMarketProviderAction checks market.providers.manage", async () => {
    // A connection test reads through the sealed key, so it is gated exactly
    // as editing it is.
    await actions.testMarketProviderAction("EUR/USD");
    expect(requirePermission).toHaveBeenCalledWith("market.providers.manage");
  });

  it("never reaches the service when denied", async () => {
    requirePermission.mockRejectedValueOnce(new ForbiddenError("nope"));
    await expect(actions.saveMarketProviderAction(VALID_PROVIDER)).rejects.toThrow(ForbiddenError);
    expect(saveMarketProvider).not.toHaveBeenCalled();
  });

  it("does not swallow an unauthenticated caller into a no-op", async () => {
    requirePermission.mockRejectedValueOnce(new UnauthenticatedError("no session"));
    await expect(actions.saveMarketProviderAction(VALID_PROVIDER)).rejects.toThrow(
      UnauthenticatedError,
    );
  });
});

describe("parse, don't spread (security.md #6)", () => {
  it("refuses a PAIR with no base or quote before the service sees it", async () => {
    await expect(
      actions.saveInstrumentAction({ ...VALID_INSTRUMENT, base: null, quote: null }),
    ).rejects.toThrow();
    expect(saveInstrument).not.toHaveBeenCalled();
  });

  it("refuses a symbol that is not a code or a slashed pair", async () => {
    await expect(
      actions.saveInstrumentAction({ ...VALID_INSTRUMENT, symbol: "eur usd" }),
    ).rejects.toThrow();
    expect(saveInstrument).not.toHaveBeenCalled();
  });

  it("strips an unknown property rather than passing it through", async () => {
    await actions.saveInstrumentAction({ ...VALID_INSTRUMENT, isAdmin: true });
    expect(saveInstrument.mock.calls[0]![1]).not.toHaveProperty("isAdmin");
  });
});

describe("cache invalidation", () => {
  it("drops the market tag, never content", async () => {
    // ADR-087 #8. Sharing a tag would have an instrument rename invalidate
    // every course page on the site.
    await actions.saveInstrumentAction(VALID_INSTRUMENT);
    expect(revalidateTag).toHaveBeenCalledWith("market", { expire: 0 });
    expect(revalidateTag).not.toHaveBeenCalledWith("content", expect.anything());
  });

  it("does not invalidate on a read-only connection test", async () => {
    await actions.testMarketProviderAction("EUR/USD");
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
