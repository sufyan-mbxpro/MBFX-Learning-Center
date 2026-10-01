# ADR-160 — Google Cloud Translation is the automatic translator: `@repo/translate` and the fifth sealed secret

- **Status:** Accepted
- **Date:** 2026-09-25
- **Module:** 06 (i18n), 09 (admin settings), 18 (AI platform)
- **Plan:** `docs/changes/multilingual-automation-plan.md` (revision 2),
  owner decisions of 2026-09-25: Google is the default translator; AI is a
  manual assist on top of it; the edition is **Cloud Translation Basic (v2)**.
- **Amends:** security.md #10 (a fifth exception), architecture.md #8 (a new
  package and two dependency edges), ADR-097 #4's scope note (see #7: AI
  still never writes to the database).

## Context

Every save of English content, and every backfill when a language is
switched on, needs translating without a person present. The owner chose
Google Cloud Translation for that work, configurable from the admin without
a deploy, and kept AI for a person to use by hand.

security.md #10 asks four things of a new database-stored secret: why it
cannot live in env, its single reader, its gate justified by blast radius,
and why none of the existing seals already covers it. There are four seals
today (SMTP, market data, AI provider, reCAPTCHA), and the rule's own last
line says that past three a pattern starts looking like a default. This ADR
has to clear that bar, not lean on it.

## Decision

1. **A new domain package, `@repo/translate`.** It owns the provider row,
   the usage table, the job table (ADR-162) and the pipeline (text, HTML,
   structured JSON). It depends on `db / contracts / secrets` — no
   `settings`: its price and budget live on its own provider row (#6).
   New edges: `core → translate`, `translate → secrets`. `auth` never imports
   it, for the reason `@repo/ai` gave: the session path must not acquire a
   dependency that spends money. It sits BESIDE `@repo/ai`, not inside it.
2. **Why not the existing AI seal.** `AiProvider` models chat-completion
   vendors: a model table priced per token, a tier resolver, a driver
   speaking a messages API. Cloud Translation has none of those — a fixed
   endpoint, billed per character, no model to choose. An `AiProvider` row
   would put a non-chat vendor in the AI model picker, give it token prices it
   does not have, and meter it in `AiUsage` columns that count the wrong unit.
   `AiProviderKind.GOOGLE` already means Gemini, which makes the collision
   concrete rather than theoretical.
3. **Why not env.** The owner asked for admin configuration without a deploy,
   as the AI and market keys have. The master key, `TRANSLATE_SECRET_KEY`,
   stays in env like every other seal's.
4. **Storage and the one reader.** `TranslateProvider`, a singleton
   (`id = "default"`), holds `apiKeyCipher`: AES-256-GCM through
   `@repo/secrets` under `TRANSLATE_SECRET_KEY`, write-only in the UI.
   `loadTranslateDriver()` is its only reader; `TranslateProviderView` has no
   key property. The edition is **Basic (v2)**, so the credential is an API
   key. The driver sends it in the `X-goog-api-key` header, never as the
   `?key=` parameter, so it cannot land in an access log or an error trace.
   The settings screen tells the admin to restrict the key in Google Cloud
   Console to the Cloud Translation API, and to the server's address where
   the hosting allows it.
5. **Gate by blast radius.** The endpoint is fixed in code. There is no base
   URL setting, so unlike the AI key a changed setting cannot send the
   site's content to someone else's host. What is left is spend: a misused
   key translates at the site's cost. The gate is a new key,
   **`translations.provider.manage`**, seeded to **super_admin only** — a key
   rather than a role test, so a later grant is an ADR, as with
   `ai.providers.manage`. Reading usage takes `translations.view`.
6. **Metering and a budget.** `TranslateUsage` records characters, locale,
   entity, status and a cost **frozen at write time** from an admin-editable
   price per million characters (ADR-100 #3). Every figure says "estimated"
   (ADR-100). The price and the monthly character budget are COLUMNS on
   `TranslateProvider` (`pricePerMillionChars`, `monthlyCharBudget`), not
   registry settings: they are edited in the same form as the key, under the
   same super_admin-only key, and a second home for them would be a second
   place to forget. At the cap work pauses: it stays pending and does not
   fail, and the screen says why. The price defaults to Google's published
   Basic list rate ($20 per million), to be checked on the day it is set.
7. **AI is the manual layer, and gets no new feature key.** The existing
   `translation` feature (light tier) gains an optional `drafts` map on
   `translationPayloadSchema`, keyed like `fields`. A field with a draft is
   refined against the source (a correct sentence is kept, not churned); a
   field without one is translated from scratch.
   The editor offers "Refine with AI" and "Translate with AI" per ADR-138: the
   rich-text toolbar for rich fields, `AiFieldMenu` for plain ones. The result
   fills the form and a person's Save writes it, so ADR-097 #4 (AI never
   writes to the database) is unchanged. AI calls stay in `AiUsage` under the
   AI budget; Google calls are metered only in `TranslateUsage`.
8. **A number check.** After every machine translation, the set of numbers
   in the source (`10`, `1:100`, `70%`) is compared with the target's. A
   mismatch marks the row `NEEDS_REVIEW`, which is human-owned (ADR-161 #2),
   so it is not overwritten and appears in the review queue. This is the
   forex-specific failure mode, and it costs nothing to check.
9. **Glossary consistency without Google glossaries.** Basic has no glossary
   resource. Before an HTML body is sent, each glossary term that has a
   human-saved translation in the target language is replaced by that
   translation inside `<span translate="no">`, and the wrapper is stripped
   before `sanitizeRichText`. The body then uses the glossary's own word.
10. **Test connection.** Translates one fixed sample string and reports
    success, bad key, quota, or unreachable, from a machine-readable taxonomy
    — never the provider's own message. `requirePermission` first; changing
    the key or the price writes an audit row.
11. **No env fallback, and an unreadable seal switches it off.** One source of
    truth, as with the other four. If the seal cannot be opened, automatic
    translation pauses and the dashboard says it is not configured. It does
    not fail every job.

## Consequences

- security.md #10 gains a fifth paragraph and architecture.md #8 a new one,
  in the same change as this ADR.
- New env variable `TRANSLATE_SECRET_KEY` in `.env.example` (name only) and
  in the deploy README.
- Moving to Advanced (v3) later changes the stored secret's shape (a service
  account instead of a key), so it needs its own ADR.
- Before the first backfill of a language, the dashboard shows its estimated
  character count and cost, and a person confirms.

## Alternatives rejected

- **AI as the automatic translator.** Already built and metered, and no new
  secret. Rejected by the owner: Google's per-character output is cheaper at
  backfill volume and does not vary run to run. AI stays for a person who
  wants a better sentence.
- **A Google row in `AiProvider`.** See #2.
- **Advanced (v3).** Glossary resources and a service-account credential.
  Not needed while #9 covers the glossary, and a service account is a larger
  secret to hold.
- **Env-only key.** Rotation would need a deploy, against the owner's
  requirement.
