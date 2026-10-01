// A fake Google Cloud Translation Basic (v2) endpoint, for tests (MSW —
// testing.md reserves mocks for the network edge, and this IS that edge).
//
// Exported as `@repo/translate/testing` so a later suite in `@repo/core` (the
// enqueue and job runner, ADR-162) fakes the same endpoint the same way. It
// carries no logic of its own beyond the fake's answer, which is why the
// coverage floor excludes it.
//
// The fake "translates" by prefixing `[target] ` to each segment, so a test
// can see which language a string went to and that markup survived.
import { http, HttpResponse } from "msw";

import { GOOGLE_TRANSLATE_ENDPOINT } from "./google.ts";

export { GOOGLE_TRANSLATE_ENDPOINT };

export interface FakeGoogleCall {
  url: string;
  apiKey: string | null;
  body: { q: string[]; source: string; target: string; format: string };
}

export interface FakeGoogleOptions {
  /** Only this key is accepted; anything else is answered as Google answers a bad key. */
  validKey?: string;
  /** Answer the Nth call (0-based) with this HTTP failure instead. */
  failures?: Record<number, { status: number; reason?: string; detailReason?: string }>;
  /** Replace the default "[target] text" translation. */
  translate?: (segment: string, target: string, format: string) => string;
}

export function fakeGoogleTranslate(options: FakeGoogleOptions = {}) {
  const calls: FakeGoogleCall[] = [];
  const handler = http.post(GOOGLE_TRANSLATE_ENDPOINT, async ({ request }) => {
    const index = calls.length;
    const body = (await request.json()) as FakeGoogleCall["body"];
    const apiKey = request.headers.get("x-goog-api-key");
    calls.push({ url: request.url, apiKey, body });

    const failure = options.failures?.[index];
    if (failure) {
      return HttpResponse.json(
        {
          error: {
            code: failure.status,
            message: "fake failure",
            errors: failure.reason ? [{ reason: failure.reason }] : [],
            details: failure.detailReason ? [{ reason: failure.detailReason }] : [],
          },
        },
        { status: failure.status },
      );
    }
    if (options.validKey !== undefined && apiKey !== options.validKey) {
      return HttpResponse.json(
        {
          error: {
            code: 400,
            message: "API key not valid. Please pass a valid API key.",
            status: "INVALID_ARGUMENT",
            details: [{ reason: "API_KEY_INVALID" }],
          },
        },
        { status: 400 },
      );
    }
    const translate =
      options.translate ?? ((segment: string, target: string) => `[${target}] ${segment}`);
    return HttpResponse.json({
      data: {
        translations: body.q.map((segment) => ({
          translatedText: translate(segment, body.target, body.format),
        })),
      },
    });
  });
  return { handler, calls };
}
