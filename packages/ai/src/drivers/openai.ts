// The OpenAI driver (ADR-099).
//
// The same shape as the Anthropic one, and the differences are the point: the
// usage block has different names, there is no first-party token-count
// endpoint, and cached input arrives nested. A normalising library would hide
// exactly these differences, and ADR-100 needs them.
import type { AiProviderKind } from "@repo/db";
import OpenAI from "openai";

import type { AiChunk, AiDriver, AiRequest, AiResult, AiUsageCounts } from "../provider.ts";

interface OpenAiOptions {
  apiKey: string;
  baseUrl?: string | undefined;
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
  const kind: AiProviderKind = "OPENAI";
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
          max_completion_tokens: req.maxOutputTokens,
          messages: toMessages(req),
        },
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
          max_completion_tokens: req.maxOutputTokens,
          messages: toMessages(req),
          stream: true,
          // Without this the final chunk carries no usage at all, and every
          // streamed call would meter as free.
          stream_options: { include_usage: true },
        },
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
      // which is the cheapest honest test this provider offers.
      await client.models.list();
    },
  };
}
