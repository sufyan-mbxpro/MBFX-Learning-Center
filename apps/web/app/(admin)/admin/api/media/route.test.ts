// ADR-067 §2 — the media browser's read endpoint. Gate first, parse second,
// and no query it accepts can ask for the whole library.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MAX_MEDIA_PAGE_SIZE, MEDIA_PAGE_SIZE } from "@repo/contracts";

class ForbiddenError extends Error {}
class UnauthenticatedError extends Error {}

const requirePermission = vi.fn(async () => ({ id: "actor-1" }));
const listMediaAssets = vi.fn(async () => ({ items: [], nextCursor: null }));
const getMediaFacets = vi.fn(async () => ({ byCategory: {}, total: {} }));
const getRecentlyUsedMedia = vi.fn(async () => []);

vi.mock("@repo/rbac", () => ({ requirePermission, ForbiddenError, UnauthenticatedError }));
vi.mock("@repo/core", () => ({ listMediaAssets, getMediaFacets, getRecentlyUsedMedia }));

const { GET } = await import("./route.ts");

const call = (query: string) => GET(new Request(`http://localhost/admin/api/media?${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ id: "actor-1" });
  listMediaAssets.mockResolvedValue({ items: [], nextCursor: null });
});

describe("authorization", () => {
  it("checks media.view before reading anything (security.md #3 — never assume the proxy ran)", async () => {
    await call("category=news");
    expect(requirePermission).toHaveBeenCalledWith("media.view");
  });

  it("does not swallow a denial into an empty result", async () => {
    requirePermission.mockRejectedValueOnce(new ForbiddenError("nope"));
    await expect(call("category=news")).rejects.toThrow(ForbiddenError);
    expect(listMediaAssets).not.toHaveBeenCalled();
  });
});

describe("input is parsed, never cast (security.md #6)", () => {
  it("400s an unregistered kind instead of passing it through", async () => {
    const response = await call("kind=EMBED");
    expect(response.status).toBe(400);
    expect(listMediaAssets).not.toHaveBeenCalled();
  });

  it("400s an unregistered category", async () => {
    expect((await call("category=invoices")).status).toBe(400);
  });

  it("400s a folder outside a registered category", async () => {
    expect((await call("folder=%2Funknown%2Fx")).status).toBe(400);
  });
});

describe("no request can be unbounded (ADR-067 §1)", () => {
  it("clamps an oversized limit to the ceiling", async () => {
    await call("limit=9999");
    expect(listMediaAssets).toHaveBeenCalledWith(
      expect.objectContaining({ limit: MAX_MEDIA_PAGE_SIZE }),
    );
  });

  it("defaults a missing or nonsense limit to one page", async () => {
    await call("category=news");
    expect(listMediaAssets).toHaveBeenCalledWith(
      expect.objectContaining({ limit: MEDIA_PAGE_SIZE }),
    );
    await call("limit=abc");
    expect(listMediaAssets).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: MEDIA_PAGE_SIZE }),
    );
  });

  it("clamps zero and negatives up rather than reading everything", async () => {
    await call("limit=0");
    expect(listMediaAssets).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }));
  });
});

describe("chrome rides along with the first page, and only when asked", () => {
  it("fetches facets and recents only for include=facets,recent", async () => {
    await call("category=news&kind=IMAGE");
    expect(getMediaFacets).not.toHaveBeenCalled();
    expect(getRecentlyUsedMedia).not.toHaveBeenCalled();

    await call("category=news&kind=IMAGE&include=facets,recent&sourceType=ARTICLE");
    expect(getMediaFacets).toHaveBeenCalledTimes(1);
    expect(getRecentlyUsedMedia).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "ARTICLE" }),
    );
  });

  it("does not pay for usage counts the picker never renders (ADR-067 §4)", async () => {
    await call("category=news");
    expect(listMediaAssets).toHaveBeenCalledWith(expect.not.objectContaining({ withUsage: true }));
  });

  it("caches privately and briefly — the response is permission-scoped", async () => {
    const response = await call("category=news");
    expect(response.headers.get("cache-control")).toBe("private, max-age=30");
  });
});
