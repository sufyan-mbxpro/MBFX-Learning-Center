// Vitest-only stand-in for next/cache (see vitest.config.ts). ADR-004:
// cacheTag/cacheLife/revalidateTag throw outside a real Next.js request
// context, and none of core's tests exercise cache semantics themselves —
// they test the data paths those tags flush.
export function cacheTag(..._tags: string[]): void {}
export function cacheLife(_profile: unknown): void {}
export function revalidateTag(_tag: string, _opts?: unknown): void {}
export function updateTag(_tag: string): void {}
