// A stable string hash, and the one thing this repo uses it for: picking a
// value out of a list by a key, identically everywhere.
//
// Four surfaces had grown their own copy of the same FNV-1a loop —
// `learn/_content/learn-media.ts` (which generated art panel a course gets),
// `learn/_lib/quiz-labels.ts` and `learn/_lib/video-labels.ts` (which tone a
// free-text category gets), and the admin quiz table needed a fourth. Four
// copies of a hash whose ONLY requirement is that everyone computes the same
// number is a drift bug waiting to be written, so it lives here instead.
//
// The property that matters is not cryptographic strength — it is that the
// result is identical in the RSC render and the client hydration, across
// server restarts, and between the public site and the admin. FNV-1a is
// pure arithmetic over char codes with no locale, no `Math.random`, no
// insertion order and no engine-specific behaviour, so it is.

/** FNV-1a, 32-bit. Deterministic for a given string, forever. */
export function stableHash(key: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Pick one option for `key`, stably and totally: the same key always yields
 * the same option, and a key that has never been seen before still yields
 * one, so a category typed for the first time is coloured with no code
 * change.
 *
 * WHICH option a key lands on is arbitrary and meant to be — this makes
 * labels distinguishable, it does not encode a scale. Anywhere a value has
 * to MEAN something (a status, a score, a pass mark) this is the wrong tool.
 *
 * Callers pass their own vocabulary, because the admin's tones and the
 * public design system's are different sets. Two callers that pass lists of
 * the same length in the same order agree on every key, which is what keeps
 * a category the same colour on both surfaces.
 */
export function pickByHash<T>(key: string, options: readonly T[]): T {
  if (options.length === 0) throw new Error("pickByHash: options must not be empty");
  return options[stableHash(key) % options.length]!;
}
