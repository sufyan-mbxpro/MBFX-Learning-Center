// Vitest-only stand-in for next/cache (see vitest.config.ts). ADR-004:
// cacheTag/cacheLife/revalidateTag throw outside a real Next.js request
// context, and none of core's tests exercise cache semantics themselves —
// they test the data paths those tags flush.
export function cacheTag(..._tags: string[]): void {}
export function cacheLife(_profile: unknown): void {}
export function updateTag(_tag: string): void {}

// Module 16 (ADR-025/029 isolation tests) needs to assert WHICH tags a
// mutation touched — "publishing page A does not flush page B's cache" is
// meaningless against a pure no-op. Recording is opt-in for callers that
// import this file directly (not through the "next/cache" alias, so
// existing no-op-only tests are unaffected).
export const revalidateTagCalls: { tag: string; opts: unknown }[] = [];

export function revalidateTag(tag: string, opts?: unknown): void {
  revalidateTagCalls.push({ tag, opts });
}

export function resetRevalidateTagCalls(): void {
  revalidateTagCalls.length = 0;
}
