# changes-20 Phase 5 — screens adopt the design system (PR checklist)

**Date:** 2026-09-11
**Governs:** the call-site migration between Phase 4 (`/admin/design-system`)
and Phase 6 (the lint that forbids regressions). Binding specs are
`docs/design-system/tokens.md` §2.3, §3, §6 and ADR-072/073/074/075.
**No new ADR.** Every change below applies an accepted decision at a call
site. ADR-075 names this phase as the one that decides compact card titles.

The brief (`changes-20-Ui.md`) lists no phases; Phase 5's scope is what the
Phase 2–4 DEVLOG entries hand forward ("Found, not fixed here (Phase 5)"),
plus the local components that duplicate a Phase 3 one.

## Rules for every PR in this phase

- **Swap the component, don't restyle the old one.** A local wrapper that
  duplicates a `@repo/ui` component is rebuilt on it or deleted.
- **Spacing is fixed at the call site; type never is** (ADR-072 §7). No
  `text-[…]`, no private size.
- Cancelled surfaces (`/admin/website/**`, ADR-042) are not brought up to
  conventions. They inherit whatever the shared wrappers render.
- Each PR: `@repo/ui` + `@repo/web` tests, `typecheck`, `lint` on the
  touched packages, and a live check on the dev server.

## 5.1 Admin frame — one change per wrapper, every screen follows

| #   | Local code                                                                             | Becomes                                                                                                                                                                                                     | Reach              |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| a   | `AdminPageHeading` (`h1` 24px semibold, description optional, `meta` beside the title) | `PageHeader` (30px bold `PageTitle`, 16px `PageDescription`, `meta` → `status` beside the description). `backHref` stays app-side (it needs `next/link`). `as="h2"` passes through a new `titleRender` prop | 34 screens         |
| b   | `AdminSection` (hand-built `rounded-lg border p-5`, `text-lg` h2)                      | `Card` + `CardHeader`/`CardTitle` + `CardContent` (24px rhythm, no hand padding)                                                                                                                            | 12 files           |
| c   | `AdminBreadcrumbs` (`/` text separators)                                               | `Breadcrumb*` (chevron, RTL-mirrored, `aria-current`)                                                                                                                                                       | shell              |
| d   | `AdminSidebarNav` rows (`py-1.5 text-sm`, `bg-muted` active)                           | `NavItem` (40px, `text-nav`, `--accent` hover/active). Collapsed rail keeps icon-only + `aria-label`                                                                                                        | shell + mobile nav |
| e   | Sidebar `w-[var(--width-sidebar)]`, header `h-[var(--height-header)]`                  | `w-(--width-sidebar)`, `h-(--height-header)` (token references, ADR-072 §10)                                                                                                                                | shell              |
| f   | Main `p-4 md:p-6`                                                                      | `p-4 md:p-6 lg:p-8` (§3.1)                                                                                                                                                                                  | shell              |
| g   | `DashboardStatCard`                                                                    | `MetricCard` (icon in a status ink, trend in the meta line)                                                                                                                                                 | dashboard          |
| h   | Dashboard's secondary link tiles (`rounded-xl ring-1` recipe)                          | `Card size="sm"` with `.card-hover`                                                                                                                                                                         | dashboard          |
| i   | Local `FilterBar` (the DataTable `filters` group)                                      | `FilterBarRow` from `@repo/ui` — same layout, one implementation                                                                                                                                            | 8 files            |

**Card-title decisions (ADR-075 hand-off):**

| Screen           | Card                         | Title                                                      |
| ---------------- | ---------------------------- | ---------------------------------------------------------- |
| Dashboard        | growth chart, article status | `SectionTitleCompact` + icon (the reference's chart cards) |
| Dashboard        | recent activity              | full `CardTitle` (the reference's "Live Activity Feed")    |
| Learn → Progress | four table cards             | `SectionTitleCompact` (dense analytics)                    |
| Settings hub     | category link cards          | `Card size="sm"` (16px)                                    |

## 5.2 Admin screens

- Toolbar searches that are an `Input` beside a glyph → `SearchInput`.
- Page-level status chips passed as `meta` move beside the description.
- `text-[0.625rem]` → `text-3xs`; `min-h-[50vh]`/`max-h-[60vh]` → scale values.

## 5.3 Public call sites

- Mobile nav + lesson contents sheets: drop `w-[min(22rem,90vw)]` (the Sheet
  owns `w-3/4 sm:max-w-sm`); the sheet title becomes `sr-only` (it
  duplicates the trigger's name); accordion rows and links share one inset.
- Homepage cards: remove call-site card padding in favour of Card parts.
- CourseCard level chips: put them on a token surface (they measure 3.9–4.1
  on the cover art in dark mode).
- Header and article-sidebar searches → `SearchInput`.
- Arbitrary values with a token equivalent (`h-[var(--…)]`, sizes on the
  spacing scale) → the token. Grid templates and transition lists are left
  for Phase 6 to allow-list or name.

## 5.4 Close-out

- DEVLOG entry with per-PR test results.
- Post-Phase-5 public visual pass (spacing only), then Phase 6.

## Status — done (2026-09-11)

5.1–5.3 shipped as planned. The close-out turned into Phase 6:

- The three "found, not fixed" items were fixed: the Accordion recipe, the
  media picker's dialog header, and every arbitrary value, which is now named
  or on the scale.
- The ban is lint-enforced (code-style #21), and so is the icon library
  (#22).
- The phone-width browser pass found a recurring grid overflow, fixed
  everywhere and guarded (#23).

See the DEVLOG entry of the same date.
