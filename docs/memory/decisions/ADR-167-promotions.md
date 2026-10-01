# ADR-167 — Promotions: time-boxed popups and a home band

- **Status:** Accepted
- **Date:** 2026-09-28
- **Module:** 11 (content), 12 (public site), 06 (translation engine), 03/10 (permissions)
- **Plan:** `docs/changes/changes-52-promotions-plan.md`
- **Extends:** ADR-071 (visibility decided in the query), ADR-083 (permission
  groups), ADR-091 (only active locales are served), ADR-164 (one translation
  engine). Nothing reversed.

## Context

The owner wants to feature a webinar, an event, a news item or an offer on
the public site for a set period, several at once, managed in the admin and
shown as a popup on chosen pages. A promotion may point at existing site
content or stand alone. Webinar sign-up stays with the external provider.

Three existing rules shape it:
- ADR-042 makes layout and composition code.
- architecture.md #6 forbids making public routes dynamic to solve a
  caching problem.
- Every public word must follow the active locales.

## Decision

1. **A promotion is content DATA shown in CODED slots.**
   - The popup host, the home band's position and the set of placements
     (`PROMOTION_PLACEMENTS`) are code.
   - Only the records are admin-managed.
   - This is the article model, not a return of the homepage composer.
   - Pages that may never show a popup (auth, legal, newsletter confirmation,
     a quiz mid-attempt, the admin) are a code list, not an option.
2. **Scheduled, Live and Ended are derived from the display window, never
   stored.** The stored status is `DRAFT | ACTIVE | ARCHIVED`. No cron job
   changes a promotion's state.
3. **The popup reads from its own cached endpoint, not the page payload.**
   - `GET /api/promotions` is public, read-only and `s-maxage=60`. A
     promotion therefore appears within about a minute of `startsAt`, with no
     admin action and with no public page's cache shortened.
   - It is not an anonymous mutation, and counts toward neither ADR-080's nor
     ADR-113's limit.
4. **A link is exactly one of** site content · a path on this site · an
   `https:` URL · nothing. It is enforced in `@repo/contracts` for the form,
   the action and the service alike.
   - Site content resolves to a URL at read time by its module's own public
     rule.
   - **A target that is not public hides the promotion**; it never renders a
     link to a 404.
5. **One modal at a time.** Concurrent promotions share one dialog, in
   priority order. They are never stacked.
6. **Languages follow the engine.** Promotions register in
   `TRANSLATABLE_TYPES`.
   - A reader in locale L sees a `TRANSLATED` or `MACHINE_TRANSLATED` row for
     L.
   - `NEEDS_REVIEW` and `OUTDATED` count as missing, because a short-lived
     promotion usually carries a figure or a date, and a stale one misleads.
   - Missing means hidden, unless the promotion is set to fall back to the
     default locale.
7. **A new permission group, `promotions`**
   (`view/create/update/delete/publish`).
   - It is seeded to `super_admin` and `admin` only, and assigned to other
     roles by the owner in the role editor. `admin` holds it because that role
     is built as "every key except `SUPER_ADMIN_ONLY_PERMISSIONS`", and these
     keys do not belong on that list: they capture and spend nothing, and a
     key on it cannot be granted below super_admin without an ADR, which is
     the opposite of "assignable to any role".
   - `publish` alone activates or archives.
8. **Webinar registration is out of scope.** The call to action is an
   external link. An "Add to calendar" file is generated read-only.

## Consequences

- A new public route family (`/api/promotions`,
  `/api/promotions/[id]/calendar.ics`) and a client island in the public root
  layout.
- Seven new public catalog keys or more, owed in `en` and `ar` in the same PR.
- The home band's freshness method (a per-section `cacheLife` vs client
  hydration) is settled by measurement in P4 and recorded in the DEVLOG.
- Impression and click counting is NOT decided here. It would be a third
  anonymous mutation and needs its own ADR.
