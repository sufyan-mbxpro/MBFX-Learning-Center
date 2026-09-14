# ADR-093 — Two new homepage bands: the quote, and the connect row

- **Status:** Accepted
- **Date:** 2026-09-14
- **Module:** 12 (public site), 08 (navigation — the social rows)
- **Supersedes:** nothing. **Extends:** ADR-042 (site design is code) and
  ADR-047 §3 (a surface renders complete without a claim it cannot back).

## Context

changes-28's brief asks for two things the homepage does not have: a quotation
band at the foot of the page (images 48 and 53) and a "follow us for the latest
analysis, views and breaking news" band with social links and a video panel
(image 51).

Both are reference screenshots from another trading site, and both carry a
claim this site cannot make as drawn. The reference's connect band embeds a
named analyst's livestream and its button reads "view all interactive
livestreams" — this site has no livestreams, changes-23 is unbuilt, and the
`/analysis` area is the nearest thing that exists. A quotation, likewise, is a
factual claim about a person: it says a named human said these words.

## Decision

**1. Both are coded sections with a seeded on/off row** — the shape every
homepage band has taken since changes-03. `connect` at order 14, `quotes` at
order 17 above the risk disclaimer. Composition is code (ADR-042); there is no
composer and no layout setting behind either.

**2. `quotes` carries a code registry of keys and a catalog of words.**
`_content/home-quotes.ts` holds which quotes and in what order; the TEXT is a
catalog key derived from the entry's `key`, so the band translates like
everything else under `app/(public)/**` (ADR-043 #1).

**3. The ATTRIBUTION is not a catalog key.** A person's name is not translated.
Routing it through a catalog would invite a translator to render "Albert
Einstein" phonetically in Arabic or Urdu, which is a different claim about a
different person. The words are translated; the name is data. The dash before
it IS a catalog key (`quoteAttribution`, `"— {author}"`) — punctuation around a
name is a typographic decision, and not the same mark in every script.

**4. Every quote is a documented attribution, and none is attributed to anyone
connected with this site.** ADR-047 §3 applies to a quotation exactly as it
applies to a video URL. A "what our traders say" testimonial band would be the
other thing entirely and is not this: it would need real people who really said
it, which is content, not composition.

**5. The day's quote is deterministic, with no cron and no column.** The
`term-of-the-day` technique (D29): the UTC day number modulo the list. A random
pick would differ between the server render and any later revalidation of the
same cached page — a "quote of the day" would become a quote of the request,
and two readers on the same date would see different ones. UTC deliberately:
the page is cached and shared across time zones, so there is no "the visitor's
today" to read.

**6. `connect` renders real `SocialLink` rows, and nothing when there are
none.** The same `getActiveSocialLinks` the footer reads, in the admin's own
`sortOrder`. A "follow us" heading over an empty row invites a visitor to
follow nobody, so the whole band returns null. `SocialLinkIcon` — the
uploaded-asset-beats-built-in-glyph rule from ADR-045 — moves out of
`footer.tsx` into `_components/social-link-icon.tsx` rather than being copied:
a fallback rule that exists twice is a fallback rule that will be fixed once.

**7. The livestream is not copied.** The panel beside the copy is the newest
published video topic (ADR-092's reader, limit 1) — a real recording when one
exists, the topic's own written guide when it does not, and absent when there
are no topics. The button points at `/analysis`, which is what the heading
above it actually promises and is a route that renders.

**8. `connect` declares no variant vocabulary.** It has one shape; what varies
is which social rows an admin has activated. It is therefore ABSENT from
`HOME_SECTION_VARIANTS` rather than present with an empty list — an empty list
rejects every variant while looking like it configures something, which is the
case `settings.test.ts` has pinned since changes-03. `risk_disclaimer` is the
precedent: a built band with no vocabulary. `quotes` declares `single` and
`carousel`.

**9. Both bands paint with existing tokens only.** `connect` is
`tone="inverted"` with the same ambient wash and dot grid the video rail and
the footer use, so the three inverted bands read as one surface treatment
rather than three. The quote band is `tone="muted"` with the wash alone — a
quote is the quietest thing on the page and a card would make it the loudest.
Neither section's headings use `SectionHeading`, for the reason the video rail
records: that component's eyebrow and lead are coloured for `--background`, not
for the `--secondary` band these sections paint.

## Consequences

- A fresh database shows the connect band only after an admin activates a
  social link. The seed writes social rows, so a seeded install shows it.
- The quote band walks its whole list before repeating, so the homepage is
  visibly different across a week without any editorial work.
- Quotes are the first user-facing copy on this site that is code-owned prose
  rather than either a catalog string describing our own UI or admin-entered
  content. Adding one means a registry entry plus a catalog key — a code
  change, deliberately: the attribution has to be checked by someone.
- Two more bands is two more reasons the homepage is long. ADR-095's streaming
  is what keeps that from being a load-time cost.
