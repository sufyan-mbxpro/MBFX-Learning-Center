// The driver against a faked endpoint (MSW). The real endpoint's behaviour is
// confirmed by the Phase 1 spike when a key is available; these pin what the
// driver does with each answer shape.
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { TranslateError } from "./errors.ts";
import { classifyGoogleError, GOOGLE_TRANSLATE_ENDPOINT, googleTranslateDriver } from "./google.ts";
import { fakeGoogleTranslate } from "./testing.ts";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const request = {
  segments: ["Hello", "World"],
  source: "en",
  target: "ar",
  format: "text" as const,
};

async function reasonFor(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TranslateError) return error.reason;
    throw error;
  }
  throw new Error("expected a failure");
}

describe("googleTranslateDriver", () => {
  it("translates in order and sends the key in a header, never the URL", async () => {
    const fake = fakeGoogleTranslate({ validKey: "k-1" });
    server.use(fake.handler);

    const answers = await googleTranslateDriver("k-1").translate(request);

    expect(answers).toEqual(["[ar] Hello", "[ar] World"]);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.apiKey).toBe("k-1");
    expect(fake.calls[0]?.url).not.toContain("k-1");
    expect(fake.calls[0]?.url).not.toContain("key=");
    expect(fake.calls[0]?.body).toEqual({
      q: ["Hello", "World"],
      source: "en",
      target: "ar",
      format: "text",
    });
  });

  it("reports a rejected key as auth_failed", async () => {
    server.use(fakeGoogleTranslate({ validKey: "right" }).handler);
    expect(await reasonFor(googleTranslateDriver("wrong").translate(request))).toBe("auth_failed");
  });

  it("maps quota, rate and server failures", async () => {
    const cases: Array<[number, string | undefined, string]> = [
      [403, "dailyLimitExceeded", "quota_exceeded"],
      [403, "userRateLimitExceeded", "rate_limited"],
      [429, undefined, "rate_limited"],
      [503, undefined, "provider_error"],
      [400, "invalid", "bad_request"],
    ];
    for (const [status, reason, expected] of cases) {
      server.use(fakeGoogleTranslate({ failures: { 0: { status, reason } } }).handler);
      expect(await reasonFor(googleTranslateDriver("k").translate(request))).toBe(expected);
      server.resetHandlers();
    }
  });

  it("refuses a 200 whose shape it cannot trust", async () => {
    server.use(
      http.post(GOOGLE_TRANSLATE_ENDPOINT, () =>
        HttpResponse.json({ data: { translations: [{ translatedText: "only one" }] } }),
      ),
    );
    expect(await reasonFor(googleTranslateDriver("k").translate(request))).toBe("network_error");

    server.use(http.post(GOOGLE_TRANSLATE_ENDPOINT, () => new HttpResponse("not json")));
    expect(await reasonFor(googleTranslateDriver("k").translate(request))).toBe("network_error");
  });

  it("reports an unreachable endpoint as network_error", async () => {
    server.use(http.post(GOOGLE_TRANSLATE_ENDPOINT, () => HttpResponse.error()));
    expect(await reasonFor(googleTranslateDriver("k").translate(request))).toBe("network_error");
  });

  it("lets an abort through as an abort", async () => {
    server.use(fakeGoogleTranslate().handler);
    const controller = new AbortController();
    controller.abort();
    await expect(googleTranslateDriver("k").translate(request, controller.signal)).rejects.toThrow(
      /abort/i,
    );
  });
});

describe("classifyGoogleError", () => {
  it("reads the reason from details as well as errors", () => {
    expect(
      classifyGoogleError(403, { error: { details: [{ reason: "SERVICE_DISABLED" }] } }).reason,
    ).toBe("auth_failed");
    expect(classifyGoogleError(401, null).reason).toBe("auth_failed");
    expect(
      classifyGoogleError(403, { error: { errors: [{ reason: "quotaExceeded" }] } }).reason,
    ).toBe("quota_exceeded");
  });

  it("never carries Google's message", () => {
    const error = classifyGoogleError(400, {
      error: { errors: [{ reason: "invalid" }] },
    });
    expect(error.message).toBe("Google Translate answered 400");
  });
});
