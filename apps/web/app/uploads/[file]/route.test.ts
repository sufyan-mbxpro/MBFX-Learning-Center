// ADR-034 §1 compliance: a Range request gets 206 with the right
// Content-Range; a full request is unaffected. The @repo/core readers are
// mocked — this is route-handler wiring, not the storage pipeline (covered
// in @repo/core's own suite).
//
// changes-13 adds the one that matters at video scale: a partial request
// must NEVER read the whole object. `readStoredFile` is spied on for
// exactly that.
import { describe, expect, it, vi } from "vitest";

const bytes = new Uint8Array(20).map((_, i) => i); // 0..19

const readStoredFile = vi.fn(async (key: string) =>
  key === "known.mp4" || key === "known.pdf"
    ? { bytes, mimeType: key === "known.pdf" ? "application/pdf" : "video/mp4" }
    : null,
);
const META: Record<string, { mimeType: string; size: number; kind: string; fileName: string }> = {
  "known.mp4": {
    mimeType: "video/mp4",
    size: bytes.byteLength,
    kind: "VIDEO",
    fileName: "lesson.mp4",
  },
  "known.pdf": {
    mimeType: "application/pdf",
    size: bytes.byteLength,
    kind: "DOCUMENT",
    fileName: "risk-guide.pdf",
  },
};
const readStoredFileMeta = vi.fn(async (key: string) => META[key] ?? null);
const readStoredFileRange = vi.fn(async (key: string, start: number, end: number) =>
  key in META ? bytes.subarray(start, end + 1) : null,
);
// The header's own shape is core's test; here it only matters that the route
// asks core and passes the answer through untouched.
const contentDispositionFor = vi.fn((kind: string, fileName: string) =>
  kind === "DOCUMENT" ? `attachment; filename="${fileName}"` : null,
);

vi.mock("@repo/core", () => ({
  contentDispositionFor,
  readStoredFile,
  readStoredFileMeta,
  readStoredFileRange,
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

describe("GET /uploads/[file] — a document downloads, a video plays (ADR-034 §1)", () => {
  it("sets Content-Disposition for a DOCUMENT and never for a renderable kind", async () => {
    const doc = await GET(new Request("http://localhost/uploads/known.pdf"), ctx("known.pdf"));
    expect(doc.headers.get("content-disposition")).toBe('attachment; filename="risk-guide.pdf"');
    expect(doc.headers.get("content-type")).toBe("application/pdf");

    const video = await GET(req(), ctx("known.mp4"));
    expect(video.headers.get("content-disposition")).toBeNull();
  });

  it("keeps the header on a partial response too, so a resumed download stays a download", async () => {
    const res = await GET(
      new Request("http://localhost/uploads/known.pdf", { headers: { range: "bytes=5-9" } }),
      ctx("known.pdf"),
    );
    expect(res.status).toBe(206);
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="risk-guide.pdf"');
  });
});

describe("GET /uploads/[file] — a partial request never materialises the object", () => {
  it("reads only the requested range, and reads the whole file only for a full response", async () => {
    readStoredFile.mockClear();
    readStoredFileRange.mockClear();

    await GET(req("bytes=5-9"), ctx("known.mp4"));
    // The finding this fixes: the old handler read all 20 bytes (100 MB, in
    // production) and then sliced 5 out of them.
    expect(readStoredFile).not.toHaveBeenCalled();
    expect(readStoredFileRange).toHaveBeenCalledWith("known.mp4", 5, 9);

    await GET(req(), ctx("known.mp4"));
    expect(readStoredFile).toHaveBeenCalledTimes(1);
  });
});
