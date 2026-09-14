// The provider seam (ADR-099) and **the ONE reader of `apiKeyCipher`**
// (ADR-098 (b)).
//
// Three abstractions were on the table and this repo has already chosen twice:
// ADR-078's `EmailTransportDriver { send; verify }` and ADR-087's market driver
// are the same problem with a different noun. A third abstraction over a fourth
// is how a codebase acquires two ways to swap a provider — so the seam is ours,
// thin, and the official SDKs sit behind it.
//
// The seam is also where OUR policy lives, and our policy is not a library's:
// budget refusal before the call, the three-way clamp, the usage row, the abort
// path. None of that belongs to a vendor package and all of it has to be
// unskippable, which is why `runAiTask` is the only thing that calls in here.
import { db, type AiProviderKind } from "@repo/db";

import { anthropicDriver } from "./drivers/anthropic.ts";
import { echoDriver } from "./drivers/echo.ts";
import { openAiDriver } from "./drivers/openai.ts";
import { AiError } from "./errors.ts";
import { AiSecretInvalidError, AiSecretKeyMissingError, openAiSecret } from "./secret.ts";

// ─── The request and the result ──────────────────────────────

export interface AiImage {
  mimeType: string;
  /** Base64. `@repo/core` reads the bytes; this package never touches storage. */
  base64: string;
}

/**
 * One HTTP conversation's worth of input.
 *
 * Note what is NOT here: no entity, no user, no permission, no feature key. The
 * driver's job is to talk to a provider — everything about WHO asked and WHY is
 * the seam's business, and keeping it out of this type is what stops a driver
 * from growing a policy decision.
 */
export interface AiRequest {
  modelId: string;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxOutputTokens: number;
  effort: "low" | "medium" | "high";
  images?: readonly AiImage[];
}

export interface AiUsageCounts {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

export interface AiResult {
  text: string;
  usage: AiUsageCounts;
}

/** A streamed piece. The LAST chunk carries `usage` and nothing else need. */
export interface AiChunk {
  text?: string;
  usage?: AiUsageCounts;
}

export interface AiDriver {
  readonly kind: AiProviderKind;
  complete(req: AiRequest, signal?: AbortSignal): Promise<AiResult>;
  stream(req: AiRequest, signal?: AbortSignal): AsyncIterable<AiChunk>;
  countInputTokens(req: AiRequest): Promise<number>;
  /** The "test connection" button. Throws on failure; the caller maps it. */
  test(): Promise<void>;
}

// ─── The provider row, and its one key reader ────────────────

export interface AiProviderRecord {
  id: string;
  kind: AiProviderKind;
  label: string;
  baseUrl: string | null;
  isEnabled: boolean;
  isDefault: boolean;
}

/**
 * A base URL with trailing slashes removed, or `undefined`.
 *
 * Normalised at the point of USE, not on save — the market provider's
 * trailing-slash bug (DEVLOG 2026-09-14) is the whole reason: a URL copied out
 * of a browser address bar ends in "/", every SDK appends its own path, and the
 * resulting "//v1/messages" fails in a way that reads exactly like a rejected
 * API key. A row already holding the slash starts working without being
 * re-entered.
 */
export function normalizeBaseUrl(baseUrl: string | null | undefined): string | undefined {
  const trimmed = baseUrl?.replace(/[/]+$/, "");
  return trimmed ? trimmed : undefined;
}

/**
 * **The ONLY place `apiKeyCipher` is selected** (ADR-098 (b)).
 *
 * Unlike `loadProviderDriver()` in the market layer this one THROWS, because
 * every caller is an admin-triggered action with a screen to report on. The
 * market equivalent returns `null` because its callers are public page renders
 * where a configuration error must not become a 500; nothing here renders to a
 * visitor.
 *
 * `provider.test.ts` fails any other file in this package that names the
 * column, the way `media.test.ts` guards the paged return type.
 */
export async function loadProviderDriver(providerId: string): Promise<AiDriver> {
  const row = await db.aiProvider.findUnique({
    where: { id: providerId },
    select: { id: true, kind: true, baseUrl: true, isEnabled: true, apiKeyCipher: true },
  });

  if (!row || !row.isEnabled)
    throw new AiError("no_provider", `Provider ${providerId} is not enabled`);

  const baseUrl = normalizeBaseUrl(row.baseUrl);

  // ECHO needs no key and no network. It is what makes the platform
  // demonstrable, seedable and testable on a machine that has neither
  // (ADR-087 #11's MANUAL, one domain over).
  if (row.kind === "ECHO") return echoDriver();

  if (!row.apiKeyCipher) throw new AiError("missing_key", `Provider ${providerId} has no API key`);

  let apiKey: string;
  try {
    apiKey = openAiSecret(row.apiKeyCipher);
  } catch (error) {
    // An unreadable seal surfaces as a CONFIGURATION error on the screen that
    // can fix it, never as a silent provider failure (ADR-098's consequence).
    if (error instanceof AiSecretKeyMissingError || error instanceof AiSecretInvalidError) {
      throw new AiError("secret_unreadable", error.message);
    }
    throw error;
  }

  return row.kind === "ANTHROPIC"
    ? anthropicDriver({ apiKey, baseUrl })
    : openAiDriver({ apiKey, baseUrl });
}

/** Seal a provider key for storage. The one writer's one helper. */
export { sealAiSecret as sealProviderKey } from "./secret.ts";

/**
 * A driver built from an unsaved key — the "test connection" path.
 *
 * It exists so that an admin can prove a credential before committing it, and
 * it is the only way to reach a driver without a stored row. It still cannot
 * leak: the key arrives from the form, is used once, and is never returned.
 */
export function driverForKey(input: {
  kind: AiProviderKind;
  apiKey: string;
  baseUrl?: string | null;
}): AiDriver {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  if (input.kind === "ECHO") return echoDriver();
  if (input.kind === "ANTHROPIC") return anthropicDriver({ apiKey: input.apiKey, baseUrl });
  return openAiDriver({ apiKey: input.apiKey, baseUrl });
}
