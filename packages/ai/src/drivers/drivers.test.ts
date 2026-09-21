// Driver-level HTTP shape, with MSW at the network edge and nowhere else
// (testing.md: MSW is for faking external APIs, never our own packages).
//
// **`onUnhandledRequest: "error"` is non-negotiable here.** The market driver's
// trailing-slash bug is why: a request that goes somewhere unexpected must fail
// the suite rather than 404 quietly and look like a rejected API key.
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { AiRequest } from "../provider.ts";
import { anthropicDriver } from "./anthropic.ts";
import { openAiDriver } from "./openai.ts";

const BASE = "https://ai.test";

const server = setupServer();

/**
 * An SSE body the SDKs' stream readers actually finish reading.
 *
 * A plain string `HttpResponse` leaves the reader waiting for a close that
 * never comes, and the test hangs until the driver's own 60s timeout — which
 * looks exactly like a provider being slow. An explicit `ReadableStream` that
 * closes is the difference.
 */
function sse(events: string[]): HttpResponse<ReadableStream<Uint8Array>> {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (const event of events) controller.enqueue(encoder.encode(event));
      controller.close();
    },
  });
  return new HttpResponse(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function request(overrides: Partial<AiRequest> = {}): AiRequest {
  return {
    modelId: "claude-opus-5",
    system: "system text",
    messages: [{ role: "user", content: "hello" }],
    maxOutputTokens: 500,
    effort: "medium",
    ...overrides,
  };
}

describe("the Anthropic driver", () => {
  it("sends adaptive thinking and an effort for a Claude 5 model", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${BASE}/v1/messages`, async ({ request: req }) => {
        body = (await req.json()) as Record<string, unknown>;
        return HttpResponse.json({
          content: [{ type: "text", text: "answer" }],
          usage: { input_tokens: 10, output_tokens: 5 },
        });
      }),
    );

    await anthropicDriver({ apiKey: "k", baseUrl: BASE }).complete(request());
    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.output_config).toEqual({ effort: "medium" });
    expect(body.budget_tokens).toBeUndefined();
  });

  it("sends a token budget for Haiku 4.5 instead, which rejects effort", async () => {
    // Not a style choice: `budget_tokens` is a 400 on the Claude 5 family and
    // `output_config.effort` is a 400 on Haiku 4.5. Sending one model's shape
    // to the other is a failed call, not a degraded one — and Haiku is the
    // seeded LIGHT tier, so it would be every alt-text and grammar call.
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${BASE}/v1/messages`, async ({ request: req }) => {
        body = (await req.json()) as Record<string, unknown>;
        return HttpResponse.json({
          content: [{ type: "text", text: "answer" }],
          usage: { input_tokens: 10, output_tokens: 5 },
        });
      }),
    );

    await anthropicDriver({ apiKey: "k", baseUrl: BASE }).complete(
      request({ modelId: "claude-haiku-4-5", maxOutputTokens: 4000, effort: "low" }),
    );
    expect(body.thinking).toEqual({ type: "enabled", budget_tokens: 1024 });
    expect(body.output_config).toBeUndefined();
  });

  it("omits thinking entirely when the ceiling is too small to think under", async () => {
    // `budget_tokens` must be strictly less than `max_tokens`, so a 200-token
    // alt-text call cannot afford to think — and asking anyway is a 400.
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${BASE}/v1/messages`, async ({ request: req }) => {
        body = (await req.json()) as Record<string, unknown>;
        return HttpResponse.json({
          content: [{ type: "text", text: "a" }],
          usage: { input_tokens: 1, output_tokens: 1 },
        });
      }),
    );

    await anthropicDriver({ apiKey: "k", baseUrl: BASE }).complete(
      request({ modelId: "claude-haiku-4-5", maxOutputTokens: 200, effort: "low" }),
    );
    expect(body.thinking).toBeUndefined();
  });

  it("keeps cache-creation and cache-read tokens apart", async () => {
    // ADR-100 #1 and ADR-099's fourth reason for owning the seam: the two are
    // priced differently, so a layer that flattened them to
    // `{ promptTokens, completionTokens }` would make the cost wrong by design.
    server.use(
      http.post(`${BASE}/v1/messages`, () =>
        HttpResponse.json({
          content: [{ type: "text", text: "answer" }],
          usage: {
            input_tokens: 100,
            output_tokens: 20,
            cache_creation_input_tokens: 30,
            cache_read_input_tokens: 400,
          },
        }),
      ),
    );

    const result = await anthropicDriver({ apiKey: "k", baseUrl: BASE }).complete(request());
    // Cache WRITES bill near the input rate, so they join `inputTokens`; cache
    // READS bill at a tenth, so they stay separate.
    expect(result.usage.inputTokens).toBe(130);
    expect(result.usage.cachedInputTokens).toBe(400);
    expect(result.usage.outputTokens).toBe(20);
  });

  it("puts images before the text of the first user message", async () => {
    let body: { messages?: Array<{ content: unknown }> } = {};
    server.use(
      http.post(`${BASE}/v1/messages`, async ({ request: req }) => {
        body = (await req.json()) as typeof body;
        return HttpResponse.json({
          content: [{ type: "text", text: "a" }],
          usage: { input_tokens: 1, output_tokens: 1 },
        });
      }),
    );

    await anthropicDriver({ apiKey: "k", baseUrl: BASE }).complete(
      request({ images: [{ mimeType: "image/png", base64: "AAAA" }] }),
    );

    const content = body.messages?.[0]?.content as Array<{ type: string }>;
    expect(content[0]?.type).toBe("image");
    expect(content[1]?.type).toBe("text");
  });

  it("normalises a base URL copied out of an address bar", async () => {
    // The whole bug: "https://ai.test/" + the SDK's own path = "//v1/messages",
    // which fails in a way that reads exactly like a rejected key.
    server.use(
      http.post(`${BASE}/v1/messages`, () =>
        HttpResponse.json({
          content: [{ type: "text", text: "answer" }],
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      ),
    );
    const { normalizeBaseUrl } = await import("../provider.ts");
    const driver = anthropicDriver({
      apiKey: "k",
      baseUrl: normalizeBaseUrl(`${BASE}//`),
    });
    await expect(driver.complete(request())).resolves.toMatchObject({ text: "answer" });
  });

  it("streams deltas in order and carries usage on the last chunk", async () => {
    const events = [
      // A COMPLETE message_start: the SDK's stream helper accumulates a final
      // message from these events, and a partial one leaves it waiting until
      // the driver's own 60s timeout — which reads as "the provider is slow".
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-5","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":12,"output_tokens":0}}}\n\n',
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"one "}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"two"}}\n\n',
      'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","delta":{},"usage":{"output_tokens":7}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ];

    server.use(http.post(`${BASE}/v1/messages`, () => sse(events)));

    const chunks = [];
    for await (const chunk of anthropicDriver({ apiKey: "k", baseUrl: BASE }).stream(request())) {
      chunks.push(chunk);
    }

    expect(chunks.filter((c) => c.text).map((c) => c.text)).toEqual(["one ", "two"]);
    const last = chunks.at(-1);
    expect(last?.usage?.outputTokens).toBe(7);
    expect(last?.usage?.inputTokens).toBe(12);
  });

  it("asks the provider to count input tokens rather than guessing", async () => {
    server.use(
      http.post(`${BASE}/v1/messages/count_tokens`, () =>
        HttpResponse.json({ input_tokens: 4242 }),
      ),
    );
    const count = await anthropicDriver({ apiKey: "k", baseUrl: BASE }).countInputTokens(request());
    expect(count).toBe(4242);
  });
});

describe("the OpenAI driver", () => {
  it("subtracts cached tokens from the prompt total", async () => {
    // `prompt_tokens` INCLUDES the cached half here, unlike Anthropic's.
    // Getting it backwards double-counts the cheapest tokens at the full rate.
    server.use(
      http.post(`${BASE}/chat/completions`, () =>
        HttpResponse.json({
          choices: [{ message: { content: "answer" } }],
          usage: {
            prompt_tokens: 500,
            completion_tokens: 20,
            prompt_tokens_details: { cached_tokens: 400 },
          },
        }),
      ),
    );

    const result = await openAiDriver({ apiKey: "k", baseUrl: BASE }).complete(
      request({ modelId: "gpt-5.1" }),
    );
    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.cachedInputTokens).toBe(400);
  });

  it("sends the system prompt as a system message", async () => {
    let body: { messages?: Array<{ role: string }> } = {};
    server.use(
      http.post(`${BASE}/chat/completions`, async ({ request: req }) => {
        body = (await req.json()) as typeof body;
        return HttpResponse.json({
          choices: [{ message: { content: "a" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        });
      }),
    );

    await openAiDriver({ apiKey: "k", baseUrl: BASE }).complete(request({ modelId: "gpt-5.1" }));
    expect(body.messages?.[0]?.role).toBe("system");
    expect(body.messages?.[1]?.role).toBe("user");
  });

  it("sends an image as a data URL of bytes we already hold, never a remote URL", async () => {
    // security.md #9 restated for a client that would happily follow one.
    let body: { messages?: Array<{ content: unknown }> } = {};
    server.use(
      http.post(`${BASE}/chat/completions`, async ({ request: req }) => {
        body = (await req.json()) as typeof body;
        return HttpResponse.json({
          choices: [{ message: { content: "a" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        });
      }),
    );

    await openAiDriver({ apiKey: "k", baseUrl: BASE }).complete(
      request({ modelId: "gpt-5.1", images: [{ mimeType: "image/png", base64: "AAAA" }] }),
    );

    const content = body.messages?.[1]?.content as Array<{ image_url?: { url: string } }>;
    expect(content[0]?.image_url?.url).toBe("data:image/png;base64,AAAA");
    expect(content[0]?.image_url?.url.startsWith("http")).toBe(false);
  });

  it("asks for usage on the stream, or every streamed call meters as free", async () => {
    let body: Record<string, unknown> = {};
    const events = [
      'data: {"choices":[{"delta":{"content":"one "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"two"}}]}\n\n',
      'data: {"choices":[],"usage":{"prompt_tokens":9,"completion_tokens":3}}\n\n',
      "data: [DONE]\n\n",
    ];
    server.use(
      http.post(`${BASE}/chat/completions`, async ({ request: req }) => {
        body = (await req.json()) as Record<string, unknown>;
        return sse(events);
      }),
    );

    const chunks = [];
    for await (const chunk of openAiDriver({ apiKey: "k", baseUrl: BASE }).stream(
      request({ modelId: "gpt-5.1" }),
    )) {
      chunks.push(chunk);
    }

    expect(body.stream_options).toEqual({ include_usage: true });
    expect(chunks.filter((c) => c.text).map((c) => c.text)).toEqual(["one ", "two"]);
    expect(chunks.at(-1)?.usage?.outputTokens).toBe(3);
  });

  it("over-estimates input tokens, because a budget check that under-estimates is not a budget", async () => {
    const driver = openAiDriver({ apiKey: "k", baseUrl: BASE });
    const long = "x".repeat(4000);
    const estimate = await driver.countInputTokens(
      request({ modelId: "gpt-5.1", system: long, messages: [{ role: "user", content: long }] }),
    );
    // 8000 characters is ~2000 tokens at the usual ratio; the estimate must sit
    // above that, never below.
    expect(estimate).toBeGreaterThan(2000);
  });
});

// ─── Model discovery and compatible gateways (ADR-120) ───────

describe("model discovery", () => {
  it("tests an Anthropic key with the Models API, never a billed message", async () => {
    let listed = 0;
    server.use(
      http.get(`${BASE}/v1/models`, () => {
        listed += 1;
        return HttpResponse.json({ data: [], has_more: false, first_id: null, last_id: null });
      }),
    );
    // No POST handler: a message sent by `test()` fails the suite on
    // `onUnhandledRequest: "error"`.
    await anthropicDriver({ apiKey: "k", baseUrl: BASE }).test();
    expect(listed).toBe(1);
  });

  it("lists Anthropic models with their names, ceilings and vision support", async () => {
    server.use(
      http.get(`${BASE}/v1/models`, () =>
        HttpResponse.json({
          data: [
            {
              type: "model",
              id: "claude-opus-5",
              display_name: "Claude Opus 5",
              created_at: "2026-01-01T00:00:00Z",
              max_tokens: 128000,
              max_input_tokens: 1000000,
              capabilities: { image_input: { supported: true } },
            },
            {
              type: "model",
              id: "claude-haiku-4-5",
              display_name: "Claude Haiku 4.5",
              created_at: "2025-10-01T00:00:00Z",
              max_tokens: null,
              max_input_tokens: null,
              capabilities: null,
            },
          ],
          has_more: false,
          first_id: "claude-opus-5",
          last_id: "claude-haiku-4-5",
        }),
      ),
    );

    const models = await anthropicDriver({ apiKey: "k", baseUrl: BASE }).listModels();
    expect(models).toEqual([
      {
        modelId: "claude-opus-5",
        label: "Claude Opus 5",
        maxOutputTokens: 128000,
        supportsVision: true,
        inputPricePerMTok: null,
        outputPricePerMTok: null,
      },
      {
        modelId: "claude-haiku-4-5",
        label: "Claude Haiku 4.5",
        maxOutputTokens: null,
        supportsVision: null,
        inputPricePerMTok: null,
        outputPricePerMTok: null,
      },
    ]);
  });

  it("lists OpenAI-compatible models alphabetically, reading gateway extras when present", async () => {
    server.use(
      http.get(`${BASE}/models`, () =>
        HttpResponse.json({
          object: "list",
          data: [
            { id: "plain-model", object: "model", created: 0, owned_by: "x" },
            {
              id: "anthropic/claude-sonnet-5",
              object: "model",
              created: 0,
              owned_by: "x",
              name: "Anthropic: Claude Sonnet 5",
              top_provider: { max_completion_tokens: 64000 },
              architecture: { input_modalities: ["text", "image"] },
              pricing: { prompt: "0.000002", completion: "0.00001" },
            },
          ],
        }),
      ),
    );

    const models = await openAiDriver({ apiKey: "k", baseUrl: BASE }).listModels();
    expect(models.map((m) => m.modelId)).toEqual(["anthropic/claude-sonnet-5", "plain-model"]);
    expect(models[0]).toEqual({
      modelId: "anthropic/claude-sonnet-5",
      label: "Anthropic: Claude Sonnet 5",
      maxOutputTokens: 64000,
      supportsVision: true,
      // USD per token → per MILLION, without float noise.
      inputPricePerMTok: 2,
      outputPricePerMTok: 10,
    });
    expect(models[1]).toMatchObject({
      label: "plain-model",
      maxOutputTokens: null,
      supportsVision: null,
      inputPricePerMTok: null,
    });
  });

  it("proves a key on the preset's check path when the model list is public", async () => {
    let checked = false;
    server.use(
      http.get(`${BASE}/key`, ({ request: req }) => {
        checked = req.headers.get("authorization") === "Bearer sk-or-k";
        return HttpResponse.json({ data: { label: "k" } });
      }),
    );
    await openAiDriver({ apiKey: "sk-or-k", baseUrl: BASE, keyCheckPath: "/key" }).test();
    expect(checked).toBe(true);
  });

  it("maps a rejected key to a thrown error the classifier reads as provider_auth", async () => {
    server.use(
      http.get(`${BASE}/models`, () =>
        HttpResponse.json({ error: { message: "bad key" } }, { status: 401 }),
      ),
    );
    await expect(openAiDriver({ apiKey: "bad", baseUrl: BASE }).test()).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("the OpenAI driver on a compatible gateway", () => {
  it("sends max_tokens when the preset says so, and records the gateway's own kind", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${BASE}/chat/completions`, async ({ request: req }) => {
        body = (await req.json()) as Record<string, unknown>;
        return HttpResponse.json({
          choices: [{ message: { content: "a" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        });
      }),
    );

    const driver = openAiDriver({
      apiKey: "k",
      baseUrl: BASE,
      kind: "DEEPSEEK",
      maxTokensParam: "max_tokens",
    });
    await driver.complete(request({ modelId: "deepseek-chat", maxOutputTokens: 321 }));
    expect(driver.kind).toBe("DEEPSEEK");
    expect(body.max_tokens).toBe(321);
    expect(body.max_completion_tokens).toBeUndefined();
  });

  it("leaves stream_options out for a gateway that rejects unknown fields", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${BASE}/chat/completions`, async ({ request: req }) => {
        body = (await req.json()) as Record<string, unknown>;
        return sse([
          'data: {"choices":[{"delta":{"content":"hi"}}],"usage":{"prompt_tokens":2,"completion_tokens":1}}\n\n',
          "data: [DONE]\n\n",
        ]);
      }),
    );

    const chunks = [];
    for await (const chunk of openAiDriver({
      apiKey: "k",
      baseUrl: BASE,
      kind: "MISTRAL",
      streamUsageOption: false,
    }).stream(request({ modelId: "mistral-large-latest" }))) {
      chunks.push(chunk);
    }
    expect(body).not.toHaveProperty("stream_options");
    // Usage reported unasked is still metered.
    expect(chunks.at(-1)?.usage?.outputTokens).toBe(1);
  });
});
