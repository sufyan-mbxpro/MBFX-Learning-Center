# ADR-064: We own the theme-mode provider; the pre-paint script is server-rendered

**Status:** Accepted
**Date:** 2026-09-08
**Module:** 07 (`@repo/ui`), applying to every root layout in `apps/web`
**Supersedes:** —
**Superseded by:** —
**Extends:** ADR-008 (mode is the user's, branding is the admin's) — the
policy is unchanged; only the mechanism moves.

## Context

Next.js 16 / React 19.2 logs a console error on every affected page:

> Encountered a script tag while rendering React component. Scripts inside
> React components are never executed when rendering on the client.

The stack pointed at `packages/ui/src/components/theme-provider.tsx`, which did
nothing but mount `next-themes`' `ThemeProvider`. The script is next-themes'
own: its provider renders the pre-paint FOUC guard as an inline
`<script dangerouslySetInnerHTML>` **from inside a client component**.

Three things were established before choosing a fix:

1. **The warning is real, not a mis-attribution.** It lives in React's
   `createInstance` — the client-**mount** path — and on that path React
   substitutes a `<div>` for the script (`react-dom-client.development.js`).
   So on any render where the tree is mounted rather than hydrated
   (hydration-mismatch recovery, an error-boundary re-render, the dev overlay)
   the mode guard is silently replaced by an empty div.
2. **It is dev-only today.** The message exists solely in React's
   `*.development.js` bundles, and the guard's job is already done by the
   time that path can run — the provider's effects re-stamp `<html>`. Nothing
   is visibly broken in production.
3. **There is no upstream fix and no prop that disables it.** `0.4.6` is
   `latest`; `1.0.0-beta.0` was unpacked and still does
   `createElement("script", {nonce, dangerouslySetInnerHTML})` from the same
   client component. `scriptProps` is spread _before_ `dangerouslySetInnerHTML`,
   so a call site cannot override the body either.

The API surface we actually consumed was three fields — `theme`,
`resolvedTheme`, `setTheme` — read by exactly two components
(`mode-toggle.tsx`, `sonner.tsx`). We were carrying a dependency, and a defect
we could not configure away, for ~90 lines of behaviour.

The dependency was also the reason the mode guard could not take a CSP nonce.
Both admin layouts already read `x-nonce` from the proxy and pass it to
`<style id="brand-tokens">` (security.md #14); next-themes' script was the one
inline script on those surfaces that could not be nonced from a call site.

## Decision

1. **`next-themes` is removed** from `@repo/ui` and `apps/web`. Do not re-add
   it — `docs/memory/stack.md` records the row as REMOVED with this reason.
2. **`@repo/ui/components/theme-provider`** is our own client context:
   `{ theme, resolvedTheme, systemTheme, setTheme }`, `class` on `<html>`,
   `localStorage["theme"]`, `matchMedia` for `system`, and a `storage`
   listener so a second tab stays in sync. It exports `useTheme` too, so the
   import in a consumer changes but nothing else does.
3. **`@repo/ui/components/theme-script`** injects the pre-paint script through
   **`useServerInsertedHTML`**, and does not render it as JSX. This is the
   load-bearing half of the decision, and it is stronger than it first looks.

   Moving the script to a **server component** was tried first and is NOT
   sufficient: the element still lives in the RSC payload, and Next 16's client
   prerender/recovery passes create host instances from that payload, so the
   same warning came back pointing at the new file. Nor does `next/script`
   `strategy="beforeInteractive"` help — for an inline script it renders a
   `<script>` element of its own and defers execution to Next's runtime, which
   is after first paint.

   `useServerInsertedHTML`'s callback runs only where
   `ServerInsertedHTMLContext` is non-null, which is the server; on the client
   the hook is a documented no-op. The script therefore exists **only** as
   server-rendered HTML — verified absent from the RSC payload — and Next
   flushes it into `<head>`, ahead of `<body>`, which is earlier than
   next-themes managed. `ThemeScript` is a `"use client"` file _because_ the
   hook needs a client context to attach to, and it returns `null` in the
   browser.

   **Neither `theme-provider.tsx` nor `theme-script.tsx` may put a `<script>`
   in the React tree** — that is the rule this ADR exists to state, and
   `packages/ui/src/components/theme-provider.test.tsx` fails if either does.

4. **The script's body is self-contained by contract.** It is stringified with
   `Function.prototype.toString()`, so every value it needs arrives as a
   literal argument. A reference to a module-scope binding would survive
   minification as a name that does not exist in the browser, and the mode
   would apply only after hydration — the exact flash the script prevents.
   `packages/ui/src/lib/theme-mode.ts` carries that comment and the test
   asserts the arguments are inlined.
5. **`<ThemeScript />` is mounted in every root layout** —
   `(public)/[locale]`, `(admin)`, `(admin-auth)` — above `#brand-tokens` and
   above the provider. Where it sits in the JSX is cosmetic: it renders
   nothing, and Next decides where the injected HTML lands (`<head>`).
6. **It carries the nonce on the dynamic surfaces.** Both admin layouts pass
   the `x-nonce` they already read. The public layout passes none: it is
   cached (ADR-004) and has no request to read a nonce from. That is unchanged
   from next-themes, and it is Module 14's problem to solve for public — this
   ADR does not close it, it only stops the admin surfaces from having it.
7. **Provider state never reads storage during render.** `theme` initialises
   to `"system"` on the server and the client alike and is corrected in an
   effect, so hydration cannot diverge. Nothing flashes, because `<html>` is
   already correct — the state is catching up to the DOM, not the reverse.
8. `useTheme()` outside a provider returns a stub rather than throwing, so a
   component that reads the mode for a cosmetic detail stays renderable in
   isolation. Same behaviour next-themes had.

## Consequences

- The console error is gone, and the mode guard can no longer be quietly
  replaced by a `<div>` on a client-mount render.
- One fewer runtime dependency, and one fewer un-nonceable inline script on
  `/admin/*`.
- We now own ~90 lines that a third party used to maintain. The surface is
  small and fully tested, but a future requirement (`data-theme` attribute,
  per-user server-side mode from `User.themeMode`) is now ours to build. The
  `User.themeMode` half was always going to be ours — plan.md §71 assumed it.
- `apps/web/app/(public)/[locale]/_components/theme-provider.tsx` was a dead
  duplicate of the `@repo/ui` component with no importers. Deleted.

## Alternatives rejected

- **Live with the warning.** Defensible — it is dev-only. Rejected because the
  fallback behaviour it describes (script → `<div>`) is a real correctness
  hole in the FOUC guard, and there is no upstream fix to wait for.
- **A server component rendering the `<script>`.** Tried, shipped into the
  working tree, and reverted the same day — see decision 3. It fixes nothing,
  because the element survives in the RSC payload.
- **`next/script` with `strategy="beforeInteractive"`.** Read the Next 16
  implementation: for an inline script it emits its own `<script>` element
  (same warning) whose body only pushes onto `self.__next_s` for Next's
  runtime to execute later — after first paint, so it cannot prevent a flash.
- **Stamping the class server-side from a cookie.** Would remove the script
  outright, and works for the two admin layouts. Rejected because the public
  layout is prerendered (`○`/`◐`, 5m revalidate — see the build's route
  table); reading `cookies()` there would make every public route dynamic.
- **Pin `next-themes@1.0.0-beta.0`.** Does not fix it (verified), and
  `minimumReleaseAge` plus the stack.md discipline rule out a beta anyway.
- **Patch `next-themes` via a pnpm patch.** Moves the same code into our
  maintenance burden with none of the benefits — still no nonce, still a
  dependency, and a patch to re-apply on every bump.
