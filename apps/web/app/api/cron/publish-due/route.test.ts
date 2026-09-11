// The sweep endpoint's auth, which is the whole of its behaviour that is not
// `@repo/core`'s (ADR-071 #3). Three cases matter and all three are failure
// modes: an unset secret must fail CLOSED, a wrong secret must not be
// distinguishable from a missing one, and the sweeps must receive ONE `now`
// so articles and content agree on what "due" meant for this run.
//
// `@repo/core` is mocked — this is route-handler wiring. The sweeps' own
// behaviour is `content.integration.test.ts` and `articles.integration.test.ts`,
// against a real database.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const publishDueArticles = vi.fn(async (_now: Date) => 2);
const publishDueContent = vi.fn(async (_now: Date) => 3);

vi.mock("@repo/core", () => ({ publishDueArticles, publishDueContent }));

const { POST } = await import("./route.ts");

const SECRET = "s3cret-value";

function post(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) headers.set("authorization", authorization);
  return new Request("http://localhost/api/cron/publish-due", { method: "POST", headers });
}

const original = process.env.CRON_SECRET;

beforeEach(() => {
  publishDueArticles.mockClear();
  publishDueContent.mockClear();
  process.env.CRON_SECRET = SECRET;
});

afterEach(() => {
  if (original === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = original;
});

describe("POST /api/cron/publish-due", () => {
  it("fails CLOSED when no secret is configured", async () => {
    delete process.env.CRON_SECRET;

    const res = await POST(post(`Bearer ${SECRET}`) as never);

    // 503, never 200: an unset variable must never mean "anyone may publish".
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expect(publishDueArticles).not.toHaveBeenCalled();
    expect(publishDueContent).not.toHaveBeenCalled();
  });

  it("rejects a missing, malformed or wrong bearer token identically", async () => {
    for (const header of [undefined, "", "Basic abc", "Bearer ", "Bearer wrong", SECRET]) {
      const res = await POST(post(header) as never);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    }
    expect(publishDueContent).not.toHaveBeenCalled();
  });

  it("does not throw on a token of a different length", async () => {
    // `timingSafeEqual` throws on a length mismatch, which is why the route
    // compares SHA-256 digests rather than the raw strings. A throw here would
    // surface as a 500 and leak the secret's length through the status code.
    const res = await POST(post("Bearer x") as never);
    expect(res.status).toBe(401);
  });

  it("runs both sweeps against ONE instant and reports the counts", async () => {
    const res = await POST(post(`Bearer ${SECRET}`) as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ articles: 2, content: 3 });

    const articlesNow = publishDueArticles.mock.calls[0]![0];
    const contentNow = publishDueContent.mock.calls[0]![0];
    expect(articlesNow.getTime()).toBe(contentNow.getTime());
  });

  it("is never cached", async () => {
    for (const res of [
      await POST(post() as never),
      await POST(post(`Bearer ${SECRET}`) as never),
    ]) {
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });
});
