// next/cache outside a Next.js process (ADR-004): `revalidateTag`, `cacheTag`
// and `cacheLife` throw without a request store. The live seed writes through
// the same @repo/core services the admin uses, and those revalidate tags as
// they go — which is a no-op here. The seed runs BEFORE the app serves (or the
// app picks the rows up on its next cache miss), so nothing is lost.
export function cacheTag() {}
export function cacheLife() {}
export function revalidateTag() {}
export function revalidatePath() {}
export function updateTag() {}
export function refresh() {}
export function unstable_noStore() {}
