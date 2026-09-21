// The no-provider driver (ADR-087 #11's MANUAL, one domain over).
//
// It is why a fresh clone is a working site rather than five broken buttons: the
// seed makes ECHO the default provider, so every admin screen renders, the usage
// dashboard has a shape, and the whole path from toolbar to usage row is
// exercised before anyone has a key. It returns a LABELLED placeholder — never
// something that could be mistaken for a real suggestion — and records a
// zero-cost row like any other call.
//
// It is also the fallback when `AI_SECRET_KEY` is absent, which is the
// difference between a platform that degrades and one that throws.
import type { AiProviderKind } from "@repo/db";

import type { AiChunk, AiDriver, AiRequest, AiResult } from "../provider.ts";

/** Roughly four characters per token. Good enough for a driver that bills $0. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function placeholder(req: AiRequest): string {
  // Deterministic, and honest about what it is. A driver that echoed the input
  // back would look like a bad model; one that says nothing looks like a
  // failure. This says exactly what happened.
  return [
    "[Echo provider — no AI provider is configured, so this is placeholder text.]",
    "",
    `Requested model: ${req.modelId}. Output ceiling: ${req.maxOutputTokens} tokens.`,
    "Configure a provider under Providers, paste a key, and press Test connection.",
  ].join("\n");
}

export function echoDriver(): AiDriver {
  const kind: AiProviderKind = "ECHO";

  function usageFor(req: AiRequest, text: string) {
    const input = estimateTokens(req.system + req.messages.map((m) => m.content).join(""));
    return { inputTokens: input, outputTokens: estimateTokens(text), cachedInputTokens: 0 };
  }

  return {
    kind,
    async complete(req) {
      const text = placeholder(req);
      return { text, usage: usageFor(req, text) } satisfies AiResult;
    },
    async *stream(req) {
      const text = placeholder(req);
      // Chunked so that a consumer's stream handling is exercised rather than
      // receiving one block that hides an ordering bug.
      for (const line of text.split("\n")) {
        yield { text: `${line}\n` } satisfies AiChunk;
      }
      yield { usage: usageFor(req, text) } satisfies AiChunk;
    },
    countInputTokens(req) {
      return Promise.resolve(
        estimateTokens(req.system + req.messages.map((m) => m.content).join("")),
      );
    },
    test() {
      // Nothing to reach, so nothing can fail. The screen still says which
      // driver answered, so "it works" never reads as "the key works".
      return Promise.resolve();
    },
    listModels() {
      // The seeded placeholder row, and nothing else.
      return Promise.resolve([
        {
          modelId: "echo",
          label: "Echo (placeholder output)",
          maxOutputTokens: 4096,
          supportsVision: true,
          inputPricePerMTok: 0,
          outputPricePerMTok: 0,
        },
      ]);
    },
  };
}
