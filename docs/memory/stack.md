# Stack — pinned versions

Locked process (plan.md Part F #9): exact versions pinned here on kickoff
Day 1 after a registry sweep, updated **deliberately** (Renovate PR or an
explicit decision), never ad hoc. The plan names version lines; this file
names numbers. If a bump changes behavior, it gets an ADR.

**Day-1 sweep:** 2026-08-31, against the live npm registry / nodejs.org.

## Runtime & workspace

| Tool       | Pin                                                         | Why this line                                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js    | **24.x LTS** ("Krypton", engines `>=24.0.0`, `.nvmrc` = 24) | Active LTS (EOL Apr 2028). Node 22 entered Maintenance LTS Oct 2025 — plan.md named 22; superseded by the sweep.                                                                                                          |
| pnpm       | **11.24.0** (`packageManager`)                              | Current stable. Plan named 10.x; 11 is a mechanical migration (config moves to `pnpm-workspace.yaml`, `onlyBuiltDependencies` intact, needs Node 22+). Supply-chain defaults (`minimumReleaseAge: 1440`) kept on.         |
| Turborepo  | **^2.10.12**                                                | Current 2.x.                                                                                                                                                                                                              |
| TypeScript | **6.0.3 — exact pin, no caret**                             | Last classic-API line. `latest` is 7.0.2 (native Go compiler) with **no stable programmatic API until ~7.1** → breaks typescript-eslint. See **ADR-010**. Revisit trigger: TS 7.1 GA + typescript-eslint support release. |
| Prettier   | ^3.9.6                                                      | —                                                                                                                                                                                                                         |

## App framework

| Package           | Pin                               | Notes                                                                                                                                                                                                                                                                               |
| ----------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js           | **16.3.3**                        | Active LTS line; 15.x EOL Oct 2026. Turbopack default; `proxy.ts` convention; Cache Components (ADR-004).                                                                                                                                                                           |
| React / ReactDOM  | 19.2.8                            | As pinned by `create-next-app@latest`.                                                                                                                                                                                                                                              |
| Tailwind CSS      | ^4.3.3 (+ `@tailwindcss/postcss`) | v4 — config lives in CSS.                                                                                                                                                                                                                                                           |
| ESLint            | **^9.39.5** (flat config)         | Matches the official `create-next-app` pin. ESLint 10 exists, but `eslint-config-next`'s transitive plugins (import/jsx-a11y/react) declare peers only up to ^9 — follow-up below. `eslint-plugin-import-x` (not the unmaintained-peer `eslint-plugin-import`) provides `no-cycle`. |
| typescript-eslint | ^8.68.0                           | Supports TS 6.x; the reason for the TS pin. (8.69.0 was <24h old at install — held back by `minimumReleaseAge`.)                                                                                                                                                                    |
| @types/node       | ^24.13.3                          | Matches the Node 24 runtime — do NOT take the 26.x types line.                                                                                                                                                                                                                      |

## Data & auth (installed in their modules, pinned now)

| Package                 | Pin                    | Module | Notes                                                                                                              |
| ----------------------- | ---------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| prisma / @prisma/client | **7.10.x**             | 01     | Prisma 8 is still RC (`8.0.0-rc.12`); CLI `latest` tag points at the RC — never install unpinned. See **ADR-002**. |
| @prisma/adapter-mariadb | match 7.10.x           | 01     | Driver-adapter path.                                                                                               |
| better-auth             | latest stable at spike | 04     | ADR-001 after the 2-day spike; fallback Auth.js v5.                                                                |
| @node-rs/argon2         | ^2.2.0                 | 01/04  | Argon2id hasher; in `onlyBuiltDependencies`.                                                                       |
| zod                     | ^4.5.4                 | 05+    | v4 error APIs — no v3 snippets.                                                                                    |
| next-intl               | ^4.14.1                | 06     | Verify Next 16 peer range at module start.                                                                         |
| next-themes             | ^0.4.6                 | 08/12  | User-controlled mode (ADR-008).                                                                                    |

## Testing

| Package                      | Pin              | Notes                          |
| ---------------------------- | ---------------- | ------------------------------ |
| vitest / @vitest/coverage-v8 | ^4.1.11          | Workspace-wide.                |
| @playwright/test             | ^1.62.1          | E2E both surfaces.             |
| @axe-core/playwright         | ^4.13.0          | A11y gate.                     |
| @testing-library/react       | ^16.3.3          | —                              |
| msw                          | ^2.15.0          | Network edge only.             |
| fast-check                   | ^4.9.0           | Theme contract property tests. |
| testcontainers (MariaDB)     | pin at Module 01 | Real-DB integration.           |

## UI toolchain (Module 07)

| Package      | Pin                                | Notes                                                                         |
| ------------ | ---------------------------------- | ----------------------------------------------------------------------------- |
| shadcn CLI   | 4.x (`shadcn@latest` at init)      | Native monorepo support. Plan said "CLI 3.x"; 4.x is current — same approach. |
| lucide-react | ^1.38.0                            | Icon library.                                                                 |
| Tiptap       | pin at Module 11 kickoff (ADR-009) | MIT core only.                                                                |

## Standing follow-ups

- **TS 7.1 + typescript-eslint** → lift ADR-010's pin (owner: whoever runs
  the first module after that release; verify `pnpm lint` before merging).
- **Prisma 8 GA** → revisit ADR-002 (contained to `packages/db`).
- **ESLint 10** → bump when `eslint-config-next`'s plugin tree declares ^10
  peers (`pnpm peers check` clean is the test).
- Better Auth exact pin lands here with ADR-001 (Module 04 spike).
