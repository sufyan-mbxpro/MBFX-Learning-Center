# ADR-145 — The runtime is Node 22 LTS, not Node 24

- **Status:** Accepted
- **Date:** 2026-09-21
- **Module:** 00 (scaffold & governance), 14 (hardening)
- **Plan:** owner request, 2026-09-21
- **Amends:** the Node.js and `@types/node` rows of `docs/memory/stack.md`
  (the Day-1 sweep, plan.md Part F #9). No earlier ADR recorded the Node
  line, so none is superseded.
- **Does not change:** pnpm, TypeScript (ADR-010), Next.js, Prisma or any
  other pin.

## Context

The Day-1 sweep (2026-08-31) moved the runtime from the plan's Node 22 to
Node 24. The reason was that 22 had entered Maintenance LTS in October 2025.
The owner has asked for the runtime to be Node 22 LTS.

> **Owner's reason:** _to be filled in by the owner (for example, a hosting
> platform that does not offer 24 yet)._

Before deciding, the repo was reviewed for anything that needs Node 23 or 24.
Nothing does:

- **Dependencies.** No package in `pnpm-lock.yaml` excludes 22. The
  strictest ranges are `@inquirer/*` (`^22.13.0`), Prisma 7 (`^22.12`) and
  Vite (`>=22.12`). The native modules (`@node-rs/argon2`, the Prisma
  engines, esbuild, sharp) use Node-API prebuilds, which are not tied to one
  Node version.
- **Language.** None of the post-22 globals appears in source:
  `URLPattern`, `Float16Array`, `RegExp.escape`, `Error.isError`,
  `Promise.try`, `using`, `Uint8Array.fromBase64`, `Iterator.concat`.
  `tsconfig` targets ES2022, so the compiler would refuse them anyway.
- **Node APIs.** The newest ones in use are all in 22.13:
  - `import.meta.dirname` (20.11)
  - `process.loadEnvFile` (20.12)
  - `--experimental-strip-types` (22.6, flag-free from 22.18; the explicit
    flag stays valid)
  - `tsx --import`

## Decision

1. **The floor is Node 22.13.0.** `engines.node` is `>=22.13.0`,
   `.nvmrc` is `22` and CI runs `node-version: 22`. 22.13 is the lowest
   version every dependency accepts.
2. **The engines range stays open above.** It is not `^22`. A machine still
   on 24 keeps working while the fleet moves, and a later return to 24 is a
   pin change rather than a range change.
3. **`@types/node` follows the runtime: `^22.20.4`**, in all eleven
   packages that declare it. The types must not describe APIs the runtime
   lacks. That is the same reasoning as the old row's "do NOT take the 26.x
   types line", one major lower.
4. **Production runs the latest 22.x.** At the time of writing that is
   22.23.2 (codename "Jod").

## Consequences

- **Support ends a year earlier.** Node 22 reaches end of life in April 2027,
  Node 24 in April 2028. Node 22 is in Maintenance LTS, so it gets security
  fixes only. The runtime must move to 24 (or later) before April 2027. That
  move is a pin change: this ADR introduced no code that needs 22.
- **No code changed.** The migration is confined to pins, the lockfile and
  the docs that state the runtime.
- **Verified on Node 22.23.2** with the 22.20.4 types: the workspace
  typecheck is clean in all 18 projects. The test results are recorded in
  the DEVLOG entry for this ADR.
