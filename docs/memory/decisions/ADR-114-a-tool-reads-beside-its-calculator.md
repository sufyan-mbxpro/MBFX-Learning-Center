# ADR-114: A tool page reads beside its calculator, and says why it exists

**Status:** Accepted
**Date:** 2026-09-16
**Module:** 13 (tools), 12 (public site), 09 (admin shell), 11 (content),
01 (db)
**Supersedes:** ADR-086 §9's band ORDER (the split it draws between code and
data is untouched, and this ADR is a second application of it).
**Superseded by:** —

## Context

> https://mbfx.co/tools/pip-calculator — overall the presentation should be
> like this, the all calculators
>
> also update the presentations of /tools/market-hours like this

The reference's calculator page differs from ours in three ways that a reader
notices before any of them is described:

1. **The calculator and its explanation are side by side.** Ours stacks the
   explainer under the widget, so "What is a pip?" is below the fold at the
   moment it is most wanted — while someone is looking at a field labelled
   "Trade size (units)" and deciding what to type.
2. **A band of four benefits** ("Accurate calculations", "Multi-currency
   support", …) under the fold, which says what the tool is FOR to a reader
   who arrived from a search result and has not decided to use it yet.
3. Its `/tools/market-hours` leads with a large current time and a list of
   **session overlaps** — the two facts a reader of that page actually came
   for — where ours leads with two form controls.

ADR-086 §9 put the band order in `tool-shell.tsx` precisely so that this kind
of change happens once for eight pages. This is that mechanism being used, not
worked around.

## Decision

**1. The widget and the explainer are one band in two columns.**
`--grid-3-2` at `lg`, widget first, and one column below it. The explainer
column holds intro, body and FAQ as cards — the same three pieces of data,
beside the calculator rather than under it.

The band ORDER is therefore: masthead → (widget | explainer) → highlights →
related → read-next → disclaimer. It is still code, still in one file, and
every word inside every band is still data.

**2. `WidgetLayout` splits on its own width, not on the viewport's.**
`lg:grid-cols-2` was right when the widget was the page's full measure and is
wrong now that it is three fifths of it: at 1024px the inputs column would be
about 290px, and a currency combobox does not fit in it beside a result panel.
A `@container` query is the correct instrument — the question "do two columns
fit here" is about the element, and the viewport only ever answered it by
coincidence. `article-list.tsx` is the precedent in this app.

**3. A tool's benefits are DATA, in a new `highlights` column.**
`ToolTranslation.highlights` is a JSON array of `{ icon, title, text }`, at
most six, validated by `toolHighlightSchema` in `@repo/contracts` and edited
in the tool editor beside the FAQ.

This is ADR-086 #1 applied again rather than an exception to it: the band
exists in code, and every word in it is admin-editable. The one thing an
admin does NOT get is a free-text icon name — `TOOL_HIGHLIGHT_ICONS` is a
closed list resolved to components in the app, for `ToolSpec.icon`'s reason
(`@repo/contracts` may not import lucide-react) and for a second one: an
unrecognised name renders nothing, and a benefits band with three glyphs and
a gap looks broken in a way an admin cannot diagnose.

**The text is plain, not rich.** Four cards of three lines each do not need
headings, tables or links, and a rich-text field here would be a fourth place
to sanitise for no gain. `tools-highlights.test.ts` asserts the seeded copy
holds no markup, which is what makes rendering it as text correct.

**Empty means the band is ABSENT** (ADR-047 §2 rule 1), and — after
changes-35 — with the correction that rule needs: the seed FILLS it, for all
eight tools. A gate on a collection nobody fills is what ADR-113 was written
about, and this ADR ships the data in the same change as the gate.

**4. `/tools/market-hours` leads with the clock and the overlaps, and the
24-hour timeline goes.** The timeline was built in changes-25 T6 because the
reference's page had nothing else on it; the reference has since been read
more carefully, and what a reader wants there is the time where they are, what
is open, and when the two busy windows are. Those are three facts; the
timeline is a picture that contains all three and states none of them.

`sessionOverlaps()` joins `@repo/utils`' pure session clock: it intersects
each pair of sessions over the viewer's own day, so the windows are
DST-correct and shift with the reader's timezone the way every other figure on
that page does. No new data — the overlaps are derived from the seeded session
specs an admin already edits.

The volatility wording is NOT copied from the reference. "Highest volatility,
all major pairs active" is a claim about the market; what we can say is how
many sessions overlap, which is arithmetic. The label comes from the count.
ADR-088's discipline, in the one tool that had escaped it by having no market
data at all.

## Consequences

- One migration (`tool_translations.highlights`, nullable JSON) and one
  bounded seed backfill: an existing row is filled only where `highlights` is
  still NULL, the shape ADR-108's `header.showSearch` migration used.
- The source hash covers highlights — title and text of every entry. ADR-069's
  rule, third application: an edit to any prose an admin can see must flip
  sibling translations OUTDATED, and the glossary term is the cautionary tale.
- `tools-area.test.ts`'s band-order guard gains a band and loses its
  one-`<Section>` assertion, which becomes "one Section holds the widget and
  its explainer". The highlights band pays its own rhythm because it is a
  different KIND of thing — the calculator is the page, and this is the page's
  argument for itself.
- The market-hours timeline's renderer goes; `sessionDaySegments` and
  `nowFraction` stay in `@repo/utils`, tested, because `sessionOverlaps` is
  built on the same interval arithmetic and the timeline is one component away
  from returning.
- Eight tools' worth of seeded benefit copy is now content someone has to keep
  true. It says what each calculator does and what it does not — no claim
  about spreads, execution or account terms, which is the line
  `SUPPORT_FAQ` drew for `/support`.
