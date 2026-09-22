"use client";

// The one client-side door to `POST /keystone/api/ai/run`.
//
// Every AI affordance in the admin goes through here, for the same reason
// every server-side one goes through `runAiTask`: one place to get the request
// shape, the abort path and the error taxonomy right. A feature that rolled its
// own `fetch` would have to remember all three.
//
// **Nothing here decides whether AI is available.** Availability is resolved on
// the server and arrives as a prop; a component that has no AI prop renders no
// AI control and never imports this file's callers (ADR-097 #6).
import { AI_STREAM_ERROR_PREFIX, type AiFeatureKey } from "@repo/contracts";

const ENDPOINT = "/keystone/api/ai/run";

export interface AiRequestInput<K extends AiFeatureKey = AiFeatureKey> {
  feature: K;
  payload: unknown;
  entity?: { type: string; id: string } | undefined;
  signal?: AbortSignal | undefined;
}

/**
 * A failure the UI can render.
 *
 * `reason` is the server's taxonomy value; the caller maps it to one catalog
 * string. There is deliberately no `message` — a provider message can quote the
 * prompt back, and the server never sends one.
 */
export class AiClientError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "AiClientError";
    this.reason = reason;
  }
}

async function reasonFrom(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : "provider_error";
  } catch {
    return "provider_error";
  }
}

/** One non-streaming generation. Resolves to the model's text. */
export async function runAi(input: AiRequestInput): Promise<string> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      feature: input.feature,
      payload: input.payload,
      ...(input.entity ? { entity: input.entity } : {}),
    }),
    ...(input.signal ? { signal: input.signal } : {}),
  });

  if (!response.ok) throw new AiClientError(await reasonFrom(response));
  const body = (await response.json()) as { text?: unknown };
  return typeof body.text === "string" ? body.text : "";
}

/**
 * One generation, parsed as JSON by the caller's own schema.
 *
 * The model is asked for an object and the response is parsed with the SAME
 * schema the form uses (ADR-097 #13), so an over-length meta description fails
 * identically wherever it came from. A model that wraps its JSON in a code
 * fence is the one deviation worth absorbing rather than failing on — it is
 * common, harmless, and unambiguous.
 */
export async function runAiJson<T>(
  input: AiRequestInput,
  parse: (value: unknown) => T,
): Promise<T> {
  const text = await runAi(input);
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    // Prose where an object was asked for is a FAILED generation, not a form
    // full of garbage.
    throw new AiClientError("invalid_output");
  }

  try {
    return parse(parsed);
  } catch {
    throw new AiClientError("invalid_output");
  }
}

export interface AiStreamHandlers {
  onChunk: (text: string) => void;
  /** Called once, with a taxonomy reason, if the stream fails part-way. */
  onError?: (reason: string) => void;
}

/**
 * A streamed generation.
 *
 * A stream cannot change its status code once it has started, so a mid-stream
 * failure arrives in the BODY behind `AI_STREAM_ERROR_PREFIX` — a 0x1F control
 * character no model emits in prose. Splitting on it is what keeps a reason
 * from being rendered as if it were the suggestion.
 *
 * Aborting is the caller's job through `signal`; the server's own `finally`
 * still meters what was billed.
 */
export async function streamAi(input: AiRequestInput, handlers: AiStreamHandlers): Promise<void> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      feature: input.feature,
      payload: input.payload,
      stream: true,
      ...(input.entity ? { entity: input.entity } : {}),
    }),
    ...(input.signal ? { signal: input.signal } : {}),
  });

  // A refusal happens BEFORE the stream starts, so it still arrives as a
  // status code and a JSON body.
  if (!response.ok) throw new AiClientError(await reasonFrom(response));
  if (!response.body) throw new AiClientError("provider_error");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    const marker = text.indexOf(AI_STREAM_ERROR_PREFIX);
    if (marker === -1) {
      handlers.onChunk(text);
      continue;
    }
    // Emit whatever preceded the marker — it was generated and billed — then
    // report the reason and stop.
    if (marker > 0) handlers.onChunk(text.slice(0, marker));
    handlers.onError?.(text.slice(marker + AI_STREAM_ERROR_PREFIX.length).trim());
    return;
  }
}
