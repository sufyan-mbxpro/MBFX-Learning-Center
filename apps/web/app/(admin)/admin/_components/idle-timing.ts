// ADR-128 — the arithmetic of the admin's idle watcher, kept out of the
// component so it is tested without timers or a DOM.

/** What `/admin/api/session` answers: time left, and the setting it came from. */
export interface SessionStatus {
  /** Milliseconds until the session expires, measured on the SERVER's clock. */
  remainingMs: number;
  /** The configured timeout, or `null` when the setting is "never". */
  timeoutMs: number | null;
}

/**
 * How long the "still there?" dialog stands before the session ends: a minute,
 * or a quarter of the timeout when that is shorter. ADR-041's flat minute was
 * half of the two-minute setting, so the warning would open one minute after
 * the reader stopped touching the page.
 */
export function idleWarningMs(timeoutMs: number): number {
  return Math.min(60_000, Math.floor(timeoutMs / 4));
}

/**
 * How often activity may tell the server about itself. Fifteen seconds keeps
 * the stored expiry (which the server slides at most once per
 * `staffSlideThresholdMs`) comfortably ahead of the warning window while a
 * person is working, for every offered duration.
 */
export const ACTIVITY_PING_MS = 15_000;

/** A server answer as a local deadline. Relative, so client clock skew cannot move it. */
export function deadlineFrom(status: SessionStatus, now: number): number {
  return now + Math.max(0, status.remainingMs);
}

/**
 * When the warning should open for a deadline — never in the past, so a
 * deadline already inside the window opens it immediately.
 */
export function warningDelayMs(deadline: number, timeoutMs: number, now: number): number {
  return Math.max(0, deadline - idleWarningMs(timeoutMs) - now);
}

/**
 * Whether another tab (or any other authenticated request) has pushed the
 * session back out of the warning window since this tab last looked. One
 * second of slack, so a peek that lands exactly on the boundary does not
 * reopen and close the dialog in a loop.
 */
export function extendedPastWarning(status: SessionStatus, timeoutMs: number): boolean {
  return status.remainingMs > idleWarningMs(timeoutMs) + 1_000;
}
