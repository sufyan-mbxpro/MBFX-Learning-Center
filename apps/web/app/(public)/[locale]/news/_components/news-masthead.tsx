// The /news banner (Module 12/15 design pass).
//
// The section front gets a masthead with artwork; the archives beneath it
// (/news/category/*, /news/tag/*, /analysis) keep the plain `ListingHeader`.
// The distinction is deliberate — an archive is a filtered VIEW of the
// section and should read as subordinate to it.
//
// Built on `PageHero` rather than a hand-rolled band: that primitive already
// owns the tone/contrast decisions this surface would otherwise re-derive
// (its header comment records why a `bg-*` through className and
// `--muted-foreground` on a filled band are both traps).
//
// The two actions are in-page anchors, not navigations — the masthead
// earning its height on a listing. On a phone the topics band and the
// subscribe strip are several screens down, and a masthead that only repeats
// the page's name is a scroll tax.
import { ArrowDown } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@repo/ui/components/button";
import { PageHero } from "@repo/ui/components/page-hero";

import { ListingCrumbs } from "./listing-crumbs.tsx";
import { NewsBackdrop } from "./news-art.tsx";

export async function NewsMasthead() {
  const t = await getTranslations("news");

  return (
    <PageHero
      // `priority` on this one piece: it is the LCP candidate on the route.
      // Every other image on the page — article covers included — stays lazy.
      backdrop={<NewsBackdrop slot="banner" priority />}
      breadcrumb={<ListingCrumbs crumbs={[{ label: t("title") }]} tone="onFill" />}
      eyebrow={t("heroEyebrow")}
      title={t("title")}
      lead={t("intro")}
      // Both buttons ride on --primary-foreground, the one ink ADR-003
      // derives to be legible on the `brand` tone this hero defaults to. The
      // pairing is `HeroActions`' (About), restated rather than imported:
      // that component is route-private to /about and reaching across routes
      // into a private folder is how a private folder stops being private.
      actions={
        <>
          <Button size="xl" shape="pill" variant="secondary" render={<a href="#latest" />}>
            {t("heroBrowse")}
            {/* Down, not inline-end: this scrolls the page rather than
                navigating, so it needs no RTL flip either. */}
            <ArrowDown aria-hidden />
          </Button>
          <Button
            size="xl"
            shape="pill"
            variant="outline"
            className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            render={<a href="#topics" />}
          >
            {t("heroTopics")}
          </Button>
        </>
      }
    />
  );
}
