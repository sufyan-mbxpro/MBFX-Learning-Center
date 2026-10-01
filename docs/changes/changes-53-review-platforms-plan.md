# changes-53 — Review platforms: Trustpilot, Google and Meta, switched on in the admin

- **Status:** SHIPPED R0–R4 (2026-09-29, ADR-169). R5's admin E2E is owed
  to Module 14 with every other admin spec (auth setup is `fixme`); the public
  Trustpilot e2e in `tools.spec.ts` still holds. One difference from §7: the
  per-card "Test link" is a plain link beside the computed address, and the
  address is computed from the TYPED values, so it previews before Save.
- **Decision record:** ADR-169 (`docs/memory/decisions/ADR-169-review-platforms.md`),
  which must be Accepted before PR R1 merges. It **extends** ADR-135 (the
  reviews band is a link, not a widget) and **supersedes only its storage**:
  the single `site.reviewsUrl` setting becomes a row per platform.
- **Modules:** 05 (settings screen), 12 (public site: the band), 01 (schema +
  seed + migration), 07 (brand glyphs).

## 1. What the owner asked for

> Add Google reviews and Meta (Facebook) reviews next to Trustpilot. Each one
> can be switched on or off from the admin, one or more at a time. Each has its
> own link or credentials, editable from the admin. When a visitor clicks one,
> they land where they can write a review.

What exists today (ADR-135, changes-41):

- `ReviewsBand` (`app/(public)/[locale]/_components/reviews-band.tsx`) draws
  "Share your experience" with ONE button.
- Its target is the setting `site.reviewsUrl` (Settings → General → Contact).
  Empty makes the band absent.
- It renders on every tool page and on `/support`.
- It is a plain link that opens a new tab. No third-party script, no CSP
  exception, no cookies. **This plan keeps all of that.**

## 2. Decisions to confirm with the owner

| # | Question | Recommendation |
|---|---|---|
| 1 | Show star ratings / review counts pulled from each platform? | **Settled by the owner (2026-09-29): no.** Each platform is a "leave a review" button exactly like the Trustpilot one. No existing reviews, ratings or counts are shown, so no vendor API and no stored secret. |
| 2 | Embed the platforms' own widgets (Trustpilot TrustBox, Google/Facebook plugins)? | **No.** Same reasons ADR-135 gave: script-src exception, third-party cookies, client weight on every tool page. |
| 3 | Where does the band show? | Keep tool pages + `/support`. Adding the home page is a code change (ADR-042), listed as an option in R4. |
| 4 | Which platforms? | Trustpilot, Google, Facebook. The set is a code registry, so adding one (e.g. Sitejabber) later is a small PR. |
| 5 | Who can edit it? | `settings.update`, the key every other General tab uses. No new permission group: a review link captures nothing. |

## 3. How a visitor reaches "write a review" on each platform

The admin enters the platform's **identifier**; the code builds the
write-a-review address. A **custom URL** field overrides the built address for
any platform, because each vendor changes its URLs over time and the owner
should never wait for a deploy to fix a link.

| Platform | Admin enters | Built link | Lands on |
|---|---|---|---|
| **Trustpilot** | Business domain, e.g. `mbfx.co` | `https://www.trustpilot.com/evaluate/{domain}` | The review form directly |
| **Google** | Place ID, e.g. `ChIJ…` (from Google's Place ID Finder or the Business Profile "Ask for reviews" link) | `https://search.google.com/local/writereview?placeid={placeId}` | The star-rating dialog directly (asks the visitor to sign in to Google) |
| **Facebook (Meta)** | Page username or numeric id, e.g. `mbfxofficial` | `https://www.facebook.com/{page}/reviews` | The page's Reviews tab; Facebook calls them "Recommendations" and has no direct compose URL |

Notes:
- Google's `g.page/r/…/review` short link, which Business Profile hands out,
  is accepted as the custom URL.
- Facebook requires Reviews to be enabled on the Page itself. The admin screen
  says so under the field, because a switched-on platform whose Page has
  Reviews off lands the visitor on an empty tab.
- No credentials or API keys are needed: every platform is a public link built
  from a public identifier.

## 4. Data model (`@repo/db`)

A table, not more settings: each platform has a switch, an order, an
identifier and an override, and the `SocialLink` precedent already stores
exactly this kind of per-brand row.

```prisma
model ReviewPlatform {
  id          String   @id @default(cuid())
  platform    String   @unique @db.VarChar(40)  // REVIEW_PLATFORMS key
  isEnabled   Boolean  @default(false)
  sortOrder   Int      @default(0)
  identifier  String?  @db.VarChar(200)          // domain | placeId | page
  customUrl   String?  @db.VarChar(500)          // https only; wins over the built link
  updatedById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("review_platforms")
}
```

- **Seed:** one row per registry key, `create`-only (never overwrites an
  admin's values). All `isEnabled: false`, except Trustpilot, which inherits
  whatever `site.reviewsUrl` held (below).
- **Migration** `2026XXXX_review_platforms_changes53`:
  1. Create the table.
  2. Copy a non-empty `site.reviewsUrl` into the Trustpilot row's `customUrl`
     with `isEnabled = true`, so a live site shows the same button before and
     after the deploy.
  3. Delete the `site.reviewsUrl` setting row. It is removed from the
     contracts registry, the seed and `settings-shared.ts` in the same PR
     (code-style #28: a setting nothing reads does not ship; the
     `site.faviconUrl` precedent).

## 5. Code registry (`@repo/contracts/review-platforms.ts`)

```ts
export const REVIEW_PLATFORMS = {
  trustpilot: {
    glyph: "trustpilot",
    identifier: z.string().regex(DOMAIN_RE),          // "mbfx.co"
    buildUrl: (id) => `https://www.trustpilot.com/evaluate/${encodeURIComponent(id)}`,
  },
  google: {
    glyph: "google",
    identifier: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/), // Place ID
    buildUrl: (id) => `https://search.google.com/local/writereview?placeid=${encodeURIComponent(id)}`,
  },
  facebook: {
    glyph: "facebook",
    identifier: z.string().regex(/^[A-Za-z0-9.]{5,100}$/),   // page username or id
    buildUrl: (id) => `https://www.facebook.com/${encodeURIComponent(id)}/reviews`,
  },
} as const;
```

- The **set of platforms is code**, every value is data (ADR-042's split, as
  with email templates, tools and AI features).
- `reviewPlatformSaveSchema`: `customUrl` is `https:` only and refuses
  `//host`, `javascript:` and whitespace. **Enabling a platform requires a
  usable link**, meaning an identifier or a custom URL; the schema refuses a
  switched-on row with neither, so the form, the action and the service all
  fail the same way.
- `resolveReviewUrl(row)` is a pure function: `customUrl ?? buildUrl(identifier)`,
  or `null`. A `null` row is never rendered.

## 6. Service layer (`@repo/core/review-platforms.ts`)

| Function | Notes |
|---|---|
| `listReviewPlatforms()` | Admin: every registry key, in `sortOrder`, with its resolved preview URL. A registry key with no row appears with defaults, so a new platform needs no data migration. |
| `saveReviewPlatforms(input, subject)` | One transaction for the whole list (switches, order, identifiers, overrides); `recordAudit`; `revalidateTag("settings:general", { expire: 0 })` so the cached band updates. |
| `getActiveReviewLinks()` | Public, `"use cache"` + `cacheTag("settings:general")`. Returns only `{ platform, url }` for enabled rows with a resolved URL, in order. Never the identifier column itself. |

The server action calls `requirePermission("settings.update")` first
(security #1), after the STAFF gate (#3), and parses through the contracts
schema (#6).

## 7. Admin: Settings → General → **Reviews** tab

A new tab beside Contact, where `site.reviewsUrl` lives today. One card per
platform, in the stored order:

- **Row 1:** a `Switch` that leads the row (code-style #25) + the brand glyph +
  the platform name + a status chip (On · Off · Needs a link).
- **Identifier field** with its own label and hint, e.g. "Place ID — find it
  with Google's Place ID Finder", and a help link to the vendor page.
- **Custom link** field (optional), hint: "Overrides the address built from the
  identifier."
- **Preview:** the resolved address as text, and a "Test link" button that
  opens it in a new tab, so the admin sees the vendor page a visitor will get.
- **Reorder:** move up / move down buttons, keyboard-only like the rest of the
  admin (plan 8.2; no DnD dependency).
- One **Save** at the inline end (code-style #8); `Field` + `useFieldErrors`
  against `reviewPlatformSaveSchema` (#24). Disabling a platform is not
  destructive, so no `ConfirmDialog`; clearing both link fields of an ENABLED
  platform is a validation error instead.
- Strings under `admin.settings.reviews.*`, English only (ADR-043). The
  platform names come from the catalog, never the raw key (code-style #5).

## 8. Public: the band

`ReviewsBand` keeps its heading and lead, and draws **one button per active
platform** instead of one:

- Label from the catalog: `public.reviews.platforms.{trustpilot|google|facebook}`
  = "Review us on Trustpilot / Google / Facebook". Brand names are not
  translated; the sentence around them is.
- Glyph through `SocialGlyph` (ADR-045). `facebook` exists; **`google` and
  `trustpilot` are added** to `social-glyph.tsx` as inline SVG paths (still no
  second icon library, code-style #22). Monochrome `currentColor`, so the
  theme's contrast guarantee holds; no brand hex literals (code-style #1).
- Each is a plain `<a target="_blank" rel="noopener noreferrer">` dressed with
  `buttonVariants`, with the sr-only "opens in a new tab" (ADR-135's markup,
  unchanged). The first is the default button, the rest `outline`, so one
  reads as the main action.
- A row that wraps: `flex flex-wrap justify-center gap-3`, logical properties
  only, correct under `dir=rtl`.
- **Zero active platforms ⇒ the band is absent** (ADR-047 §2), exactly as an
  empty `site.reviewsUrl` is today.
- No script, no CSP change, no click counting (a counter would be a third
  anonymous mutation, ADR-080/113).

**Catalog:** the three new public keys land in `en.json` **and `ar.json`**
in the same PR, because `ar` is in `ENFORCED_LOCALES`.

## 9. PRs

| PR | Scope | Done when |
|---|---|---|
| **R0** | ADR-169 Accepted; this plan; owner confirms §2 | `governance:check` green |
| **R1** | Schema + migration (incl. the `site.reviewsUrl` carry-over and delete); seed; contracts registry, schemas, `resolveReviewUrl`; remove the old setting from contracts, seed and `settings-shared.ts` | Contracts ≥ 90%; seed idempotent; migration tested on a DB holding a value and on one holding `""` |
| **R2** | `@repo/core/review-platforms.ts` + audit + tag revalidation | Testcontainers suite green |
| **R3** | Admin Reviews tab, server action, test-link preview | `admin-form-conventions`, `admin-dialog-conventions` guards green |
| **R4** | `ReviewsBand` multi-button, `google` + `trustpilot` glyphs, en + ar keys. *Option:* add the band to the home page registry | Band tests; catalog completeness; no CSP diff |
| **R5** | E2E: enable Google + Facebook → both buttons on a tool page with the right `href`/`rel`/`target`; disable all → band absent; permission-denied at DB level; axe; RTL smoke; DEVLOG; skills (settings, public-site, market) + CLAUDE.md rows | CI green |

## 10. Tests the plan commits to

- **Contracts:** each platform's identifier accepted/rejected; `customUrl`
  refuses `http:`, `//evil.example`, `javascript:`; an enabled row with no
  link is refused; `resolveReviewUrl` prefers the override and encodes the
  identifier (a `?` or `/` in the input cannot change the path).
- **Registry guard:** every `REVIEW_PLATFORMS` key has a glyph, a public
  catalog label in en and ar, and an admin label.
- **Migration:** a non-empty `site.reviewsUrl` becomes an enabled Trustpilot
  row with that URL; an empty one leaves every platform off; the setting row
  is gone afterwards.
- **Core integration:** order is kept; disabled and link-less rows are never
  returned by `getActiveReviewLinks`; the identifier never appears in its
  output; a save writes one audit row.
- **Band:** absent at zero; N buttons at N; `rel`/`target` on each; the first
  is the default variant.
- **Security:** the action refuses without `settings.update`; a learner
  session 404s on the admin screen.

## 11. Out of scope (v1)

- Review widgets, carousels or star badges from the vendors (§2 #2).
- Showing existing reviews, ratings or review counts from any platform (owner,
  2026-09-29). Adding it later would need its own ADR, because it needs vendor
  API keys (security.md #10).
- Asking learners for a review by email after a course (would ride on
  Module 17's templates; separate change).
- Per-page choice of platforms, or a band on pages other than tools,
  `/support` and optionally home.
- Collecting reviews on our own site.
