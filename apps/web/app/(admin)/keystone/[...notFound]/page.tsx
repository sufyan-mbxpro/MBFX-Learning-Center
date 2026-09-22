import { notFound } from "next/navigation";

// Every /keystone address no other route owns.
//
// Without it, Next matched nothing and answered with `global-not-found.tsx` —
// the PUBLIC 404, which bypasses every layout. A staff member who mistyped a
// portal address was thrown out of the portal onto a "coming soon" page
// offering Courses, Trading tools, News and Support, with no way back to the
// dashboard. Matching here instead puts the address inside `(admin)`, so the
// layout's STAFF re-check still runs and `../../not-found.tsx` draws the page
// inside the admin shell.
//
// This folder holds NO `loading.tsx`, and that is the second half of the fix.
// The response body commits its status the moment a Suspense fallback renders
// (Next's own note on loading.js status codes), so a `loading.tsx` at or above
// the segment that throws makes the answer 200 with 404 markup — measured,
// both ways, before `keystone/loading.tsx` was moved down into the six
// sections that had no pending state of their own. Nothing suspends above
// this page now, so `notFound()` answers a real 404.
// `../../not-found.tsx` may still await freely: it renders at the `(admin)`
// segment, which has no loading.tsx either.
export default function AdminCatchAllNotFound(): never {
  notFound();
}
