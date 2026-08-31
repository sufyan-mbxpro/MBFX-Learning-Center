# Rules — Architecture

Binding for every module. Deviations require an ADR _before_ the code
(plan.md Part F #10). Enforced by review + `pnpm governance:check` + the lint
rules named below.

## Apps are thin

1. `apps/web` contains routing, rendering, and composition only. If a piece
   of logic would need rewriting for a React Native screen, it is in the
   wrong place — move it to a package.
2. Route handlers and server actions **never import `@repo/db` directly.**
   They parse input (via `@repo/contracts`), check auth/permissions, and call
   a `@repo/core` service. This single discipline is what makes `apps/mobile`
   and a future versioned API a configuration change rather than a rewrite.
3. No business logic in `proxy.ts`. It gates and routes; it never decides.

## One app, two surfaces (ADR-006)

4. `app/(public)` and `app/(admin)` each own a root layout (Next.js multiple
   root layouts). There is **no** top-level `app/layout.tsx` — do not add one.
5. **Import boundary:** nothing under `app/(public)` — or shared app-level
   code — may import from `app/(admin)` or from admin-only dependencies
   (Tiptap, TanStack Table, color pickers, chart-config UI). This is what
   keeps admin weight out of public bundles now that there is one dependency
   graph. Backstop: blocking Lighthouse budgets on public routes (Module 12/14).
6. The `(admin)` root layout is `force-dynamic`. Public routes use ISR + cache
   tags. Do not "fix" a caching problem by making public routes dynamic.
7. Admin URLs live under `/admin/*` only. The proxy matcher must never
   locale-prefix `/admin` or `/api`.

## Packages

8. Dependencies point one way: `apps → packages`, and within packages,
   `core → db/contracts/rbac/settings`, never a package importing from an app.
   `import-x/no-cycle` is lint-enforced.
9. Every package declares every dependency it imports (no phantom deps —
   `pnpm check:phantom-deps` enforces). Granular exports in `@repo/ui` so one
   component doesn't drag the whole tree.
10. No shared package may depend on Next.js APIs except where its job _is_
    Next.js integration (`theme` loader, `i18n` routing, `settings` cache
    readers — and those keep pure logic separable for future native reuse).

## Caching

11. Cache Components (`"use cache"` + `cacheTag`/`cacheLife`) per ADR-004
    (Module 02+). `unstable_cache` is the legacy path — do not introduce it.
12. Tag names are frozen API: `theme`, `settings:{group}`, `navigation`,
    `rbac:{userId}`. Admin writes invalidate by tag; nothing polls.
