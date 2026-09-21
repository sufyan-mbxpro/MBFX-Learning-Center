// The OpenAI driver (ADR-099).
//
// The same shape as the Anthropic one, and the differences are the point: the
// usage block has different names, there is no first-party token-count
// endpoint, and cached input arrives nested. A normalising library would hide
// exactly these differences, and ADR-100 needs them.
//
// Since ADR-120 it is also the driver for every OpenAI-COMPATIBLE vendor —
// Gemini, Grok, DeepSeek, Mistral, OpenRouter and a custom gateway. What
// differs between them is a handful of provider facts, and those arrive as
// options from `AI_PROVIDER_PRESETS` rather than as branches on a kind here.
import type { AiDiscoveredModel } from "@repo/contracts";
import type { AiProviderKind } from "@repo/db";
import OpenAI from "openai";

import type { AiChunk, AiDriver, AiRequest, AiResult, AiUsageCounts } from "../provider.ts";

interface OpenAiOptions {
  apiKey: string;
  baseUrl?: string | undefined;
  /** Which kind the usage row records. Defaults to OPENAI. */
  kind?: AiProviderKind;
  maxTokensParam?: "max_tokens" | "max_completion_tokens";
  streamUsageOption?: boolean;
  /** A path that requires the key, for a gateway whose `/models` is public. */
  keyCheckPath?: string | null;
}

/**
 * The fields a compatible gateway MAY add to a `/models` entry. OpenAI's own
 * list has none of them; OpenRouter has all of them. Read defensively, never
 * required — a list that carries only ids is still a complete answer.
 */
interface ExtendedModel {
  id: string;
  name?: unknown;
  display_name?: unknown;
  context_length?: unknown;
  top_provider?: { max_completion_tokens?: unknown } | null;
  architecture?: { input_modalities?: unknown } | null;
  pricing?: { prompt?: unknown; completion?: unknown } | null;
}

/** USD per token, as a string or number, → USD per million tokens. */
function perMillion(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
  // Rounded to the column's six places, so 0.000003 is 3 and not 2.9999999.
  return Math.round(n * 1_000_000 * 1_000_000) / 1_000_000;
}

export function toDiscoveredModel(model: ExtendedModel): AiDiscoveredModel {
  const label =
    typeof model.name === "string" && model.name
      ? model.name
      : typeof model.display_name === "string" && model.display_name
        ? model.display_name
        : model.id;
  const maxOut = model.top_provider?.max_completion_tokens;
  const modalities = model.architecture?.input_modalities;
  return {
    modelId: model.id,
    label: label.slice(0, 80),
    maxOutputTokens: typeof maxOut === "number" && maxOut > 0 ? maxOut : null,
    supportsVision: Array.isArray(modalities) ? modalities.includes("image") : null,
    inputPricePerMTok: perMillion(model.pricing?.prompt),
    outputPricePerMTok: perMillion(model.pricing?.completion),
  };
}

function toMessages(req: AiRequest): OpenAI.Chat.ChatCompletionMessageParam[] {
  const images = req.images ?? [];
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: req.system },
  ];

  req.messages.forEach((message, index) => {
    if (index !== 0 || message.role !== "user" || images.length === 0) {
      messages.push(
        message.role === "user"
          ? { role: "user", content: message.content }
          : { role: "assistant", content: message.content },
      );
      return;
    }
    const content: OpenAI.Chat.ChatCompletionContentPart[] = images.map((image) => ({
      type: "image_url",
      // A DATA URL of bytes we already hold — never a remote URL. security.md
      // #9 restated for a client that would happily follow one: the model is
      // never handed a URL to fetch, and we never fetch one for it.
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
    }));
    content.push({ type: "text", text: message.content });
    messages.push({ role: "user", content });
  });

  return messages;
}

function toUsage(usage: OpenAI.CompletionUsage | undefined): AiUsageCounts {
  const cached = usage?.prompt_tokens_details?.cached_tokens ?? 0;
  return {
    // `prompt_tokens` INCLUDES the cached half, unlike Anthropic's, so the
    // uncached figure is a subtraction. Getting this backwards would double
    // count the cheapest tokens at the full rate.
    inputTokens: Math.max(0, (usage?.prompt_tokens ?? 0) - cached),
    outputTokens: usage?.completion_tokens ?? 0,
    cachedInputTokens: cached,
  };
}

export function openAiDriver(options: OpenAiOptions): AiDriver {
  const kind: AiProviderKind = options.kind ?? "OPENAI";
  const maxTokensParam = options.maxTokensParam ?? "max_completion_tokens";
  const streamUsageOption = options.streamUsageOption ?? true;
  const client = new OpenAI({
    apiKey: options.apiKey,
    ...(options.baseUrl ? { baseURL: options.baseUrl } : {}),
    maxRetries: 2,
    timeout: 60_000,
  });

  return {
    kind,
    async complete(req, signal) {
      const response = await client.chat.completions.create(
        {
          model: req.modelId,
          [maxTokensParam]: req.maxOutputTokens,
          messages: toMessages(req),
        } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
        signal ? { signal } : {},
      );
      return {
        text: response.choices[0]?.message.content ?? "",
        usage: toUsage(response.usage),
      } satisfies AiResult;
    },

    async *stream(req, signal) {
      const stream = await client.chat.completions.create(
        {
          model: req.modelId,
          [maxTokensParam]: req.maxOutputTokens,
          messages: toMessages(req),
          stream: true,
          // Without this the final chunk carries no usage at all on OpenAI, and
          // every streamed call would meter as free. A gateway that reports
          // usage unasked and rejects unknown fields opts out in its preset.
          ...(streamUsageOption ? { stream_options: { include_usage: true } } : {}),
        } as OpenAI.Chat.ChatCompletionCreateParamsStreaming,
        signal ? { signal } : {},
      );

      let usage: AiUsageCounts = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
      try {
        for await (const chunk of stream) {
          if (chunk.usage) usage = toUsage(chunk.usage);
          const text = chunk.choices[0]?.delta.content;
          if (text) yield { text } satisfies AiChunk;
        }
      } finally {
        yield { usage } satisfies AiChunk;
      }
    },

    countInputTokens(req) {
      // OpenAI has no first-party count endpoint, so this is an estimate — and
      // it deliberately OVER-estimates (ADR-100 #1: a budget check that
      // under-estimates is not a budget). Four characters per token is the
      // widely-quoted English ratio; the 1.15 margin covers punctuation-dense
      // markup and the per-message overhead the ratio ignores.
      const characters =
        req.system.length +
        req.messages.reduce((total, message) => total + message.content.length, 0);
      const images = (req.images ?? []).reduce(
        // A base64 payload is ~4/3 of the bytes; images price near 1 token per
        // ~750 bytes on the current vision models. Rounded up, again on purpose.
        (total, image) => total + Math.ceil((image.base64.length * 0.75) / 750),
        0,
      );
      return Promise.resolve(Math.ceil((characters / 4) * 1.15) + images);
    },

    async test() {
      // Listing models proves the key and the host without spending anything,
      // which is the cheapest honest test this provider offers — except on a
      // gateway whose list is public, where the preset names a path that is not.
      if (options.keyCheckPath) {
        await client.get(options.keyCheckPath);
        return;
      }
      await client.models.list();
    },

    async listModels() {
      const models: AiDiscoveredModel[] = [];
      for await (const model of client.models.list()) {
        models.push(toDiscoveredModel(model as unknown as ExtendedModel));
      }
      // Alphabetical: `created` is absent or zero on half the gateways, so a
      // date order would be an order on some providers and noise on the rest.
      return models.sort((a, b) => a.modelId.localeCompare(b.modelId));
    },
  };
}
