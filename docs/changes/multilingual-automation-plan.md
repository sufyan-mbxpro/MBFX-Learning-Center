# Automatic Multilingual Translation — Decisions & Phase Plan

**Status:** Phases 0–5 complete (Phase 5 on 2026-09-28, under ADR-164, with translatable settings deferred to their own ADR; revision 2). Phase 1 was built against a faked Google endpoint; the live-API spike is owed when a key is available.
**Scope:** Public site only (per ADR-043 — admin stays English)
**Owner decisions recorded:**

- Machine translations go live instantly; admin can review or change any translation at any time.
- **Google Cloud Translation (Basic, v2, API key) is the default, automatic translator.** It runs unattended on every save and every backfill.
- **AI (`@repo/ai`) is a manual assist layer on top.** An admin can use it inside the translation editor to rewrite, polish or retranslate a field. It never runs unattended and never writes to the database by itself (ADR-097 #4 stands).

This document holds four ADR drafts (Section 2) and the implementation plan (Sections 3–6). The codebase already has the `Locale` table, the translation tables, the `TranslationStatus` enum (`DRAFT / TRANSLATED / NEEDS_REVIEW / OUTDATED / MACHINE_TRANSLATED`), `sourceHash` on seven entities, slugs unique per `[locale, slug]`, `[locale]` routing, the header switcher, and the AI `translation` feature with metering and budgets. This plan adds the automation layer and closes the coverage gaps.

---

## 1. Summary of decisions

| #   | Question                                      | Decision                                                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Do unreviewed machine translations go public? | **Yes — instant live.** Machine-translated prose is `noindex` until a human saves it; labels/chrome are fully published. (ADR-A)                                                                                                                                                                        |
| D2  | Fallback for missing translations             | **Keep ADR-007.** ar/ur show the "not yet translated" notice, never English inside an RTL page. The gap is bounded by the inline run on save plus a 5-minute cron. (ADR-B)                                                                                                                              |
| D3  | Who translates automatically?                 | **Google Cloud Translation**, in a new domain package `@repo/translate`, with its own provider row, its own sealed credential and its own character-based usage table. (ADR-C)                                                                                                                          |
| D4  | What does AI do?                              | **Manual assist only**, in the translation editor: "Refine with AI" (improve the machine draft) and "Translate with AI" (alternative draft), through the existing `translation` feature and ADR-138's one-affordance-per-field rule. Result lands in the form; the admin's Save promotes it. (ADR-C §6) |
| D5  | Job infrastructure                            | **`TranslationJob` table**, drained by an inline `after()` run for the item just saved and by `/api/cron/translate` every 5 minutes as the safety net. Atomic claim, stale-lease recovery, conditional writes. (ADR-D)                                                                                  |
| D6  | When is work enqueued?                        | **On every save and every status change of the source**, not on "publish". ADR-071 makes scheduled content visible inside the query with no code running at that moment, so a publish hook would miss it.                                                                                               |
| D7  | Slugs                                         | **Reuse the English slug for every locale.** `@@unique([locale, slug])` already prevents collisions; no transliteration; keep redirect-on-slug-change. (No ADR — recorded here.)                                                                                                                        |
| D8  | Schema                                        | **No new `Language` table, no `origin` column.** The existing `TranslationStatus` carries both who wrote a row and whether it's protected (§3).                                                                                                                                                         |

---

## 2. ADR drafts

> **Accepted as:** ADR-A → **ADR-159** (with ADR-B folded in as its #7 and the ADR-113 FAQ amendment as its #6) · ADR-C → **ADR-160** · §3's enqueue and overwrite rules → **ADR-161** · ADR-D → **ADR-162**. The files in `docs/memory/decisions/` are binding; the drafts below are kept as the plan's reasoning and, where they differ, the ADR wins.

### ADR-A — Machine translations are published immediately, with review-gated indexing

**Context.** Until now, `MACHINE_TRANSLATED` rows were meant to stay unseen by readers until a human saved them (ADR-097, ADR-127). In practice the read paths disagree: the normal locale read path does not filter on `translationStatus` (see the comment on the enum in `schema.prisma`), while the `?lang=` reading path (`reading-languages.ts`) excludes `MACHINE_TRANSLATED` and `DRAFT`. The new requirement is that content saved in English appears in every active language automatically, and that activating a language backfills existing content. On a forex site, unreviewed machine output of leverage figures, risk wording and quiz answers is a real quality risk, and mass-indexed unreviewed MT is an SEO risk (Google's "scaled content abuse" policy).

**Decision.**

1. `MACHINE_TRANSLATED` rows are served to readers on every read path. The `?lang=` path stops excluding them, so there is one rule everywhere. `DRAFT` stays excluded from `?lang=` (it still means a duplicated article's copies, ADR-127).
2. **Prose content** (articles, lessons, glossary definitions, tool intro/body/FAQ, quiz question text, video topic bodies) whose translation row is `MACHINE_TRANSLATED` renders `robots: { index: false, follow: true }` via a conditional spread (code-style.md #26), keeps a self-referencing canonical, and is left out of the locale sitemap and of `hreflang` alternates until a human saves it.
3. **Labels and chrome** (menu items, categories, tags, catalog strings, attachment and link labels, social link labels) are published with no indexing restriction. They are short strings and low risk.
4. A human saving a translation promotes it to `TRANSLATED` (existing behaviour). That lifts `noindex` and adds the page to the sitemap and hreflang.
5. The admin translation dashboard lists `MACHINE_TRANSLATED` and `OUTDATED` rows as the review queue. Review is optional and can happen at any time; nothing waits on it.

**Consequences.** Readers get translations immediately; search engines only see prose a human has saved; the review queue turns the risk into a visible backlog instead of a gate. This supersedes the "never show machine rows" consequence of ADR-097/ADR-127, and the enum comment in `schema.prisma` is updated in the same PR. ADR-127's hreflang-404 bug is fixed by item 2: alternates are generated only for locales whose translation exists and is indexable.

### ADR-B — Fallback rule unchanged; the gap is bounded

**Context.** ADR-007 sets `fallbackCode: null` for ar/ur so English text never renders inside an RTL page; a "not yet translated" notice shows instead. The automation work raised the option of falling back to English during backfills.

**Decision.** Keep ADR-007. The gap is bounded, not "seconds":

- **Single-item edits:** the save action enqueues jobs and runs them inline in `after()` for that item only, so a normal edit is translated within the request's tail (typically seconds).
- **Anything the inline run doesn't finish** (Google error, budget pause, backfill volume) is drained by `/api/cron/translate`, scheduled **every 5 minutes** on the server crontab (a new line in `README.md` §6.9 and a new row in `docs/ops/cron.md`).
- A job that fails permanently leaves the notice in place and appears in the dashboard's failure list (ADR-D).

**Legal PDFs are a stated exception**, not a contradiction: a PDF is a download, not text inside an RTL page, so a locale with no uploaded document links the English PDF with a "document available in English" note (§4.2).

**Consequences.** No read-path changes. During a large backfill some pages show the notice for longer; the dashboard's progress bar is where that is visible.

### ADR-C — Google Cloud Translation as the automatic translator, in its own package, with a fifth sealed secret

**Context.** The owner wants translations produced automatically by Google Cloud Translation, admin-configurable without a deploy, with AI kept as a manual assist. security.md #10 requires an ADR for any secret stored in the database, and since ADR-098 it must say why the secret cannot live in env, name its single reader, justify its gate by blast radius, and explain why none of the existing seals is enough. There are four already (SMTP, market data, AI provider, reCAPTCHA); this is the fifth, so the bar is higher.

**Decision.**

1. **Package.** A new domain package **`@repo/translate`** owns the provider row, the usage table, the job table and the translation pipeline. It depends on `db / contracts / settings / secrets`. Direction: `core → translate`, `translate → secrets`. `auth` never imports it (same reasoning as `@repo/ai`: the session path must not gain a dependency that spends money). It sits beside `@repo/ai`, not inside it. architecture.md #8 gains this paragraph in the same PR.
2. **Why not an `AiProvider` row (the existing seal).** `AiProvider` models chat-completion vendors: a model table priced per token, a tier resolver, and a driver speaking a messages API. Google Cloud Translation has none of those: it is a fixed endpoint, billed per character, with no model choice. An `AiProvider` row would put a non-chat vendor into the AI model picker and would need token prices it doesn't have. `AiProviderKind.GOOGLE` already means Gemini, which makes the collision concrete.
3. **Why not env.** The owner asked for admin configuration without a deploy, matching the AI and market keys. The env master key (`TRANSLATE_SECRET_KEY`) stays in env, as with every other seal.
4. **Storage.** `TranslateProvider` singleton (`id = "default"`) with `apiKeyCipher` (AES-256-GCM through `@repo/secrets` under `TRANSLATE_SECRET_KEY`), write-only in the UI, with `loadTranslateDriver()` its **only reader** and no credential property on `TranslateProviderView`. **Edition: Cloud Translation Basic (v2), owner decision 2026-09-25.** The credential is an **API key**. The driver sends it in the `X-goog-api-key` header, never as the `?key=` query parameter, so it does not end up in access logs or error traces. The settings screen tells the admin to restrict the key in Google Cloud Console to the Cloud Translation API only (and to the server's IP where the hosting allows it); a key restricted this way is worth less if it leaks. Basic has no glossary resources, which this plan does not need: glossary consistency comes from substitution before the call (§4.3).
5. **Gate and blast radius.** The endpoint is **fixed in code**: there is no `baseUrl` field, so unlike the AI key, a changed setting cannot redirect content to an attacker's host. The remaining harm is **spend**: a stolen or misused credential translates at the victim's cost. The gate is a new key **`translations.provider.manage`**, seeded to **super_admin only** (a key rather than a role check, so a later grant is an ADR, as with `ai.providers.manage`). Viewing usage uses `translations.view`.
6. **AI as the assist layer.** No new AI feature key. The existing `translation` feature (light tier) gains an optional `draft` field on `translationPayloadSchema`: with a draft, the prompt **refines the machine translation** against the source; without one, it translates from scratch. The editor surfaces it per ADR-138: the rich-text toolbar's writing assistant for rich fields, `AiFieldMenu` for plain fields, with two actions, "Refine with AI" and "Translate with AI". The result lands in the form; the admin's Save writes `TRANSLATED` through the existing action. AI usage stays metered in `AiUsage` under the AI budget; Google usage is metered separately (item 7).
7. **Metering and budget.** `TranslateUsage` rows record characters in, locale, entity, status and **cost frozen at write time** (ADR-100 #3) from an admin-editable price per million characters. A monthly character budget (a column on `TranslateProvider`, per ADR-160 #6) **pauses** jobs at the cap (they stay `PENDING`, they do not fail) and the dashboard says so. Cost is shown as "estimated", as everywhere else (ADR-100).
8. **Test connection** translates one fixed sample string and reports success, auth error, quota error or network error, using the machine-readable taxonomy only (never the provider's raw message). It is a mutation-shaped route: `requirePermission("translations.provider.manage")` first, audit row on credential change.
9. **No env fallback.** One source of truth, as with the other four seals. An unreadable seal turns automatic translation **off** (jobs pause, dashboard shows "not configured") rather than failing every job.

**Consequences.** security.md #10 is amended in the same PR with a fifth paragraph. Automatic translation costs Google's per-character rate (Basic list price about $20 per million characters, to be confirmed against Google's pricing page when the price row is seeded; the dashboard shows the estimate before a backfill is enqueued, §4.4). Moving to Advanced (v3) later is a driver change plus a credential-format change (service account), and needs its own ADR because the stored secret changes shape. AI stays out of the unattended path, so the AI budget and prompt-exposure model are unchanged.

### ADR-D — A database-backed translation job queue

**Context.** ADR-078 chose `after()` and no queue. Backfilling a locale or re-syncing hundreds of items cannot run inside a request: it needs batching, retries with backoff, pacing against Google's quota, progress reporting, and protection against overwriting human work. Cron routes already exist (`housekeeping`, `publish-due`, `market-sync`) and are called from the server crontab with `CRON_SECRET`.

**Decision.** Add a `TranslationJob` table in `@repo/translate`, drained by two runners: inline `after()` for the item just saved, and `POST /api/cron/translate` every 5 minutes.

```prisma
enum TranslationJobKind {
  ITEM             // one entity × one locale
  BACKFILL_LOCALE  // expands into ITEM jobs for every translatable entity
}

enum TranslationJobStatus {
  PENDING
  RUNNING
  DONE
  FAILED
}

model TranslationJob {
  id         String               @id @default(cuid())
  kind       TranslationJobKind
  /// "*" for BACKFILL_LOCALE — never NULL: MariaDB treats each NULL as
  /// distinct in a unique index, which would let duplicates through.
  entityType String               @db.VarChar(40)
  entityId   String               @db.VarChar(40)
  locale     String               @db.VarChar(10)
  status     TranslationJobStatus @default(PENDING)
  attempts   Int                  @default(0)
  /// Backoff: a retry is not eligible before this time.
  runAfter   DateTime             @default(now())
  claimToken String?              @db.VarChar(40)
  claimedAt  DateTime?
  /// Machine-readable taxonomy only ("quota_exceeded", "auth_failed", …),
  /// never a raw provider message.
  lastError  String?              @db.VarChar(80)
  createdAt  DateTime             @default(now())
  updatedAt  DateTime             @updatedAt

  @@unique([kind, entityType, entityId, locale])
  @@index([status, runAfter])
}
```

Rules:

1. **Enqueue is an upsert.** On conflict with a `DONE` or `FAILED` row, reset to `PENDING`, `attempts = 0`, `runAfter = now()`. On conflict with a `PENDING` row, do nothing (already queued). On conflict with a `RUNNING` row, do nothing: rule 4's hash check re-queues it if the source moved underneath.
2. **Atomic claim.** `UPDATE … SET status = 'RUNNING', claimToken = ?, claimedAt = NOW() WHERE status = 'PENDING' AND runAfter <= NOW() ORDER BY createdAt LIMIT ?`, then select by `claimToken`. Two runners (inline and cron, or two overlapping cron ticks) can never take the same job. Batch size starts at 25.
3. **Stale-lease recovery.** At the start of each tick, `RUNNING` rows with `claimedAt` older than 10 minutes go back to `PENDING` (a crashed worker can't leave a job stuck).
4. **The job stores no content.** It reads the **current** English source when it runs, computes its hash, translates, then writes inside a transaction at `ReadCommitted` (ADR-056's lesson) with the target row locked (`SELECT … FOR UPDATE`):
   - target row absent or `MACHINE_TRANSLATED` → write, set `sourceHash`;
   - target row in any human-owned state (`TRANSLATED`, `DRAFT`, `NEEDS_REVIEW`, `OUTDATED`) → **do not touch content**; if it is `TRANSLATED` and the hash differs, set `OUTDATED`;
   - English source hash changed since the job read it → discard the result and re-queue the job.
     This prevents a job from overwriting a human edit saved while the job was in flight.
5. **Retries.** `attempts` caps at 3 with exponential backoff via `runAfter` (1 min, 5 min, 30 min). Quota and budget errors do not consume an attempt: they push `runAfter` forward. After the cap the job is `FAILED` and appears in the dashboard.
6. **Cache.** Revalidate the `content` tag **once per batch** (`revalidateTag("content", { expire: 0 })`), not per item.
7. **Enqueue points.** The save / status-change paths of every translatable entity (D6); locale activation (one `BACKFILL_LOCALE` per locale, expanded by the worker in pages); the dashboard's Sync buttons (expand to `ITEM` jobs). The catalog fill is a **dev script, not a job** (§4.4).
8. **Housekeeping.** `/api/cron/housekeeping` deletes `DONE` jobs older than 7 days and `TranslateUsage` rows past the same 90-day retention as `AiUsage`.

**Consequences.** New infrastructure, deliberately minimal: no external queue, no long-running worker. It amends ADR-078's "no queue" for this one workload. It needs one crontab line (`*/5 * * * * /srv/mbx/cron.sh translate`) and a `docs/ops/cron.md` row; like the other routes it answers 503 until `CRON_SECRET` is set.

---

## 3. Translation semantics (single source of truth)

Uses the **existing** enum; no `origin` column. **The machine writes only to an absent row or a `MACHINE_TRANSLATED` row. Every other state belongs to a human.**

| State                | Meaning                                     | Machine may overwrite? | Prose indexable?                                         |
| -------------------- | ------------------------------------------- | ---------------------- | -------------------------------------------------------- |
| (no row)             | Never translated                            | Yes (creates it)       | — (notice shown)                                         |
| `MACHINE_TRANSLATED` | Written by Google, not yet saved by a human | **Yes**                | No (`noindex`)                                           |
| `TRANSLATED`         | Saved by a human                            | No                     | Yes                                                      |
| `OUTDATED`           | Human row whose English source changed      | No (review queue)      | Yes (stale but human-approved)                           |
| `NEEDS_REVIEW`       | Human flagged it                            | No                     | Yes                                                      |
| `DRAFT`              | Human work in progress / duplicated copy    | No                     | Yes on the locale path; excluded from `?lang=` (ADR-127) |

**Sync algorithm** (per entity × locale, run by the job):

1. No row → Google translates → `MACHINE_TRANSLATED`, store `sourceHash`.
2. Row exists, hash matches → nothing to do.
3. Hash mismatch + `MACHINE_TRANSLATED` → re-translate, overwrite, stay `MACHINE_TRANSLATED`, update hash.
4. Hash mismatch + `TRANSLATED` → set `OUTDATED`, **do not touch content**.
5. Hash **null** (unknown) + human-owned state → treat as a mismatch: `TRANSLATED` becomes `OUTDATED`. Hash null + `MACHINE_TRANSLATED` → re-translate. (See §4.1 — existing rows are not given a fresh hash.)
6. Human saves → `TRANSLATED`, hash set from the current source.
7. **Retranslate** button in the editor (behind `ConfirmDialog`, code-style.md #7) runs Google on demand for the open form and **fills the form only**. Nothing is written until the admin saves, which writes `TRANSLATED`. If the admin navigates away, the row is unchanged.

**Editor flow.** Switching the language dropdown loads the translation row. If none exists yet (draft source, or job still pending), `POST /keystone/api/translate/prefill` runs the current source fields through Google and fills the form, so the dropdown never shows empty fields. The route: `requirePermission("translations.update")` first, parsed through a `@repo/contracts` schema, rate-limited per user (20/min), checked against the monthly character budget, metered in `TranslateUsage`. It returns text; it writes nothing. The AI actions from ADR-C §6 then sit on each field. Save → `TRANSLATED`, audited.

---

## 4. Coverage: gaps to close

### 4.1 Schema pass (add `sourceHash` and/or `translationStatus`)

| Table                                             | Missing             |
| ------------------------------------------------- | ------------------- |
| CourseTranslation                                 | sourceHash          |
| CourseSectionTranslation                          | sourceHash + status |
| QuizQuestionTranslation                           | sourceHash + status |
| VideoCategoryTranslation                          | sourceHash          |
| GlossaryTopicTranslation                          | sourceHash + status |
| MenuItemTranslation                               | sourceHash + status |
| ArticleCategoryTranslation, ArticleTagTranslation | sourceHash + status |

**Existing rows are NOT given a fresh hash.** Computing `sourceHash` from today's source would mark every existing translation as up to date, including ones already stale. New columns stay `NULL`; §3 rule 5 treats null as unknown, so existing human rows surface as `OUTDATED` for one review pass and existing machine rows are re-translated.

New status columns default to `TRANSLATED` for existing non-English rows (they were written by humans or the seed) and `MACHINE_TRANSLATED` for rows the jobs create.

### 4.2 New translation coverage

| Item                                                                              | Approach                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LessonAttachment.label`                                                          | `LessonTranslation.attachmentLabels` (JSON, English label → translation), not a table: attachments are recreated on every save (ADR-161 #8)                                                                                                                                                                               |
| `VideoTopicLink.label`                                                            | `VideoTopicTranslation.linkLabels`, same shape and reason (ADR-161 #8)                                                                                                                                                                                                                                                    |
| `SocialLink.label`                                                                | **not translated**: brand names (ADR-161 #9)                                                                                                                                                                                                                                                                              |
| `Quiz.category` (free text)                                                       | open item 2 (§7)                                                                                                                                                                                                                                                                                                          |
| Code-registry text (`SUPPORT_FAQ`, `support-facts.ts`, `home-facts.ts` — ADR-113) | the display sentences move to catalog keys so the catalog script covers them. **This amends ADR-113's "FAQ answers live in code, not the catalog" and needs its own paragraph in ADR-A**; figures (the $10 minimum, 1:100 leverage) stay in the facts file and are interpolated, so a translation cannot change a number. |
| `Setting.isTranslatable`                                                          | implement reads for it; mark the genuinely translatable settings; registered address and company registration stay single-language (ADR-110)                                                                                                                                                                              |
| Legal documents (PDFs)                                                            | out of MT scope; per-locale upload slots, falling back to the English PDF with a note (ADR-B exception)                                                                                                                                                                                                                   |
| `MarketInstrument.displayName`, `VideoTopicVideo.title`                           | intentionally untranslated (ADR-068 §4); unchanged                                                                                                                                                                                                                                                                        |

### 4.3 Correctness items

- **Rich text.** Article and lesson bodies are sanitized HTML. Pipeline: **glossary substitution** → Google `text/html` → strip the protective wrappers → `sanitizeRichText` → save.
  - _Glossary substitution:_ for each glossary term that has a **human-saved** translation in the target locale, replace the English term in the body with `<span translate="no">{translated term}</span>` before sending. Google leaves it as is, so the article uses the same Arabic term as the glossary. Terms with no human translation are left for Google. Wrapping the _English_ term instead would leave English words inside Arabic text.
  - The editor's `ed-*` classes and allowed attributes must survive the round trip: covered by a fixture test over the XSS/sanitizer corpus.
- **Numbers and risk figures.** A post-translation check compares the set of numbers (`10`, `1:100`, `70%`) in source and target and flags a mismatch into the review queue as `NEEDS_REVIEW` rather than publishing silently. Cheap, and it catches the forex-specific failure mode.
- **Structured JSON.** `Tool.faq` / `Tool.highlights` (icon fields untouched), `Tool.config` user-facing labels (audit first), quiz `options`. **The quiz translator must preserve option ids and order exactly**: `correctAnswer` points into that array. Translate values only, never keys or ids; a unit test asserts id/order invariance.
- **Search.** `packages/core/src/search.ts` hard-codes `locale: "en"`. Make it locale-aware or `/ar` search silently returns English or nothing.
- **hreflang.** Alternates only for locales with an existing, indexable translation (ADR-A #2).
- **Removed from scope** (don't exist): page-builder sections, banners, testimonials, footer blocks (ADR-042 cancelled the builder). Static coded pages (Home, Support, Tools index, Sitemap) are covered by the catalog script.

### 4.4 Message catalogs & locale activation

**962** public keys (about 29,600 characters of English) are missing from `ar.json`, measured by the Phase 1 script's `--dry-run` on 2026-09-25. CI blocks activation until the catalog is complete, and an inactive locale 404s by design (ADR-091).

**Catalog-fill script** (`scripts/translate-catalog.ts`, dev-run, uses `@repo/translate`'s driver):

- Parses every message with `@formatjs/icu-messageformat-parser` (new dev dependency, pinned in `docs/memory/stack.md`). Arguments (`{name}`), tags and `#` become `<x id="n"/>` placeholders and go through Google in HTML mode; only literal text is translated. The script fails if any placeholder is missing or duplicated after the round trip.
- **Plurals are rebuilt, not translated branch by branch.** English has `one` / `other`; Arabic needs `zero` / `one` / `two` / `few` / `many` / `other`. The script reads the target's categories from `new Intl.PluralRules(locale).resolvedOptions().pluralCategories`, fills each from the translated `other` branch, and writes the key to `scripts/translate-catalog.review.txt` for a human pass. Such keys are listed in the activation PR.
- Only public namespaces are filled (admin stays English, ADR-043).

**Activation flow per language** (one-time, dev-assisted):

1. Run the script → review the plural list and a sample of high-risk keys.
2. PR with `xx.json` + the `ENFORCED_LOCALES` addition (CI passes only if complete).
3. Merge and deploy.
4. The dashboard shows a **pre-flight estimate** (translatable characters × price) and the admin confirms.
5. Admin flips `isActive` → one `BACKFILL_LOCALE` job is enqueued → progress bar → notices disappear as batches complete.

Internal message: "adding a language" = one small PR, then everything else is automatic. It is not a pure admin toggle.

---

## 5. Permissions, audit and screens

| Surface                                                             | Permission                                                                                | Audit                               |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------- |
| Settings → Translation: provider credential, edition, price, budget | `translations.provider.manage` (new, super_admin only)                                    | credential and price changes        |
| Test connection                                                     | `translations.provider.manage`                                                            | yes                                 |
| Translation dashboard (counts, queue, failures, usage)              | `translations.view`                                                                       | —                                   |
| Sync buttons (locale / type / global), retry failed                 | `translations.approve`                                                                    | yes (one row per sync, not per job) |
| Editor prefill / Retranslate / Save                                 | `translations.update`                                                                     | on Save                             |
| AI Refine / Translate with AI                                       | `ai.use` + `translations.update`, and the feature available (ADR-097 absent-not-disabled) | via `AiUsage`                       |

The new key is added to the `translations` group in `PERMISSION_GROUPS` (code-style.md #11b). The dashboard lives under `/keystone/…` in the settings area's tab pattern (ADR-150), with a heading, a one-line description, and `DataTable` toolbars (ADR-044/106). Every new string is an `admin.translate.*` catalog key (English only), with the sidebar label under `admin.nav.*` (code-style.md #29).

---

## 6. Phase plan

**Phase 0 — ADRs.** ADR-159…162 plus the security.md #10 and architecture.md #8 amendments. **Done 2026-09-25.**

**Phase 1 — `@repo/translate` + settings + catalog script.**
Spike first (half a day) against Basic v2: confirm HTML mode (`format=html`) leaves `<span translate="no">` / `class="notranslate"` content untouched and preserves `ed-*` classes, confirm the per-request segment and size limits the batcher must respect, and confirm quota/error response shapes for the error taxonomy. Then the package: `TranslateProvider` + `TranslateUsage` tables, the sealed credential, `loadTranslateDriver()`, `translateText` / `translateHtml` (glossary substitution + wrap/strip) / `translateStructured` (per-type field maps), batching, backoff, metering, the monthly budget. Settings tab with Test connection. Catalog-fill script with ICU parsing and plural rebuild.
_Exit:_ a sample string, an HTML body with glossary terms, and the public namespaces of `ar.json` translate successfully; placeholder validation fails a deliberately broken message; cost appears in the usage view; package coverage ≥ 80%.

**Phase 2 — Schema pass.** Migrations for §4.1 (hash columns left `NULL`); new label translation tables (§4.2); `TranslationJob`.
_Exit:_ every translatable table has hash + status; Prisma types compile everywhere; `pnpm check:phantom-deps` green.

**Phase 3 — News end to end (proves the loop).** Enqueue on article save/status change; inline `after()` runner; conditional write (ADR-D #4); editor prefill + Retranslate; AI Refine/Translate actions; human Save → `TRANSLATED`; read-path unification + `noindex` for machine prose (ADR-A); sanitize pipeline and number check (§4.3); English-slug reuse (D7).
Test locale: `es` in the **dev and CI databases only**, catalog filled by the Phase 1 script. It is not activated in production in this phase.
_Exit:_ save an English article → it renders at `/es/news/…` after the inline run, `noindex`; edit the Spanish version → indexable; edit the English source → the Spanish machine copy refreshes, a human-edited copy becomes `OUTDATED`; an integration test saves a human edit **while a job is running** and asserts the job does not overwrite it.

**Phase 4 — Cron, backfill, dashboard.** `/api/cron/translate` with atomic claim and stale-lease recovery; crontab line + `docs/ops/cron.md`; locale-activation hook with pre-flight estimate; dashboard: per-locale counts (machine / human / outdated / failed), review queue, Sync buttons, progress bar, usage and budget.
_Exit:_ activating a test locale backfills all news content unattended; two concurrent cron calls never process the same job (integration test); failures retry with backoff and surface; hitting the budget pauses rather than fails.
**Done 2026-09-28 (ADR-163).** Activation lives on Settings → Translation → Languages behind `locales.manage`, and refuses a locale whose public catalog is incomplete at request time (CI's `ENFORCED_LOCALES` cannot see a runtime switch). Sync is per locale and global; per-TYPE sync is not built — there is one type until Phase 5, and a type is added to `TRANSLATABLE_TYPES` in `@repo/core`, which the backfill, the counts, the estimate and the review queue all read.

**Phase 5 — Remaining modules.** Courses/sections → lessons + attachment labels → videos/topics/links → glossary (first, of this group, if glossary substitution should use human terms early) → tools (JSON fields, config audit) → menus/categories/tags/social links → translatable settings → code-registry sentences → catalog keys. **Quizzes last**, with the id/order-invariance test in place first. Locale-aware search lands with the first content module of this phase.
_Exit:_ dashboard shows full coverage per module; quiz scoring test green in all locales.
**Done 2026-09-28 (ADR-164)**, one engine for every module. Deferred, with reasons in ADR-164 #9: **translatable settings** (no model; `getSetting` has no locale) — a prerequisite for Phase 6 activating an RTL locale — `Tool.config` session names, `Quiz.category`, per-type Sync. "Locale-aware search" was already true of public search; the `en` in `search.ts` is the admin palette, which stays English (ADR-043).

**Prerequisite done 2026-09-28 (ADR-165): translatable settings.** Six keys; the `legal` group is human-only and activation refuses a language whose disclaimer and copyright line a person has not translated (Settings → Translation → Site text). So the activation flow below gains a step before `isActive`: write those two in the new language.

**Phase 6 — Activation.** Catalog script for ar (and ur when wanted) → activation PR → pre-flight estimate → `isActive` → backfill → review pass over high-risk prose (risk wording, leverage figures, anything the number check flagged) → hreflang and sitemaps verified (only indexable translations listed) → RTL smoke + axe on `/ar` (testing.md #4) → switcher live for the new locale.

Each phase closes with its DEVLOG entry and test results (testing.md #6).

---

## 7. Open items to confirm during Phase 0

1. Which locale is the first real target after the `es` test: ar or ur? (Affects RTL QA scheduling.) — **decided 2026-09-28: Arabic (ADR-166).** Its catalog was written in the development session, not by the script; `ar` is in `ENFORCED_LOCALES`.
2. `Quiz.category`: translate the free text, or normalize it into a category entity first?
3. Legal PDFs: commission human translations per locale, or ship English-only with the note?
4. ~~Cloud Translation edition~~ — **decided 2026-09-25: Basic (v2), API key** (ADR-C #4).
5. Monthly character budget: the starting value (the ar backfill estimate from Phase 1 is the input).
