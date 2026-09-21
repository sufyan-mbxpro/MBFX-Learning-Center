# ADR-133: A glossary topic has a cover image

**Status:** Accepted
**Date:** 2026-09-17
**Module:** 11 (content), 12 (public site)
**Plan:** `docs/changes/changes-39-fixeing.md`
**Supersedes:** the comment on the topic page (changes-22) that "a topic has no
cover column and is never getting one". ADR-132 already made the same reversal
for quizzes.
**Superseded by:** —

## Context

The owner asked for a cover image option on the glossary topic editor, visible
on the public site. Courses, video topics, tools and (since ADR-132) quizzes
already have one. The topic editor was the last content editor without one.

## Decision

1. **`GlossaryTopic.coverAssetId String?`** holds a MediaAsset id, the same
   plain-String column ADR-132 uses (MediaAsset carries no back-relations,
   ADR-035). It is on the topic row, not the translation, so the picture is
   shared across languages and saves with any locale's Save.
2. **The cover is a `ContentReference`** under a new
   `ReferenceSourceType.GLOSSARY_TOPIC`, written in the same transaction as
   `saveGlossaryTopic`. `deleteMedia()`'s in-use guard then protects the asset.
   `duplicateGlossaryTopic` copies the cover and writes the copy its own
   reference. **A topic is HARD-deleted, unlike a quiz**, so
   `deleteGlossaryTopic` clears the reference in the same transaction. A
   leftover reference would otherwise hold the asset "in use" forever.
   `mediaSourceTypeSchema` gains the member, kept in step by the drift guard
   in `media.test.ts`.
3. **The glossary's topic artwork is the fallback.** `TopicCover` renders the
   upload when it resolves, and otherwise `GLOSSARY_MEDIA.topicsBanner`. A
   deleted asset resolves to null in the loader and falls back too.
4. **Where it shows:** a 16:9 media box on every card on `/glossary/topics`
   (every card gets the box, so a mixed grid stays one height), and the
   backdrop of the topic page's masthead. That masthead becomes the compact
   `PageHero` the term page uses. Its rich description moves into the body,
   because a hero's lead is a single `<p>`.

## Consequences

- One migration: `20260917233000_glossary_topic_cover_adr133` (a nullable
  column and one enum member).
- No permission key is added. The cover saves through
  `saveGlossaryTopicAction` under `glossary.update`.
