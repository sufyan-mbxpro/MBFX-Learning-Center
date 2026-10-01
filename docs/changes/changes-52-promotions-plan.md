# changes-52 — Promotions: time-boxed events, webinars, news and offers

- **Status:** Complete — P1–P8 landed 2026-09-29 (schema, service, admin, public popup and band, webinar extras, translation engine, counters under ADR-170, E2E).
- **Decision record:** ADR-167 (`docs/memory/decisions/ADR-167-promotions.md`),
  which must be Accepted before PR P1 merges.
- **Modules:** 11 (content: the entity, its service and admin), 12 (public
  site: the popup and the home band), 06 (translation-engine registration),
  03/10 (a new permission group).

## 1. What the owner asked for

> Show a specific event, news item or offer on the home page (and other
> pages) for a specific time. Several can run at once. Managed from the admin,
> shown as a popup. Webinars included. A promotion can point at a course,
> article, video, glossary term or anything else on the site, or stand alone.

Owner's answers (2026-09-28):

| Question                    | Answer                                                                                                                                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where does the popup show?  | **Several pages.** Plan a page-placement choice, not home only.                                                                                                                                                                                                                                  |
| Webinar registration        | **External link only** (Zoom, Teams, …). No sign-up form.                                                                                                                                                                                                                                        |
| Languages                   | **Multilingual like every other module**, following the admin's ACTIVE languages. A reader chooses their language, and the promotion shows in it.                                                                                                                                                |
| Who manages it              | **A separate permission group**, assignable to any role.                                                                                                                                                                                                                                         |
| Impression and click counts | **Not in the initial build** (owner, 2026-09-29). View, click and dismiss counts stay the optional P7. If they are wanted later, a separate ADR comes first, because counting visitor actions adds writes anonymous visitors can trigger. **Asked for the same day; built as P7 under ADR-170.** |
| Home band freshness         | **Deferred to P4 testing** (owner, 2026-09-29). Option A (the band's own Suspense/cache behaviour) is preferred; Option B (hydrate from the promotions endpoint) ships only if A is shown to shorten the whole home page's cache. See §7.4.                                                      |

## 2. Shape of the feature

A **Promotion** is an admin-managed record with:

- a **kind**: `WEBINAR` · `EVENT` · `OFFER` · `NEWS` · `ANNOUNCEMENT`. It picks the
  badge and the template (a webinar shows its date and an "Add to calendar"
  button). Kind drives no other behaviour.
- a **display window**, `startsAt` → `endsAt` (both required, UTC). A
  webinar's own time (`eventStartsAt` / `eventEndsAt`) is separate: a webinar
  is announced a week before it happens.
- a **link**, exactly one of:
  - `CONTENT`: a course, lesson, quiz, article, video topic, glossary term or
    tool, picked from the site.
  - `PATH`: a page on this site (`/support`, `/learn/forex`).
  - `EXTERNAL`: `https:` only (the webinar's Zoom/Teams link).
  - `NONE`: a standalone notice.
- **placements**: where it appears, from a closed code registry (§4).
- **display rules**: popup and/or band, priority, delay before the popup
  opens, frequency (once · once per session · once per day · every visit), and
  audience (everyone · guests · signed-in learners).
- **words per language**: title, body, badge, button label and image alt text, in
  `PromotionTranslation` rows (§6).

**Linked vs standalone.** A promotion linked to site content may leave its
title, summary and image empty; it then borrows the linked item's own title,
excerpt and cover in the reader's language. A standalone promotion must fill
them in (enforced by the contracts schema).

**Status is derived, not stored.** The stored status is only `DRAFT | ACTIVE |
ARCHIVED`. _Scheduled_, _Live_ and _Ended_ are computed from the window when
read (ADR-071's lesson: visibility decided in the query needs no cron).

## 3. Data model (`@repo/db`)

```prisma
enum PromotionKind      { WEBINAR EVENT OFFER NEWS ANNOUNCEMENT }
enum PromotionStatus    { DRAFT ACTIVE ARCHIVED }
enum PromotionFrequency { ONCE PER_SESSION DAILY EVERY_VISIT }
enum PromotionAudience  { ALL GUESTS LEARNERS }
enum PromotionLinkKind  { CONTENT PATH EXTERNAL NONE }
enum PromotionTargetType { COURSE LESSON QUIZ ARTICLE VIDEO_TOPIC GLOSSARY_TERM TOOL }
enum PromotionUntranslated { HIDE SHOW_DEFAULT }

model Promotion {
  id               String   @id @default(cuid())
  kind             PromotionKind
  status           PromotionStatus @default(DRAFT)
  placements       Json            // string[] of PROMOTION_PLACEMENTS keys, validated by contracts
  showAsPopup      Boolean  @default(true)
  showInBand       Boolean  @default(false)
  priority         Int      @default(0)
  startsAt         DateTime
  endsAt           DateTime
  eventStartsAt    DateTime?
  eventEndsAt      DateTime?
  frequency        PromotionFrequency @default(PER_SESSION)
  delaySeconds     Int      @default(5)
  audience         PromotionAudience  @default(ALL)
  untranslated     PromotionUntranslated @default(HIDE)
  imageAssetId     String?
  linkKind         PromotionLinkKind  @default(NONE)
  targetType       PromotionTargetType?
  targetId         String?
  targetPath       String?  @db.VarChar(500)
  targetUrl        String?  @db.VarChar(1000)
  recordingTopicId String?  // webinar: "Watch the recording" after it ends
  version          Int      @default(1) // bumped on every save; frequency keys include it
  createdById      String
  updatedById      String?
  deletedAt        DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  translations     PromotionTranslation[]

  @@index([status, startsAt, endsAt])
  @@map("promotions")
}

model PromotionTranslation {
  id                String   @id @default(cuid())
  promotionId       String
  locale            String   @db.VarChar(10)
  title             String?  @db.VarChar(160)
  body              String?  @db.Text     // short rich text, sanitised on save
  badge             String?  @db.VarChar(40)
  ctaLabel          String?  @db.VarChar(60)
  imageAlt          String?  @db.VarChar(250)
  translationStatus TranslationStatus @default(TRANSLATED)
  sourceHash        String?  @db.VarChar(64)
  updatedAt         DateTime @updatedAt
  promotion         Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)

  @@unique([promotionId, locale])
  @@map("promotion_translations")
}
```

- `placements` is JSON rather than a join table because the set is a small,
  closed code registry. It is validated on write, the same way
  `footer.menuColumns` is.
- `ReferenceSourceType` gains `PROMOTION`. The image and the recording topic
  write `ContentReference` rows, so the media library's usage counts include them
  (the ADR-132 quiz-cover precedent).
- `MEDIA_CATEGORIES` gains `promo`.
- One migration, `2026XXXX_promotions_changes52`.

## 4. Placements (code registry, `@repo/contracts`)

```ts
export const PROMOTION_PLACEMENTS = [
  "home", // /[locale]
  "learn", // /learn/** (both schools, courses, lessons, quizzes, videos)
  "news", // /news/**, /analysis/**
  "glossary", // /glossary/**
  "tools", // /tools/**, /economic-calendar
  "support", // /support
  "everywhere", // every public page except auth, legal and newsletter confirm pages
] as const;
```

- `placementsForPath(pathname)` is a pure function beside the registry that
  maps a locale-less public path to the placements that match it. It is unit
  tested against every `ROUTE_PATHS` key, so a new section fails a test until
  it is filed.
- **Never shown on** sign-in, sign-up, forgot and reset password, `/legal/*`,
  `/newsletter/*`, a quiz runner mid-attempt, or anything under `/keystone`.
  This list is code (`PROMOTION_EXCLUDED_PATHS`), not an admin option: a popup
  over a password form is always wrong.
- The **band** (inline cards rather than a modal) exists only on the home
  page in v1, as the `promotions` key in `_sections/registry.ts`. Other pages
  get the popup only. A band elsewhere is a later code change, not a setting
  (ADR-042: composition is code).

## 5. Service layer (`@repo/core/promotions.ts`)

| Function                                                      | Notes                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listPromotions(filter, cursor)`                              | Admin list: derived status, per-locale readiness, target health                                                                                                                                                                                            |
| `getPromotion(id)`                                            | Editor load, all translations                                                                                                                                                                                                                              |
| `savePromotion(input, subject)`                               | One transaction: promotion + default-locale translation + references + audit; bumps `version`; `afterSourceSave` sweep; enqueues translation jobs; `revalidateTag("content", { expire: 0 })`                                                               |
| `savePromotionTranslation(id, locale, input)`                 | Human save, writes `TRANSLATED` + source hash (ADR-164)                                                                                                                                                                                                    |
| `setPromotionStatus(id, status)`                              | Activate / archive (needs `promotions.publish`)                                                                                                                                                                                                            |
| `duplicatePromotion(id)`                                      | Copies as DRAFT, every language included, window unchanged (the editor moves the dates; the columns are required, so there is nothing to clear to). Recurring webinars use this, so there is no recurrence engine                                          |
| `softDeletePromotion(id)` / `restorePromotion(id)`            |                                                                                                                                                                                                                                                            |
| `loadLivePromotions(locale, now, { unavailableTargetTypes })` | Public read (§7). Returns every placement for the locale; the caller filters by path with `promotionShowsOnPath`, so a cache holds one entry per locale, not one per page. The route passes the target types whose section a feature flag has switched off |
| `searchLinkableContent(q, types)`                             | Admin link picker across the seven target types, drafts included and labelled with their status                                                                                                                                                            |
| `resolvePromotionTarget(p, locale)`                           | Target → public path via `coursePath` / `lessonPath` / `quizPath` / article, video and glossary path helpers; returns `null` when the target is not public by its module's OWN rule                                                                        |

**A target that is not public hides the promotion** rather than rendering a
link to a 404. The admin list shows "Target not public" on that row.

**Every mutation** calls `requirePermission()` first (in the action) and writes
`recordAudit`. The service re-checks its own key with `can()`, and holds one
rule a key alone cannot: editing an ACTIVE promotion (its default words or a
translation) needs `promotions.publish`, because the edit reaches visitors the
moment it saves. A restore from the trash always lands as DRAFT.

## 6. Languages

The promotion follows the site's ACTIVE locales exactly as articles and
courses do (ADR-091, ADR-164):

- It is registered in `TRANSLATABLE_TYPES` through `promotion-translation.ts` +
  `promotion-source.ts`. Saving the English enqueues one job per active
  non-default locale, a new language's backfill includes promotions, and the
  Review queue lists them.
- **What a reader in locale L sees**, decided in `loadLivePromotions`:
  - A translation for L in `TRANSLATED` or `MACHINE_TRANSLATED`: shown in L.
  - `NEEDS_REVIEW` (the number check flagged a changed figure) or `OUTDATED`:
    treated as missing. A promotion is short-lived and often carries a price,
    a date or a percentage, and a stale figure is worse than no popup.
  - Missing: the per-promotion `untranslated` switch decides, `HIDE` (default)
    or `SHOW_DEFAULT` (show the English).
- A linked promotion's borrowed title, excerpt and cover come from the TARGET'S
  translation for L, through the target module's existing `applyReadingLocale`
  rules.
- The editor shows each active locale's state (Translated · Machine · Needs
  review · Missing), plus "Translate with Google" prefill, as the article
  editor has. _(P6:_ the state sits beside the existing language switcher in
  the section header rather than in a separate tab strip — the changes-44 #3
  convention every other editor follows. An untouched prefill saves as
  MACHINE_TRANSLATED; the first edit makes it TRANSLATED.)
- Dates and times render with `Intl.DateTimeFormat` in the reader's locale and
  timezone, so `ar` gets Arabic digits and RTL layout from the logical-property
  rules.
- **Catalog:** every new public string (`promotions.*`: "Not now", "Add to
  calendar", "Starts in {time}", "Watch the recording", kind badges) lands in
  `en.json` **and `ar.json`** in the same PR, because `ar` is in
  `ENFORCED_LOCALES`. Admin strings (`admin.promotions.*`, label at
  `admin.nav.promotions`, code-style #29) are English only.

## 7. Public rendering

### 7.1 Why the popup fetches on the client

Public pages are ISR with tag invalidation. A promotion goes live at its
`startsAt` with **no admin action**, so nothing revalidates the page at that
moment. Putting live promotions into the page or layout payload would force
every public page onto a minutes-long `cacheLife` just to notice a clock,
which is architecture.md #6's "fix a caching problem by making public routes
dynamic" in another form.

So the popup reads from its own endpoint:

- `GET /api/promotions?locale=ar&path=/learn/forex`
  - Parses input through contracts, maps `path` with `placementsForPath`, and
    calls `loadLivePromotions`.
  - Returns only what the popup renders: resolved words, the resolved href, and
    the image URL and alt text. It never returns a target id or a draft.
  - `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`, so a
    promotion appears within about a minute of its start with no cron. `after()`
    is not needed.
  - Read-only. It is not an anonymous mutation, so the ADR-080/113 count is
    untouched.

### 7.2 `PromotionHost` (client island)

- Mounted once in the public root layout, it reads `usePathname()` and the
  existing `PublicSessionProvider` for the audience filter (no second session
  call).
- It fetches after hydration, waits `delaySeconds`, and applies the frequency
  rule with the pure `shouldShowPromotion(promo, store, now)` function.
  - Keys: `promo:{id}:v{version}` in `localStorage` (`ONCE`, `DAILY`) or
    `sessionStorage` (`PER_SESSION`).
  - Wrapped in try/catch like `announcement-bar.tsx`. When storage is
    unavailable, it shows at most once per page view.
- **One modal at a time.** Several live promotions become one dialog with a
  small carousel (dots, prev/next), highest priority first, at most 3. A
  promotion dismissed here stays dismissed per its frequency.
- It re-checks `endsAt` against the client clock before opening, so a tab left
  open does not show an ended offer.
- Nothing opens on first paint (no layout shift, no CLS hit). The default delay
  is 5 s, which also keeps clear of Google's intrusive-interstitial rule on
  mobile.

### 7.3 The popup

- `@repo/ui` `Dialog` at every width (P4). The planned bottom `Sheet` on
  phones was dropped: the Dialog is already full-width below `sm:`, and a
  second component would mean a second focus and close path to keep right.
- Renders `DialogTitle` + `DialogDescription` (code-style #11).
- Order: image → kind badge → title → body.
  - A **webinar or event** adds its date and time in the reader's zone, a
    live countdown ("Starts in 2 d 4 h") and **Add to calendar**.
  - Then the CTA button (the external link opens in a new tab with
    `rel="noopener noreferrer"` and `ExternalBadge`) and **Not now**.
- Focus goes to the dialog, not the CTA, and returns on close.
- `prefers-reduced-motion` turns off the entrance animation.
- A new public component, `@repo/ui/components/promo-card`, is shared by the
  popup and the band.

### 7.4 The home band

- `promotions` in `SECTION_COMPONENTS`, with a `SECTION_PENDING` skeleton. It
  renders nothing when nothing is live (ADR-047 §2), so a fresh install looks
  unchanged.
- It lists promotions with `showInBand` and placement `home` or `everywhere`,
  with no frequency rule (a band is not an interruption).
- **Open technical point, settled in P4:** the band sits inside the cached home
  page, so it has the same clock problem as §7.1.
  - Option A: `loadLivePromotions` inside the band's own `<Suspense>` calls
    `cacheLife({ revalidate })` with the seconds until the next window
    boundary, clamped to 60–3600 s. P4 must verify this does not shorten the
    whole home page's cache.
  - Option B (fallback): the band hydrates from the same endpoint behind a
    fixed-height skeleton.
  - A is the preferred option (owner, 2026-09-29) and is built first. P4
    measures whether it shortens the whole home page's cache; B ships only if
    it does. The result is recorded in the P4 DEVLOG entry.
  - **P4 outcome: A, as a dynamic hole.** Next's installed cacheLife docs
    ("Prerendering behavior") settle the question: a cache whose `expire` is
    under five minutes is excluded from the prerender and resolved per request
    inside its own `<Suspense>`, and the rest of the page keeps its own
    lifetime. `getLivePromotions` uses `{ stale: 30, revalidate: 60, expire:
120 }` on purpose, so the band is that hole, never a shortened page. A
    build-level measurement is still owed (DEVLOG P4).

### 7.5 Webinars

- `GET /api/promotions/[id]/calendar.ics?locale=` generates an iCalendar file
  (times in UTC, the join link as `URL` and at the end of `DESCRIPTION`). It is
  public and read-only, and 404s for a promotion that is not live, has no event
  time, or whose event has ended. _(Changed in P5:_ the UID is the id alone and
  the version is `SEQUENCE`, so a second download after an edit UPDATES the
  calendar entry rather than adding a duplicate beside it.)
- Before `eventStartsAt` the card counts down ("Starts in 2d 4h") and offers
  **Add to calendar**; between start and end it says **Live now**.
- After `eventEndsAt`, if `recordingTopicId` is set and that video topic is
  public, the popup and band switch to **"Watch the recording"**. Otherwise the
  promotion ends at `endsAt` as usual. _(P5:_ a recording now requires
  `eventEndsAt`, not only `eventStartsAt` — an event with no end never ends, so
  the recording would never show.)

## 8. Admin: `/keystone/promotions`

**Sidebar:** under Content, after News & Analysis.

**List:** a `DataTable` with columns Title · Kind · Status chip (Draft,
Scheduled, Live, Ended, Archived, Target not public) · Window · Placements ·
Languages (per-locale dots).

- **Filters:** kind, status, placement.
- **Toolbar:** "New promotion" (ADR-106).
- **Row actions:** Edit · Duplicate · Archive · Delete (Delete through
  `ConfirmDialog`).

**Editor sections** (the article editor's `editor-section` layout):

1. **Content:** kind, title, body (a trimmed rich-text toolbar: bold, italic,
   link, list), badge, button label.
2. **Link:** tabs Site content · Page on this site · External link · None.
   - Site content is a searchable `AdminCombobox`-style picker over
     `searchLinkableContent`, showing type and status, with a warning when the
     choice is not yet public.
   - "Use the linked item's title and image" is on by default.
3. **Image:** `ImageUploadField` / `MediaPickerDialog`, category `promo`, alt
   text.
4. **Schedule:** display window (two `DateTimePicker`s, entered in the EDITOR'S
   own local time and stored as instants — ADR-071's rule for every schedule in
   the admin, "the editor's own clock is the zone"; a site-timezone setting
   would be a second clock nobody else here reads). For a webinar or event, the event start and end and
   the recording topic.
5. **Where and how:** placements (checkboxes; "Everywhere" disables the
   others), popup / home band switches (a switch leads its row, code-style
   #25), priority, delay, frequency, audience, untranslated behaviour.
6. **Preview:** the real `PromoCard` popup in light and dark, desktop and
   phone, in any active locale.
7. **Languages:** the per-locale tabs from §6.

**Other conventions:**

- `Field` + `useFieldErrors` against the action's own schema (code-style #24).
- Save sits at the inline end.
- Status actions (Activate, Archive) are intent-coloured buttons.
- AI: the promotion's plain fields join `AI_FILL_FIELDS` for the existing
  "Generate with AI" brief (ADR-126), gated on `promotions.update` + `ai.use`.

## 9. Permissions

- A new group, **`promotions`**, is added to `PERMISSION_GROUPS` after
  `articles` (sidebar order), with the label `admin.permissionGroups.promotions`.
- **Keys:** `promotions.view` · `promotions.create` · `promotions.update` ·
  `promotions.delete` · `promotions.publish`. `publish` covers Activate and
  Archive, so an author can draft and a publisher can put it live.
- **Seed:** granted to `super_admin` and `admin` only (`admin` through the
  registry filter, ADR-167 #7). The owner assigns the keys to any other role
  in the role editor. No other role's grant set changes, and
  `permission-groups.test.ts` pins the content manager's.
- `/keystone/promotions` is gated on `promotions.view`. Every action is gated
  on its own key, and the STAFF gate comes first (security #3).

## 10. PRs

| PR     | Scope                                                                                                                                                                                                                                                                                                                                            | Done when                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **P0** | ADR-167 Accepted; this plan                                                                                                                                                                                                                                                                                                                      | Governance check green                                      |
| **P1** | Schema + migration; contracts (`promotionSaveSchema`: exactly-one link, `endsAt > startsAt`, `eventEndsAt > eventStartsAt`, https-only external, `internalPathSchema` for paths, standalone requires title); `PROMOTION_PLACEMENTS` + `placementsForPath` + exclusions; permission seed; `promo` media category; `ReferenceSourceType.PROMOTION` | Contracts ≥ 90% coverage, seed idempotent                   |
| **P2** | `@repo/core/promotions.ts`, target resolution, `loadLivePromotions`, audit + revalidation                                                                                                                                                                                                                                                        | Testcontainers integration suite green                      |
| **P3** | Admin list + editor + preview + sidebar entry                                                                                                                                                                                                                                                                                                    | Admin convention guards green                               |
| **P4** | `GET /api/promotions`, `PromotionHost`, `PromoCard`, popup, home band (+ §7.4 decision), en + ar catalog                                                                                                                                                                                                                                         | Unit tests for `shouldShowPromotion`, popup component tests |
| **P5** | Webinar: countdown, `.ics` route, recording handoff                                                                                                                                                                                                                                                                                              | `.ics` validated by a parser test                           |
| **P6** | Translation engine registration, editor language tabs, AI form-fill fields                                                                                                                                                                                                                                                                       | Engine tests; coverage and review queue list promotions     |
| **P7** | Impression / click / dismiss counters, aggregated per day with no event log. It is a THIRD anonymous mutation, decided in ADR-170: `POST /api/promotions/events`, five guards, counts only                                                                                                                                                       | Done 2026-09-29                                             |
| **P8** | E2E: create → activate → popup shows on `/` and `/ar` → dismissed respects frequency; permission-denied asserted at DB level; axe with the dialog open; RTL smoke on the popup; DEVLOG; skill updates (content, public-site)                                                                                                                     | Done 2026-09-29                                             |

## 11. Tests the plan commits to

- **Contracts:** each link kind accepted alone and rejected in combination;
  `//evil.example` and `javascript:` refused; window order; placements must be
  registry keys; "everywhere" is exclusive.
- **`placementsForPath`:** every `ROUTE_PATHS` key maps to at least one
  placement or is explicitly excluded; auth, legal and newsletter paths map to
  none.
- **`shouldShowPromotion`** (fast-check where it fits): ONCE never repeats,
  DAILY repeats after the day rolls in the reader's zone, a `version` bump
  re-shows, and storage throwing never shows twice in one view.
- **Core integration:**
  - window boundaries (`startsAt` inclusive, `endsAt` exclusive);
  - DRAFT, ARCHIVED and soft-deleted rows are never public;
  - an unpublished target hides the promotion;
  - the locale rules in §6 hold for every status;
  - priority order;
  - `SHOW_DEFAULT` vs `HIDE`.
- **API:** no draft, id or target id in the response; `Cache-Control` present.
- **Security:** each action refuses without its key; a learner session 404s on
  `/keystone/promotions`.

## 12. Out of scope (v1)

- Built-in webinar registration or email capture (owner: external link only).
- Recurring schedules (use Duplicate).
- Per-country or per-device targeting.
- A band on pages other than home.
- A promotion-driven top bar (the announcement bar stays a setting).
- A/B variants.
- Per-visitor tracking of any kind. The P7 counters (ADR-170) are daily totals with no identifier.
