// The banner of every article LISTING (Module 12/15 design pass; changes-38).
//
// /news, /analysis, /news/category/* and /news/tag/* all open on this one
// masthead. Until changes-38 only the section front had it and the archives
// kept the plain `ListingHeader`, on the theory that an archive is a
// subordinate view. The owner's ask reversed that: a reader who clicks a tag
// should land on a page shaped like the one they came from — the same banner,
// the same listing beside the same sidebar — so "symmetry" is enforced by
// there being one component, not four that agree. `ListingHeader` survives
// for the article detail page only.
//
// Built on `PageHero` rather than a hand-rolled band: that primitive already
// owns the tone/contrast decisions this surface would otherwise re-derive
// (its header comment records why a `bg-*` through className and
// `--muted-foreground` on a filled band are both traps).
//
// The two actions are in-page anchors, not navigations — the masthead
// earning its height on a listing. Every listing page renders a `#latest`
// band (`ArticleListing`) and a `#topics` band (`NewsTopics` on the front,
// `ArchiveTaxonomy` elsewhere), which is what makes both anchors safe here.
//
// Popular tags rode in the banner as chips from changes-38 until changes-47,
// which took them out and shortened the band to `size="medium"`: the sidebar's
// Popular tags panel and the closing `#topics` band already list the same
// facet, so the banner's row was the third copy of it on one page.
import { ArrowDown } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Button } from "@repo/ui/components/button";
import { PageHero } from "@repo/ui/components/page-hero";

import { type Crumb, ListingCrumbs } from "./listing-crumbs.tsx";
import type { NewsMediaKey } from "../_content/news-media.ts";
import { NewsBackdrop } from "./news-art.tsx";

export async function NewsMasthead({
  eyebrow,
  title,
  lead,
  crumbs,
  backdropSlot = "banner",
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  /** The trail after "Home" — the last crumb is the current page. */
  crumbs: Crumb[];
  /**
   * Which piece of `NEWS_MEDIA` sits behind the headline (changes-40).
   *
   * Defaulted rather than required, for ADR-117's reason about `tone`: four
   * callers share this masthead and three of them want the same picture, so a
   * required prop is three chances to type the wrong one and no chance to get
   * the common case wrong.
   */
  backdropSlot?: NewsMediaKey;
}) {
  const t = await getTranslations("news");

  return (
    <PageHero
      size="medium"
      // `priority` on this one piece: it is the LCP candidate on the route.
      // Every other image on the page — article covers included — stays lazy.
      backdrop={<NewsBackdrop slot={backdropSlot} priority />}
      // Composed WITH the artwork, not instead of it: the banner is a
      // photograph and the glyph field is line art, so they occupy different
      // frequencies. Dialled down because the backdrop already carries weight.
      motif={<AmbientMotif variant="chart" intensity={0.7} />}
      breadcrumb={<ListingCrumbs crumbs={crumbs} tone="onFill" />}
      eyebrow={eyebrow}
      title={title}
      lead={lead}
      // The band is `--secondary` now that it shows its photograph
      // (ADR-117). The primary action keeps the brand FILL — a small element
      // with its own paired ink, ADR-018 rule 5's allowed case — and the
      // second takes `inverted`, opacities of `--secondary-foreground`, the
      // one ink ADR-003 derives readable on this fill.
      actions={
        <>
          <Button size="xl" render={<a href="#latest" />}>
            {t("heroBrowse")}
            {/* Down, not inline-end: this scrolls the page rather than
                navigating, so it needs no RTL flip either. */}
            <ArrowDown aria-hidden />
          </Button>
          <Button size="xl" variant="inverted" render={<a href="#topics" />}>
            {t("heroTopics")}
          </Button>
        </>
      }
    />
  );
}
