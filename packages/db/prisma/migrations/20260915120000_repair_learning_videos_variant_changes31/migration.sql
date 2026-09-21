-- changes-31: repair the `learning_videos` entry in an existing `home.sections`.
--
-- A DATA migration, not a schema one. changes-31 narrowed
-- `HOME_SECTION_VARIANTS.learning_videos` from `["carousel", "grid"]` to
-- `["grid"]`, because the rail left the homepage and `/learn` has always asked
-- for the grid. Every database seeded before that change still holds
-- `{ key: "learning_videos", enabled: true, variant: "carousel" }`, and the
-- seed cannot fix it: `home.sections` is written with an upsert whose `update`
-- deliberately never touches `value` ("never overwrite a value an admin has
-- already changed"), so `pnpm db:seed` is a no-op here and only `db:reset`
-- — which discards all content — would clear it.
--
-- Left alone the row is not a cosmetic drift, it is a 500 on every public
-- page. `loadSetting` parses strictly and THROWS on a row that fails its own
-- schema (@repo/settings, by design: a wrong-shaped value is a data-integrity
-- bug, not a missing optional). So the stale `carousel` fails
-- `homeSectionSchema.superRefine` and the read never returns:
--
--   ZodError: Unknown variant "carousel" for section "learning_videos".
--             Allowed: grid.
--
-- `VideoShowcase`'s own `if (variant !== "grid") return null` guard was
-- written for exactly this stale row, but it can never run — the setting
-- throws one layer above it, in the reader. That is why the fix is here and
-- not in the component.
--
-- Both fields are rewritten, and the second is the load-bearing one. Setting
-- `variant` to `grid` alone makes the row PARSE and the guard pass, which
-- would put the video rail back on the homepage — the band the owner asked to
-- remove on 2026-09-15. `enabled: false` is what actually keeps it off, and it
-- matches what the seed now writes for a fresh install.
--
-- Deliberately surgical: the rest of the stored composition is the admin's
-- data and is untouched. In particular this does NOT add changes-31's three
-- new bands (`trust_strip`, `facts`, `testimonials`) — homepage rows are
-- create-only and an existing database needs `pnpm db:reset` to see them,
-- which is the decision recorded in the seed, not an oversight here. This
-- migration repairs what CRASHES; it does not re-compose someone's homepage.
--
-- Idempotent and self-skipping: the `WHERE` matches only a row whose
-- `learning_videos` entry exists and is not already `grid`, so a freshly
-- seeded database is a no-op.
UPDATE `settings`
SET `value` = JSON_SET(
      JSON_SET(
        `value`,
        REPLACE(
          JSON_UNQUOTE(JSON_SEARCH(`value`, 'one', 'learning_videos', NULL, '$[*].key')),
          '.key',
          '.variant'
        ),
        'grid'
      ),
      REPLACE(
        JSON_UNQUOTE(JSON_SEARCH(`value`, 'one', 'learning_videos', NULL, '$[*].key')),
        '.key',
        '.enabled'
      ),
      FALSE
    )
WHERE `key` = 'home.sections'
  AND JSON_SEARCH(`value`, 'one', 'learning_videos', NULL, '$[*].key') IS NOT NULL
  AND JSON_UNQUOTE(
        JSON_EXTRACT(
          `value`,
          REPLACE(
            JSON_UNQUOTE(JSON_SEARCH(`value`, 'one', 'learning_videos', NULL, '$[*].key')),
            '.key',
            '.variant'
          )
        )
      ) <> 'grid';
