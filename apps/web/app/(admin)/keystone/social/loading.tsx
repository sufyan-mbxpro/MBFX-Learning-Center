// The generic admin pending state. It lives per SECTION rather than over the
// whole portal so that `[...notFound]` sits outside every Suspense boundary
// and can answer a real 404 — see `_components/admin-loading.tsx`.
export { default } from "../_components/admin-loading.tsx";
