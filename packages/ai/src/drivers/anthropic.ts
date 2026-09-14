// The Anthropic driver (ADR-099).
//
// The official SDK does retries, timeouts and typed errors, which is most of
// why the seam is thin: what this file owns is the translation between our
// `AiRequest` and the Messages API, and the extraction of the usage block the
// cost figure is computed from.
//
// **Token accounting is provider-shaped and we need it exact** (ADR-100 #1).
// Anthropic reports `input_tokens`, `output_tokens`, `cache_creation_input_tokens`
// and `cache_read_input_tokens` separately, and the last two are priced
// differently — a normalising layer that flattened them to
// `{ promptTokens, completionTokens }` would make our cost figure wrong by
// design. That is the fourth reason this is not the Vercel AI SDK.
import Anthropic from "@anthropic-ai/sdk";
import type { AiProviderKind } from "@repo/db";

import type { AiChunk, AiDriver, AiRequest, AiResult, AiUsageCounts } from "../provider.ts";

interface AnthropicOptions {
  apiKey: string;
  baseUrl?: string | undefined;
}

/**
 * Which models take adaptive thinking, and which still take a token budget.
 *
 * This is a table of PROVIDER FACTS, enumerated by exact id — not meaning
 * derived from a model id's shape, which is what `AiModel.modelId`'s schema
 * comment refuses. It exists because the two are genuinely different request
 * shapes: `budget_tokens` is rejected with a 400 on the Claude 5 family, and
 * `output_config.effort` is rejected on Haiku 4.5. Sending one model's shape to
 * the other is not a degraded call, it is a failed one.
 *
 * A model this table does not name gets the modern shape, because that is the
 * direction the provider moves and a new model id is far more likely to be a
 * newer model than an older one.
 */
const BUDGET_THINKING_MODELS = new Set(["claude-haiku-4-5", "claude-haiku-4-5-20251001"]);

/** The budget a `budget_tokens` model gets per effort step. Minimum is 1024. */
const THINKING_BUDGETS = { low: 1024, medium: 2048, high: 4096 } as const;

function toMessages(req: AiRequest): Anthropic.MessageParam[] {
  const images = req.images ?? [];
  return req.messages.map((message, index) => {
    // Images ride with the FIRST user message: they are the material the whole
    // conversation is about, and the provider wants them before the text they
    // are described by.
    if (index !== 0 || message.role !== "user" || images.length === 0) {
      return { role: message.role, content: message.content };
    }
    const content: Anthropic.ContentBlockParam[] = images.map((image) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mimeType as "image/png",
        data: image.base64,
      },
    }));
    content.push({ type: "text", text: message.content });
    return { role: "user", content };
  });
}

function toUsage(usage: {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}): AiUsageCounts {
  return {
    inputTokens: (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
    outputTokens: usage.output_tokens ?? 0,
    cachedInputTokens: usage.cache_read_input_tokens ?? 0,
  };
}

/** The thinking + effort half of a request, which is code and never a control. */
function thinkingParams(req: AiRequest): Record<string, unknown> {
  if (BUDGET_THINKING_MODELS.has(req.modelId)) {
    const budget = THINKING_BUDGETS[req.effort];
    // `budget_tokens` must be strictly less than `max_tokens`, so a small
    // output ceiling wins: a 200-token alt-text call cannot afford to think.
    if (budget >= req.maxOutputTokens) return {};
    return { thinking: { type: "enabled", budget_tokens: budget } };
  }
  return {
    thinking: { type: "adaptive" },
    output_config: { effort: req.effort },
  };
}

export function anthropicDriver(options: AnthropicOptions): AiDriver {
  const kind: AiProviderKind = "ANTHROPIC";
  const client = new Anthropic({
    apiKey: options.apiKey,
    ...(options.baseUrl ? { baseURL: options.baseUrl } : {}),
    // Bounded on purpose (plan §8.3 step 8). A timeout is ONE `FAILED` row,
    // never a silent retry loop that bills three times for one suggestion.
    maxRetries: 2,
    timeout: 60_000,
  });

  return {
    kind,
    async complete(req, signal) {
      const response = await client.messages.create(
        {
          model: req.modelId,
          max_tokens: req.maxOutputTokens,
          system: req.system,
          messages: toMessages(req),
          ...thinkingParams(req),
        } as Anthropic.MessageCreateParamsNonStreaming,
        signal ? { signal } : {},
      );

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      return { text, usage: toUsage(response.usage) } satisfies AiResult;
    },

    async *stream(req, signal) {
      const stream = client.messages.stream(
        {
          model: req.modelId,
          max_tokens: req.maxOutputTokens,
          system: req.system,
          messages: toMessages(req),
          ...thinkingParams(req),
        } as Anthropic.MessageStreamParams,
        signal ? { signal } : {},
      );

      // The usage block arrives in two halves: input counts on `message_start`,
      // output counts on `message_delta`. Both are accumulated and emitted on
      // the LAST chunk, so an aborted stream still meters what was billed.
      let usage: AiUsageCounts = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
      try {
        for await (const event of stream) {
          if (event.type === "message_start") {
            usage = toUsage(event.message.usage);
          } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            yield { text: event.delta.text } satisfies AiChunk;
          } else if (event.type === "message_delta") {
            // `message_delta` carries the OUTPUT count, and may or may not
            // repeat the input ones depending on API version. Merging only the
            // fields it actually reports is what keeps the input count from
            // `message_start` — writing the whole object back would zero it,
            // and a stream would meter as if its prompt were free.
            const delta = event.usage as {
              output_tokens?: number | null;
              input_tokens?: number | null;
              cache_read_input_tokens?: number | null;
              cache_creation_input_tokens?: number | null;
            };
            usage = {
              inputTokens:
                delta.input_tokens == null
                  ? usage.inputTokens
                  : delta.input_tokens + (delta.cache_creation_input_tokens ?? 0),
              outputTokens: delta.output_tokens ?? usage.outputTokens,
              cachedInputTokens: delta.cache_read_input_tokens ?? usage.cachedInputTokens,
            };
          }
        }
      } finally {
        // In a `finally` so that an abort mid-stream still yields the counts —
        // the provider bills them, so a row that pretends otherwise
        // under-reports spend.
        yield { usage } satisfies AiChunk;
      }
    },

    async countInputTokens(req) {
      // The provider's own count, never a local tokenizer: a third-party guess
      // at a first-party fact is wrong for exactly the cases that cost most
      // (ADR-100 #1).
      const response = await client.messages.countTokens({
        model: req.modelId,
        system: req.system,
        messages: toMessages(req),
      });
      return response.input_tokens;
    },

    async test() {
      // One token against the cheapest possible request. It proves the key, the
      // host and the network — and nothing about whether a given model is
      // enabled on the account, which the error message will say if it is not.
      await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      });
    },
  };
}
