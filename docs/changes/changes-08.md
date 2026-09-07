### UI, Layout and Admin Improvements

1. **Badges and Text**

   - Improve all badges so their text is properly **centered**.
   - All subtext, secondary text, and muted text should also use the **Outfit font**.
   - Use Outfit consistently across the entire system.

2. **Remove Underscores from Display Text**

   - Do not display underscores (`_`) anywhere in the user interface.
   - Convert technical names into readable text.
   - Examples:
     - `super_admin` → **Super Admin**
     - `legal.copyrightNotice` → **Legal Copyright Notice**
   - This rule should apply throughout the entire system, including labels, scores, settings, permissions, tables, badges, and other displayed text.

3. **Save and Submit Buttons**

   - All **Save, Submit, Update, Apply**, and similar action buttons should be positioned on the **right side** of the relevant form or section.

4. **Page Heading and Description**

   - Every page should have a clear **page title/heading** and a short **description or explanation**.
   - This should apply to all pages, including settings pages, CRUD pages, and other admin pages.
   - The heading and description should be displayed **at the top of the content/cards**, not inside the sidebar.
   - Settings pages should follow the same layout consistently.

5. **Brand & Colors Settings**

   - The **Brand & Colors** settings page should use only **2 columns** for the color settings.
   - Keep the layout clean, balanced, and responsive.

6. **Delete/Remove Confirmation**

   - Every **Delete** or **Remove** action across the system must show a **confirmation popup** before the action is completed.
   - This is a global rule and must apply to all pages, modules, tables, CRUD screens, media, settings, and other components.
   - The user must explicitly confirm before the item is deleted.

7. **DataTables**

   - DataTable headers must have a **different background/color** from the table rows so they are visually distinct.
   - All filters must appear in **one horizontal row** whenever space allows.
   - Search filters and custom filters should be placed together in the same row.
   - For example, on the News page: Search Article / All Types / All Statuses / All Categories should all be displayed in the **same filter row**.
   - This should be the standard layout for filters across all DataTables.

8. **Visit Site Link**

   - Add a **Visit Site** link on the left/admin sidebar.
   - When the admin clicks it, the **public website should open in a new browser tab/page**.

9. **Media Settings**

   - The Media Settings page should also have a clear **heading and description**, similar to the other settings pages.
   - Explain briefly what the media settings control.

10. **Media Replace and Delete Actions**

    - For media items, show **Replace** and **Delete** icons when the user hovers over the media item.
    - Keep these actions hidden by default and display them clearly on hover.

11. **Overall Consistency**

    - Apply these rules consistently across the **entire admin system and all modules**.
    - The UI should remain clean, modern, responsive, and consistent on desktop, tablet, and mobile.

> the social links there should be icons upload option .. also add the default icons in seeders as well .. that icons should be display on the public site footer or anywhere that will use..

---

## What was found, and what shipped

Written after the pass, against the code. Two findings changed the shape of
the work; the rest is what the list asked for.

### Finding 1 — the social icons were not missing, they were BROKEN

`lucide-react` v1 removed every brand icon. `Instagram`, `Facebook`,
`Youtube`, `Linkedin` and `Twitter` are all absent from the installed
1.38.0 declarations. The public footer resolved a link's icon by looking
its name up as a lucide export and rendered `null` when the lookup missed —
so all five seeded links had been rendering as **empty circles**, silently,
since that upgrade.

That is why the request reads "add the default icons in the seeders": the
seed already named an icon per platform, and the names had simply stopped
resolving. So the fix is not seed data — it is a set of glyphs that exists.
`@repo/ui`'s `social-glyph.tsx` draws them from primitives, and an unknown
name now falls back to a link mark instead of drawing nothing (ADR-045).
The upload option sits on top of that, as `SocialLink.iconUrl`.

### Finding 2 — a stale test, red before this pass

`admin.integration.test.ts` asserted that `saveTheme` REFUSES an illegible
palette. changes-05 had deliberately made every contrast check advisory
(`validateMode`'s own comment records the tradeoff), so nothing produces
`severity: "error"` any more and `saveTheme` always saves. The test had
been failing since. Corrected to assert the behaviour that was actually
chosen — saves, and reports a warning carrying a remedy — not reverted.

### Item-by-item

| #   | Shipped                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Badge base gets `leading-none` + `text-center`, so the text box hugs the glyphs and flex centring is exact. `<code>` removed from every admin surface — that was the one thing rendering in the mono family instead of Outfit.              |
| 2   | `humanizeKey()` in `@repo/utils`, applied to role keys, permission keys, setting keys, feature-flag keys and theme token ids. Two per-screen near-copies of the same helper deleted in favour of it.                                        |
| 3   | Save moved to the inline-end on the settings form, theme editor, profile and glossary editors. Dialog footers already ended their actions; they were left alone.                                                                            |
| 4   | `description` added to 12 screens. `SettingsScreen` puts the heading INSIDE the content column, above the cards, instead of above the sub-nav beside them.                                                                                  |
| 5   | Brand & Colours capped at two columns (`xl:grid-cols-3` dropped).                                                                                                                                                                           |
| 6   | Confirmations added where they were missing: glossary delete, clearing an uploaded image, removing a settings list row, and the new media grid delete. Restore is deliberately NOT confirmed — see ADR-044.                                 |
| 7   | `DataTable` gained a `filters` slot rendered in its own toolbar; articles and users hand their Selects to it. Header band is `bg-muted/60` with the row-hover tint cancelled inside it.                                                     |
| 8   | Visit Site pinned to the end of the sidebar nav — one entry in `AdminSidebarNav`, so desktop and mobile both get it. Root-relative `/`, `target="_blank"`.                                                                                  |
| 9   | Media screen gained a description.                                                                                                                                                                                                          |
| 10  | Replace + Delete on the media tile, revealed on hover — and on keyboard focus and on touch devices, which pure hover would have locked out. The tile is a `div` now: the actions are buttons, and a button inside a button is invalid HTML. |
| 11  | Everything above lands in shared components (`Badge`, `Table`, `DataTable`, `AdminPageHeading`, `SettingsScreen`, `ImageUploadField`, `ConfirmDialog`), so it holds for screens built later rather than for these screens only.             |

### Deliberately not done

- **The cancelled screens** — `/admin/website/*`, the Navigation manager,
  the Homepage composer, Settings → Layout, the theme Layout tab. ADR-042
  withdrew them and they are hidden from the UI. Polishing unreachable
  screens would be work nobody sees; their `<code>` chips and missing
  descriptions are left as they are.
- **Mono on four inputs** — the JSON textarea, the hex colour field, the
  role-key field and the temporary-password field keep `font-mono`. Item 1
  is about subtext; in a field where the admin has to tell `0` from `O`,
  a fixed-width face is doing a job. Called out here rather than silently
  skipped.
- **`showInHeader`** — nothing reads it. The header renders no social row,
  so there was nothing to give icons to. Not added: that is a design
  decision, not a bug fix.
