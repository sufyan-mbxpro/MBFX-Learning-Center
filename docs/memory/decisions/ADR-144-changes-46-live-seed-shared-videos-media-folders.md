# ADR-144 — changes-46: a live-server seed, videos shared across schools, media in folders, and two admin screens removed

- **Status:** Accepted
- **Date:** 2026-09-20
- **Module:** 01 (`@repo/db`), 05 (settings + flags), 09 (admin shell), 11 (content), 13 (tools), 17 (email)
- **Plan:** owner request, `docs/changes/changes-46-fixing.md`
- **Amends:** ADR-068 §1 (a video topic still has exactly one canonical
  track, but may also be LISTED under the other school); ADR-066/067 (a
  category is now also a physical storage prefix, not only a `folder` column);
  the seed-media rule several seed comments state ("no seeded `MediaAsset`
  rows") — for the new live seed only, never for `pnpm db:seed`.
- **Does not change:** security.md #10. No key is ever committed.

## Context

The owner sent some thirty notes. Most of them are fixes to a screen. Five
change a standing rule:

1. The owner asks for a "seeder for the live server" that brings a fresh
   install up complete in one step. That means courses, quizzes, videos,
   glossary, tool FAQs, the current theme, brand and settings, and the
   market and AI keys, with the owner's images attached. The existing seed
   deliberately creates no `MediaAsset` rows. Its reason is that the storage
   root is git-ignored, so a seeded row would point at bytes nobody checked
   out.
2. "Add or show a video on both forex & crypto". ADR-068 §1 made a topic's
   track REQUIRED because the track is its URL segment.
3. "For news there should be a separate folder, for courses a separate
   folder". Today a category is only the `folder` column. Every object key
   is flat.
4. "Check the video uploading & their compression". Nothing compresses a
   video today, and the repo has no transcoder.
5. "Remove /admin/features and /admin/settings/articles, allow anything
   attached to these settings".

## Decision

### 1. The live seed is a separate command that brings its own bytes

- `pnpm db:seed` is unchanged in what it guarantees. It creates no media
  rows and stays safe on a clean checkout.
- A new `pnpm seed:live` runs AFTER it. It lives in a package that may import
  `@repo/core`, so every image enters storage through `storeMedia()`. That
  keeps security.md #9 intact: the bytes are magic-byte sniffed and
  optimised like any upload. The images are committed, already optimised, under a seed-media
  folder. The seed does not read `apps/web/storage`, because that root is
  per-machine and git-ignored.
- It is idempotent. A row it already created (found by a stable key) is left
  alone. An admin's edit survives a second run.
- **Content is written in our own words.** The babypips pages the owner
  linked are a guide to the SHAPE and topics only. Their text is not copied.
  Every quiz answer is checked to be factually right.
- **Keys come from the environment at seed time, never from the repo.**
  `SEED_MARKET_PROVIDER_*`, `SEED_AI_PROVIDER_*` and `SEED_SMTP_*` are read
  once. The seed seals them through the existing seal (`@repo/secrets`) into
  the three sanctioned columns (security.md #10). A missing variable means
  that provider is not configured. It is never an error. `.env.example` lists
  the names only.
- The current theme, brand colours and non-secret settings are exported from
  a running install into a committed JSON file by an explicit export command.
  The live seed applies that file. The file holds no secret setting: the
  exporter refuses every key a sealed column owns.

### 2. A video topic can be listed under both schools

- `VideoTopic.track` stays REQUIRED and stays the canonical URL segment.
  ADR-068 §1's reason is unchanged: one page has one address.
- A new `VideoTopic.showOnAllTracks Boolean @default(false)` lists the topic
  on every school's video index and category pages as well. Those listings
  LINK TO THE CANONICAL URL. A request for the topic under the other track
  still 404s, exactly as a course loaded under the wrong track does
  (ADR-065).
- Category creation from the topic editor is inline, through the existing
  save-category action and its permission. The page is not reloaded.

### 3. A media category is a storage prefix

- New object keys are `<category>/<random>.<ext>`, with the category from
  `MEDIA_CATEGORIES`. So on the local driver, news uploads land in
  `storage/uploads/news/` and course uploads in `storage/uploads/learn/`.
- The serving route becomes a catch-all. It serves both the new prefixed keys
  and every existing flat key, and existing URLs do not move. The key pattern
  still admits no `..`, no leading slash and no segment outside the registry.

### 4. Video compression is optional and runs on the server's own ffmpeg

- No npm transcoder is added. A binary package needs an install script,
  which `onlyBuiltDependencies` exists to refuse (security.md #15).
- When `FFMPEG_PATH` is set, an uploaded video is re-encoded to H.264/AAC MP4
  with `+faststart` before it is stored. It is kept only if the result is
  smaller. Any failure stores the original, so compression can never fail an
  upload.
- Unset, behaviour is exactly today's. The per-kind size cap in Settings →
  Media is the only limit.

### 5. The feature-flag screen and the articles settings screen are removed

- `/admin/features` and the `articles` group under `/admin/settings` are
  deleted, and so are their navigation entries.
- Every flag a page reads is set ON by
  `20260920090000_all_flags_on_changes46`. Five flags are read by no code:
  `comments`, `forums`, `watchlists`, `currency_strength` and
  `user_accounts`. They are deleted from the seed and from existing
  databases, per code-style.md #28. They can be removed unconditionally
  because nothing can read them.
- The four `articles.*` settings keep their seeded values and are still read.
  Changing them is now a seed or code change, like the other layout decisions
  ADR-042 made static.
- The `settings.flags.*` permission keys stay seeded. Removing a key is
  checked against every role, which is its own change.

### 6. Two rules settled during implementation

- **Email templates get the writing assistant on `email.templates.update`.**
  `api/ai/run`'s writing-assistant permission list gains that key. This
  follows ADR-126's rule that the key which saves a surface governs AI on it.
  `ai.use` is still required as well.
- **Changing a person's email needs a strictly higher role.** Re-addressing
  an account redirects its password-reset link. So `adminUpdateUser` refuses
  an email change unless the actor's highest role level is strictly above
  the target's (`EmailChangeForbiddenError`), which is `canAssignRole`'s
  `<` (security.md #4). The address comes back unverified unless the admin
  vouches for it. Sessions are kept, because the login account is keyed by
  user id.
- **The proxy buffers request bodies up to 110 MB**
  (`experimental.proxyClientMaxBodySize`). Every `/admin/*` request passes
  through `proxy.ts`, and Next's 10 MB default cut off every upload above
  it, including uploads within the 100 MB video cap. Raise it together with
  that cap.

## Consequences

- A production install is: `db:deploy` → `db:seed` → `seed:live`, then
  `next build` / `next start`. The runbook is `docs/ops/deploy.md`.
- The live seed has images and prose that go stale like any content, and an
  admin is expected to edit them. It is a starting corpus, not a fixture:
  no test depends on its wording.
- Two schools can show the same video topic, and a reader who follows it from
  the crypto index lands on a `/learn/forex/videos/...` address. The
  breadcrumb names the school the address belongs to.
