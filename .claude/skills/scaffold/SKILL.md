# SKILL — Module 00: Repo scaffold & governance

## Scope

Turborepo + pnpm 11 workspace; ONE Next.js 16 app (`apps/web`) with
`(public)`/`(admin)` route groups (ADR-006); ten package skeletons; tooling
configs; governance tree; `governance:check`; CI. Nothing renders UI beyond a
placeholder per surface.

## Standards

- Official generators over hand-rolled files: `create-next-app@latest` for the
  app; `shadcn` waits for Module 07; Prisma waits for Module 01.
- Official Next.js conventions only (route groups, multiple root layouts,
  `proxy.ts`, `_private` folders). No custom framework inside Next.js.
- Exact version pins per `docs/memory/stack.md`; TypeScript 6.0.3 (ADR-010);
  Prisma line locked by ADR-002.
- pnpm 11: `onlyBuiltDependencies` and workspace settings live in
  `pnpm-workspace.yaml`, not package.json.
- Every workspace package: `lint`, `typecheck`, `test` scripts; deps declared
  explicitly (phantom-dep check enforces).

## Required tests

- CI green on the empty workspace (lint, typecheck, test, build).
- `governance:check` negative test: package change without DEVLOG fails.
- Workspace fixture test: every import in `packages/*` is a declared dep.

## DoD

`pnpm dev` boots :3000 with `/` and `/admin`; governance tree complete;
DEVLOG entry with test results.
