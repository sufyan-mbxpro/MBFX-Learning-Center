// ADR-034 §1 compliance: a Range request gets 206 with the right
// Content-Range; a full request is unaffected. `readStoredFile` is mocked
// — this is route-handler wiring, not the storage pipeline (covered in
// @repo/core's own suite).
import { describe, expect, it, vi } from "vitest";

const bytes = new Uint8Array(20).map((_, i) => i); // 0..19

vi.mock("@repo/core", () => ({
  readStoredFile: vi.fn(async (key: string) =>
    key === "known.mp4" ? { bytes, mimeType: "video/mp4" } : null,
  ),
}));

const { GET } = await import("./route.ts");

function req(rangeHeader?: string): Request {
  const headers = new Headers();
  if (rangeHeader) headers.set("range", rangeHeader);
  return new Request("http://localhost/uploads/known.mp4", { headers });
}

function ctx(file: string) {
  return { params: Promise.resolve({ file }) };
}

describe("GET /uploads/[file] — full responses", () => {
  it("404s an unknown key", async () => {
    const res = await GET(req(), ctx("does-not-exist.mp4"));
    expect(res.status).toBe(404);
  });

  it("200s with the full body and Accept-Ranges when no Range header is sent", async () => {
    const res = await GET(req(), ctx("known.mp4"));
    expect(res.status).toBe(200);
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-length")).toBe("20");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body).toEqual(bytes);
  });
});

describe("GET /uploads/[file] — Range requests (ADR-034 §1)", () => {
  it("returns 206 with the correct slice and Content-Range for a bounded range", async () => {
    const res = await GET(req("bytes=5-9"), ctx("known.mp4"));
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 5-9/20");
    expect(res.headers.get("content-length")).toBe("5");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body).toEqual(bytes.subarray(5, 10));
  });

  it("returns 206 for an open-ended range (bytes=10-)", async () => {
    const res = await GET(req("bytes=10-"), ctx("known.mp4"));
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 10-19/20");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body).toEqual(bytes.subarray(10, 20));
  });

  it("returns 206 for a suffix range (bytes=-5, the last 5 bytes)", async () => {
    const res = await GET(req("bytes=-5"), ctx("known.mp4"));
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 15-19/20");
  });

  it("clamps an end past the file length to the last byte", async () => {
    const res = await GET(req("bytes=15-999"), ctx("known.mp4"));
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 15-19/20");
  });

  it("falls back to a full 200 response for a malformed Range header", async () => {
    const res = await GET(req("not-a-range"), ctx("known.mp4"));
    expect(res.status).toBe(200);
  });

  it("falls back to a full 200 response for a multi-range request (unsupported, not split)", async () => {
    const res = await GET(req("bytes=0-1,5-6"), ctx("known.mp4"));
    expect(res.status).toBe(200);
  });
});
