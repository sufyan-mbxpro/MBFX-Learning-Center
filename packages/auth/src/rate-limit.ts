import Redis from "ioredis";

// A fixed-window request counter for public write endpoints
// (changes-11 PR 5.2/5.5, security.md #13).
//
// **Why this lives in @repo/auth.** Better Auth already rate-limits its own
// endpoints from this package, and the account lockout policy is here too, so
// this is where "how much may an unknown caller do" is decided. Putting it in
// @repo/core would mean giving the domain package an ioredis dependency to
// answer a transport question.
//
// **Why it is not the Better Auth secondary storage's `increment`.** That
// client is configured for session reads: it queues commands while Redis is
// briefly unreachable, which is right for a session lookup and wrong here —
// a rate limiter that blocks on a dead Redis converts an infrastructure blip
// into a hung request. This client fails fast instead, and `rateLimit()`
// decides what a failure means.
//
// **Fixed window, not a sliding one.** A learner can send up to 2× the limit
// across a window boundary. For "how many lesson votes may one browser cast a
// minute" that is irrelevant, and a sliding window costs a sorted set per
// caller. If a limit ever guards something where the boundary burst matters,
// replace the implementation here rather than adding a second limiter.

let client: Redis | undefined;

/** Lazy, like `@repo/db`'s client: REDIS_URL may not be set at import time. */
function redis(): Redis {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  client = new Redis(url, {
    maxRetriesPerRequest: 2,
    // Without this, a command issued while Redis is down waits forever rather
    // than rejecting — the caller's `await` never settles.
    enableOfflineQueue: false,
  });
  return client;
}

/**
 * Process-local fallback, used only when Redis is unavailable.
 *
 * It is deliberately weaker than the Redis path — it is per-process, so it
 * does not bound a fleet — and it exists so that `pnpm dev` and the test suite
 * enforce the SAME limits without a running Redis. A limiter that silently
 * disappears in development is a limiter nobody notices is broken.
 */
const local = new Map<string, { count: number; resetAt: number }>();

function localHit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const entry = local.get(key);
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowSeconds * 1000;
    local.set(key, { count: 1, resetAt });
    // Unbounded growth is the obvious failure mode of a Map keyed by caller.
    // Sweeping on write costs nothing at this scale and needs no timer.
    if (local.size > 5_000) {
      for (const [k, v] of local) if (v.resetAt <= now) local.delete(k);
    }
    return { ok: limit >= 1, remaining: Math.max(0, limit - 1), retryAfterSeconds: windowSeconds };
  }
  entry.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return {
    ok: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSeconds,
  };
}

export interface RateLimitResult {
  /** False means the caller is over the limit and the request must be refused. */
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets — becomes the `Retry-After` header. */
  retryAfterSeconds: number;
}

/**
 * Count one request against `key` and say whether it is allowed.
 *
 * `key` must already be scoped by the caller — `"learn:feedback:<ip>"`, not
 * `"<ip>"` — so two endpoints never share a budget.
 *
 * **Fails open on an infrastructure error.** If Redis is unreachable AND the
 * local fallback is somehow unusable, the request is allowed. That is the
 * right trade for the endpoints this guards: refusing every lesson vote
 * because a cache is down is a worse outcome than accepting a burst. It would
 * be the wrong trade for sign-in, which is why sign-in is rate-limited by
 * Better Auth against its own storage rather than by this function.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const namespaced = `ratelimit:${key}`;
  try {
    const count = await redis().incr(namespaced);
    if (count === 1) await redis().expire(namespaced, windowSeconds);
    const ttl = count === 1 ? windowSeconds : await redis().ttl(namespaced);
    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      // A key with no TTL (the `expire` lost a race) would report -1; treat
      // that as a full window rather than telling the caller to retry in -1s.
      retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  } catch {
    try {
      return localHit(namespaced, limit, windowSeconds);
    } catch {
      return { ok: true, remaining: limit, retryAfterSeconds: 0 };
    }
  }
}
