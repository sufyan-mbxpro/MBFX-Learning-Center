// Fixtures for other packages' tests, and the memory driver.
//
// Deliberately NOT exported from ".": a test helper on the public surface is a
// second way into the provider seam, and `index.test.ts` asserts it is not
// there. It is reachable as `@repo/ai/testing`, which is a different import and
// an obvious one in a diff.
import type { AiDiscoveredModel } from "@repo/contracts";
import type { AiProviderKind } from "@repo/db";

import type { AiChunk, AiDriver, AiRequest, AiResult, AiUsageCounts } from "./provider.ts";

export interface MemoryDriverOptions {
  kind?: AiProviderKind;
  /** What `complete` and `stream` return. A function sees the request. */
  reply?: string | ((req: AiRequest) => string);
  usage?: Partial<AiUsageCounts>;
  /** Thrown by `complete`/`stream`, so the error taxonomy can be exercised. */
  fail?: Error;
  /** Thrown by `test()` only — a key that reads but does not work. */
  testFail?: Error;
  /** What `listModels()` returns. */
  models?: AiDiscoveredModel[];
}

export interface MemoryDriver extends AiDriver {
  /** Every request the driver was handed, in order. */
  readonly calls: AiRequest[];
}

/**
 * A driver that never touches a network.
 *
 * It exists so a test can assert what the SEAM does — the clamp, the refusal
 * order, the metering in `finally` — without MSW standing in for an HTTP
 * conversation nobody is testing. Driver tests themselves use MSW with
 * `onUnhandledRequest: "error"`, because there the HTTP shape IS the subject.
 */
export function memoryDriver(options: MemoryDriverOptions = {}): MemoryDriver {
  const calls: AiRequest[] = [];
  const usage: AiUsageCounts = {
    inputTokens: options.usage?.inputTokens ?? 100,
    outputTokens: options.usage?.outputTokens ?? 50,
    cachedInputTokens: options.usage?.cachedInputTokens ?? 0,
  };

  function textFor(req: AiRequest): string {
    const reply = options.reply ?? "ok";
    return typeof reply === "function" ? reply(req) : reply;
  }

  return {
    kind: options.kind ?? "ECHO",
    calls,
    complete(req) {
      calls.push(req);
      if (options.fail) return Promise.reject(options.fail);
      return Promise.resolve({ text: textFor(req), usage } satisfies AiResult);
    },
    async *stream(req) {
      calls.push(req);
      if (options.fail) throw options.fail;
      for (const word of textFor(req).split(" ")) {
        yield { text: `${word} ` } satisfies AiChunk;
      }
      yield { usage } satisfies AiChunk;
    },
    countInputTokens(req) {
      calls.push(req);
      return Promise.resolve(usage.inputTokens);
    },
    test() {
      return options.testFail ? Promise.reject(options.testFail) : Promise.resolve();
    },
    listModels() {
      return Promise.resolve(options.models ?? []);
    },
  };
}

/** A price row that makes the arithmetic in a test readable at a glance. */
export const TEST_PRICES = {
  inputPricePerMTok: 1,
  outputPricePerMTok: 10,
  cachedInputPricePerMTok: 0.1,
} as const;
