# ADR-042: Cancel the dynamic site-control programme — Module 16 and admin-configurable structural design are withdrawn, not paused; code, data and public rendering still stand

**Status:** Accepted
**Date:** 2026-09-07
**Module:** 16 (Website Builder / CMS), and 08 / 09 / 12 for the structural-design surfaces ADR-038 covered
**Supersedes:** ADR-037, ADR-038 — both recorded a **temporary pause pending
the owner's resume**. That premise is withdrawn. Their code-level mechanisms
are retained verbatim (see Decision #2); only their "until the owner asks to
resume" framing is replaced.
**Superseded by:** —

## Context

ADR-037 (2026-09-06) paused Module 16's admin UI. ADR-038 (same day) extended
the reasoning to the Navigation manager, the Homepage section composer, the
Layout settings group and the theme editor's Layout & Display tab. Both were
written as pauses: hide the entry points, keep everything, resume when asked.

On 2026-09-07 the owner closed that door: the dynamic site-control plan is
**cancelled**, not deferred. It will not be resumed, and no future work is to
be planned against it. `docs/MBX-Dynamic-Site-Control-Plan-v2.md` (v2.2) —
which plan.md Part F #11 locked on 4 Sep 2026 as the binding Module 16 plan —
is withdrawn as a forward plan and becomes historical record, joining
`docs/MBX-Dynamic-Site-Controle-Plan.md` (v1) in the "do not implement from
this" category.

The design philosophy ADR-038 stated stands and is now the settled one, not an
interim posture: **site design is built module-by-module in code or
statically; only content _data_ is dynamic and admin-managed.**

This changes a LOCKED plan line (Part F #11) and Part E's build order, so per
Part F #10 the ADR lands before any code or doc change.

## Decision

### 1. The programme is cancelled

- Module 16 is **withdrawn**, not paused. No Phase 4 completion, no Phases
  5/6/9, no resumption path. `claude.md`'s module table, `docs/plan.md` Part D
  §"Module 16" and Part F #11, and `.claude/skills/website-builder/SKILL.md`
  say **CANCELLED (ADR-042)** and point here.
- ADR-020…ADR-036 are **not** reopened, reversed or amended. They remain
  accurate records of decisions that were made and code that exists. An ADR is
  history; cancelling the programme does not rewrite it. They simply stop
  being forward-binding: no new code is written to satisfy them.
- The structural-design surfaces ADR-038 hid (Navigation manager, Homepage
  section composer, Settings → Layout, theme Layout & Display) are likewise
  cancelled rather than paused. Reordering a menu, changing homepage
  composition or altering layout tokens is a **code change**, permanently.

### 2. "Hide, don't remove" is retained unchanged

Every mechanism ADR-037 #1–#4 and ADR-038 #1–#3 introduced stays exactly as
it is, and keeps its current value:

| Mechanism                                      | File                                            | Value   |
| ---------------------------------------------- | ----------------------------------------------- | ------- |
| `WEBSITE_BUILDER_ADMIN_UI_ENABLED`             | `admin/_components/admin-shell.tsx`             | `false` |
| `STRUCTURAL_DESIGN_ADMIN_UI_ENABLED`           | `admin/settings/_components/settings-shared.ts` | `false` |
| `PAUSED_SETTINGS_GROUPS` ⊇ `{"cms", "layout"}` | same file                                       | as-is   |
| `THEME_LAYOUT_TAB_ENABLED`                     | `admin/theme/theme-editor.tsx`                  | `false` |

The owner's original instruction — _nothing may be deleted_ — is unchanged by
cancellation. This ADR does **not** authorise removing `@repo/blocks`, the
`packages/core/src/cms/*` or `packages/contracts/src/cms/*` trees, the
`/admin/website/*` routes, the CMS Prisma models, their seeded rows, or the
`cms.*` / `redirects.manage` permissions. Deleting any of that is a separate
decision requiring its own ADR (see §"Open decisions" below), because unlike a
hidden nav entry it is not one line to undo.

The constants keep their names. Renaming `*_PAUSED`-flavoured identifiers to
`*_CANCELLED` would be churn across files whose behaviour does not change; the
ADR reference in each file's comment is updated to point here instead.

### 3. What the platform keeps (the "basic features" line)

Cancellation does not touch the design surfaces the owner named as retained
when Module 16 was first paused, and they are hereby permanent, not
provisional:

- **Branding** — logo, favicon, brand assets (`/admin/theme` → Logos & Favicon).
- **Theme / colour** — the full ADR-002/003/008 engine: brand colours, derived
  hover/active, light/dark modes, presets, contrast validation.
- **Media** — upload, library, reuse across modules, via the standalone
  `/admin/media` screen (the 2026-09-06 follow-up to ADR-037 Decision #4).
- **Content data, dynamic and admin-managed** — News & Analysis articles,
  categories, tags, glossary, users/roles/employees, settings, feature flags,
  market data.

### 4. Nothing about authorization changes

No permission is revoked, no route is locked, no gate is added or removed.
Every mutation's own `requirePermission`/`requireAnyPermission` remains the
boundary (security.md #1). The hidden nav entries are UX, exactly as ADR-037
and ADR-038 both stated; that framing is unchanged.

## Findings that shaped this ADR

Recorded because they are the non-obvious parts, and the next session should
not have to rediscover them.

1. **The live homepage and `/news` currently render from the CMS, not from
   code.** `app/(public)/[locale]/page.tsx` runs `renderCmsHome()` **first**
   and only falls back to `_sections/registry.ts` when no `home` page is
   published; `app/(public)/[locale]/news/page.tsx` does the same via
   `renderCmsNews()` / `resolveCollectionPage("news", …)`. `seed.ts` (≈line
   1056 and ≈line 1448) publishes both. So on any seeded database the dynamic
   path is the one serving traffic — with its admin UI now permanently hidden.
   **This is the one place where "cancelled" and "current behaviour" are in
   open conflict**, and it is called out as an open decision below rather than
   settled silently here.
2. **The coded fallback is richer than the CMS page it lost to.**
   `page.tsx`'s own comment records that the published CMS home "legitimately
   has fewer sections than this fallback today" (`latest_analysis` and
   `glossary_spotlight` were scheduled to migrate in Phase 4, which never
   landed). Flipping back to the code path is therefore a restoration, not a
   downgrade — a materially different risk profile than it first appears.
3. **`(public)/[locale]/[...slug]` is a pure CMS route.** Unlike `/` and
   `/news` it has no code fallback: with the CMS retired it resolves nothing.
   Whether any authored page lives under it is a data question per
   environment.
4. **Real, reusable work exists inside the cancelled tree.** 34 blocks in
   `@repo/blocks` (including `faq`, `collection`, `featured-content`, `card`),
   a `CardTemplate`/`StylePreset` model pair, a provider registry, an SEO/
   JSON-LD builder (`core/src/cms/seo.ts`), a redirect service, and a link-
   target contract. Cancelling the _programme_ should not mean re-implementing
   these from scratch when a module wants one — `docs/changes/changes-07-plan.md`
   §10 records which ones the article-editor work can harvest.
5. **`Redirect` is not CMS-only.** Module 15 writes 301 rows through it on
   every article/category/tag slug change, and the public article routes read
   it. It sits in the same schema neighbourhood as the CMS models but is a
   live Module 15 dependency — any future "delete the CMS tables" work must
   not take it.
6. **`ContentRelation` was never wired by the CMS at all.** It is in the
   schema, unused by every service. changes-07 claims it for article related-
   posts, which is a reuse, not a revival of anything cancelled.

## Consequences

- The forward plan for Module 16 is gone; `docs/MBX-Dynamic-Site-Control-Plan-v2.md`
  and `docs/cms/00-reconciliation.md` become read-only history.
- Site design changes are code changes, permanently. There is no admin path to
  menu order, homepage composition, layout tokens or fonts, and none is coming.
- The repo carries a body of unreachable-but-working CMS code and data of known
  size (34 blocks, 10 models, ~30 core service files, ~10 admin route folders,
  9 `cms.*` permissions). That is the accepted cost of "nothing may be deleted."
  It is dead weight in the dependency graph and in every future reader's mental
  model, and it will keep showing up in `pnpm typecheck`/`test`/`build` times.
- Governance reading order still surfaces the state: `claude.md` → rules →
  skill → ADRs → DEVLOG each name the cancellation.

## Open decisions this ADR deliberately does not make

1. **Whether `/` and `/news` flip back to code rendering** (Finding #1). The
   coherent end state of "design lives in code" is: delete the `renderCmsHome`/
   `renderCmsNews` switches and stop seeding the published pages, so
   `_sections/registry.ts` and the coded news listing serve traffic again.
   Finding #2 says that restores sections rather than losing them. But it
   visibly changes the live homepage, so it is the owner's call, not a
   consequence to be smuggled in under a cancellation note. Tracked in
   `docs/changes/changes-07-plan.md` §10.4.
2. **Whether the cancelled code and tables are eventually removed.** Retaining
   them is this ADR's position. If the owner later wants them gone, that needs
   its own ADR — it is a migration (10 models), a permission-seed change, and
   the deletion of a package.

## Alternatives considered

- **Leave ADR-037/038 as the record and just add a DEVLOG note.** Rejected:
  both ADRs say in their own text that development stops "until the owner asks
  to resume." Leaving that standing means the next session reads a resume path
  that no longer exists. An ADR's meaning is never edited — it is superseded
  (Part F #10, `governance:check` rule 2).
- **Reverse ADR-020…036 individually.** Rejected: they document decisions
  actually made and code actually written. Reversing them would falsify the
  record. Cancellation removes their forward force; it does not unmake them.
- **Delete the CMS code, models and package now.** Rejected here — out of step
  with the standing "nothing may be deleted" instruction, and far too large to
  bundle into a status change. Named as an open decision instead.
- **Rename the pause constants to cancellation constants.** Rejected as churn
  (Decision #2): identical behaviour, several files touched, no reader better
  off than an updated comment makes them.

## Compliance

- `pnpm governance:check` — this ADR exists before the doc/code changes land;
  ADR-037 and ADR-038 are modified on their `**Status:**` / `**Superseded
by:**` header lines only, which rule 2 explicitly permits.
- DEVLOG entry recording the cancellation, the documents updated, and the
  findings above, per testing.md #6.
- No test change: this ADR alters no behaviour. The suites that cover the
  retained CMS code stay green and stay running — a cancelled feature whose
  tests are switched off is a feature that silently rots.
