# ADR-045: Social link icons — a built-in glyph set in `@repo/ui`, with an admin-uploaded override

**Status:** Accepted
**Date:** 2026-09-07
**Module:** 08 (navigation / header & footer runtime), 09 (admin), 01 (schema)
**Supersedes:** —
**Superseded by:** —

## Context

`SocialLink.icon` was documented as "lucide name or uploaded asset key" and
seeded with `instagram`, `facebook`, `youtube`, `linkedin`, `twitter`. The
public footer resolved it by indexing the `lucide-react` namespace by
PascalCase name and rendering `null` when the lookup missed.

**`lucide-react` v1 removed every brand icon.** Verified against the
installed 1.38.0 declarations: `Instagram`, `Facebook`, `Youtube`,
`Linkedin` and `Twitter` are all gone. So every seeded social link had been
resolving to `undefined` and rendering nothing — five empty circles in the
footer, with no error, no warning and no failing test. The `?? null`
fallback that was meant to be defensive is what made the breakage silent.

The owner's request (changes-08) — "the social links there should be icons
upload option .. also add the default icons in seeders as well .. that
icons should be display on the public site footer" — is describing this
symptom. Seeding different data would not have fixed it: the names were
already there and had simply stopped resolving to anything.

Two things are needed, and they are different: **defaults that work with no
admin action**, and **an override the admin controls**.

## Decision

### 1. A built-in glyph set, owned by `@repo/ui`

`packages/ui/src/components/social-glyph.tsx` carries a monochrome
`currentColor` mark per platform — instagram, facebook, youtube, linkedin,
x, tiktok, telegram, whatsapp, plus a generic `link`. The marks are
composed from SVG primitives (`rect` / `circle` / `path`), not traced from
vendor artwork, and identify the destination of a link.

Depending on `lucide-react` for brand marks is what broke; a set we own
cannot be removed by a dependency's editorial decision.

### 2. An unresolvable name renders the link mark, never nothing

`resolveSocialGlyph()` maps an unknown or empty name to `link`. This is the
rule the whole ADR exists to enforce: **a social icon can be wrong, but it
can never be invisible.** A missing key is now a generic chain-link glyph
the admin can see and fix, not a blank circle nobody notices.

It also aliases legacy stored values, `twitter` → `x` chief among them, so
a database seeded before this change keeps rendering without a data
migration.

### 3. `SocialLink.iconUrl` — the admin's own artwork, which wins

A new nullable column (`VARCHAR(500)`, migration
`20260907050846_social_link_icon_url`). Resolution order at render time:

1. `iconUrl` — an uploaded asset. Wins whenever it is set.
2. `icon` — the built-in glyph key.
3. the `link` glyph.

`icon` and `iconUrl` are stored side by side rather than one field holding
both, so clearing an upload falls back to a working glyph instead of to
nothing. The upload goes through the existing widget and the existing
pipeline (`ImageUploadField` → `/admin/api/uploads/image` → `storeImage()`,
ADR-017) — no new transport, no new validation.

### 4. `iconUrl` is a relative path, enforced in contracts

`socialLinkIconUrlSchema` rejects anything that is not a same-origin
relative path. A leading `/` alone is insufficient: `//evil.example/x` is
protocol-relative and `/\evil.example/x` is treated the same way by
browsers, so the second character must be neither slash.

The widget only ever submits what `storeImage()` returned, so this changes
nothing for the UI — it exists so that a hand-crafted form post cannot turn
a footer icon on every public page into a third-party request. Same posture
as security.md #9.

### 5. The seed names glyphs; it does not overwrite them

`SOCIAL_LINKS` seeds `icon` per platform (`x` now names `x`, not
`twitter`). The seed's `update` branch deliberately does NOT touch `icon`
or `iconUrl` — those are admin-editable now, and Module 01's rule is that a
re-seed never overwrites an admin's own choice. Existing rows therefore
keep `twitter` and render correctly via the alias; fresh databases get `x`.

## Consequences

- The footer renders real icons out of the box, on a fresh seed and on an
  existing database, with no admin action.
- Adding a platform is a key in `social-glyph.tsx` plus a seed row. Adding
  one WITHOUT a glyph is also fine — it draws the link mark.
- `@repo/ui` gains no dependency. The glyph set is plain SVG.
- The header still renders no social row (`showInHeader` has no consumer).
  This ADR does not add one — that is a design decision for whichever
  module builds the header's utility bar.
- App-store badge artwork remains out of the repo, unchanged: those are
  raster trademark assets under vendor usage rules, which is a different
  question from a monochrome identifying glyph.
