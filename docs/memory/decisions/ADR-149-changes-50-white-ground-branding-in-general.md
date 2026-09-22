# ADR-149 — changes-50: white ground, branding under General, presets that say which is live

- **Status:** Accepted
- **Date:** 2026-09-22
- **Module:** 02 (theme), 05 (settings), 09 (admin shell / theme editor), 11
  (content editors), 12 (public learn), 15 (articles)
- **Plan:** `docs/changes/changes-50.md` (owner request)
- **Amends:** ADR-101 §2/§4 (the ivory ground); ADR-148 (what "active" means
  for a preset); the theme editor's tab set (changes-02 Logos tab).
- **Does not change:** ADR-008 (mode is the user's); ADR-003 (derived
  states); ADR-094 (a staff session reads as anonymous on the public site —
  this ADR extends it rather than amending it); ADR-148's per-surface rows.

## Context

The owner's changes-50 list, as it touches decisions already recorded:

- "the built in theme have the white background by default..update the
  seeder & built-in theme cards for both"
- "when we set the preset then its show clearly selected active preset & also
  update the other tabs colors & branding & theme modes data"
- "the general settings page should be show in tabs … place the branding in
  the general under the tab remove from the theme settings"
- "what is use of social media & advance tab..if there is not use then remove"
- "why remove the join/sign in section to remember the progress in courses &
  quizzes"

## Decision

1. **The default light background is white (`#FFFFFF`)**, replacing ADR-101's
   ivory `#F7F3ED`. The rest of the warm ramp is unchanged: every ink and
   border was chosen to clear its threshold on the ivory, and white is
   lighter, so every ratio against the ground rises. A card separates from
   the page by its own border and `shadow-sm` (both already on `Card`) rather
   than by a step of ground. The seed's built-in preset follows through
   `@repo/theme` and `default-theme-tokens.json`; migration `20260922120000`
   moves the built-in preset and both surface rows, **bounded to rows still
   holding the seeded ivory**, so a background an admin chose survives.
2. **A preset is "active" for a surface when that surface's palette equals
   it** — brand colours, both modes and the dark overrides, compared by value.
   Since ADR-148 activation COPIES a preset onto the surface row, so the
   preset row's own `isActive` flag is false for every preset and said
   nothing. `loadThemePresets(surface)` computes it; the unscoped call keeps
   the stored flag. An edited palette matches no preset, and the Presets tab
   says "custom colours" rather than pretending. The editor is keyed by the
   palette, not the row, so activating a preset reloads every tab.
3. **Logos and the favicon are Settings → General → Branding.** General is
   tabbed (Site · Contact · Language & region · Security · Branding) from a
   code registry, `SETTINGS_GROUP_TABS`; a key no tab names falls on the
   first tab. The Branding tab keeps the uploads' own actions and their
   `theme.update` gate — a subject without it gets no Branding tab — and draws
   no Save, because each upload saves on its own. The theme editor's first
   tab is "Colors".
4. **The article SEO panel loses its Advanced tab and keeps Social.** Advanced
   restated the Basic tab's robots and canonical fields read-only. Social is
   not unused: the article page's Open Graph and X metadata read every field
   on it. It is renamed "Social sharing", says what it is for, and shows the
   card a shared link unfurls into, built from the page's own fallback chain.
5. **The progress island treats a staff session as a guest.** ADR-094 already
   shows staff as signed out on the public header; the progress endpoint still
   answered them with real progress, so an admin browsing the site saw "Sign
   in" in the header and no "Save your progress" card or "Track your progress"
   band anywhere. The provider now reports `guest` (and no view) whenever the
   public session reads anonymous, and the quiz listing's prompt does the
   same. Display only — the endpoint's authorization is unchanged.

## Consequences

- A fresh install and an untouched existing one render on white in light
  mode on both surfaces.
- The theme editor no longer uploads logos; anything linking to that tab lands
  on Colors.
- Settings tabs are a code registry like every other admin composition
  (ADR-042's split): which keys sit on which tab is a code change.
