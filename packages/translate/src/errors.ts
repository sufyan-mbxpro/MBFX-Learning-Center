// The one error type this package throws, carrying a reason from
// `TRANSLATE_REASONS` (@repo/contracts). The message is for logs; screens and
// usage rows only ever see the reason, because Google's own message can quote
// the request back.
import {
  PAUSING_TRANSLATE_REASONS,
  TRANSIENT_TRANSLATE_REASONS,
  type TranslateReason,
} from "@repo/contracts";

export class TranslateError extends Error {
  readonly reason: TranslateReason;

  constructor(reason: TranslateReason, message: string) {
    super(message);
    this.name = "TranslateError";
    this.reason = reason;
  }
}

/** Worth trying again without anyone changing anything. */
export function isTransient(error: unknown): boolean {
  return error instanceof TranslateError && TRANSIENT_TRANSLATE_REASONS.includes(error.reason);
}

/** Work should wait, not fail: a quota or our own budget (ADR-162 #6). */
export function isPausing(error: unknown): boolean {
  return error instanceof TranslateError && PAUSING_TRANSLATE_REASONS.includes(error.reason);
}

/** The reason of any error, `network_error` for one that is not ours. */
export function reasonOf(error: unknown): TranslateReason {
  return error instanceof TranslateError ? error.reason : "network_error";
}
