// Homepage hero (changes-03-plan.md §6.2) — three layout variants from one
// component, chosen by the admin-set `variant` on the home.sections
// descriptor. Copy comes from the catalogs and site.description (an
// admin-editable setting), never hardcoded.
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { getSetting } from "@repo/settings";
import { Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { cn } from "@repo/ui/lib/utils";
import { HOME_MEDIA } from "../_content/home-media.ts";
import type { SectionProps } from "./registry.ts";

export async function Hero({ locale, variant = "split" }: SectionProps) {
  // site.description is admin-editable and deliberately DIFFERENT content
  // from the hero title — site.tagline duplicated the title's wording and
  // rendered the same sentence twice.
  const [t, description] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getSetting("site.description"),
  ]);

  const body = description ?? t("heroBody");
  const centered = variant === "centered";

  const copy = (
    <div className={cn("flex flex-col gap-5", centered && "items-center text-center")}>
      <Reveal variant="up">
        <h1 className="text-display-lg font-semibold tracking-tight text-balance">
          {t("heroTitle")}
        </h1>
      </Reveal>
      <Reveal variant="up" delay={80}>
        <p
          className={cn(
            "text-lg text-pretty text-muted-foreground",
            centered ? "max-w-2xl" : "max-w-xl",
          )}
        >
          {body}
        </p>
      </Reveal>
      <Reveal variant="up" delay={160}>
        <div className={cn("flex flex-wrap gap-3", centered && "justify-center")}>
          {/* `.glow-on-hover` tints its shadow with the fill already on the
              element (globals.css) — no new hue, so code-style.md #4 holds. */}
          <Button size="xl" shape="pill" className="glow-on-hover" render={<Link href="/news" />}>
            {t("heroPrimaryCta")}
            <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
          </Button>
          <Button size="xl" shape="pill" variant="outline" render={<Link href="/glossary" />}>
            {t("heroSecondaryCta")}
          </Button>
        </div>
      </Reveal>
    </div>
  );

  // `background` tints the whole band; `split` reserves a media column.
  // Deviation from the original ADR-017 rule ("no stock photo committed to
  // the repo, an empty panel until an admin uploads one") — user-supplied
  // asset, explicitly directed in-session (DEVLOG 2026-09-04) rather than
  // routed through the brand-asset upload flow.
  // The ambient backdrop every variant shares. Its own elements rather than
  // classes on Section: Section composes its tone (`bg-background`) with
  // `className` through `cn`, and twMerge reads `bg-glow-primary` as a
  // conflicting `bg-*` utility. The footer solves it the same way.
  const backdrop = (
    <>
      <span aria-hidden className="bg-glow-primary pointer-events-none absolute inset-0 -z-10" />
      <span
        aria-hidden
        className="bg-dot-grid pointer-events-none absolute inset-0 -z-10 opacity-[0.15] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]"
      />
    </>
  );

  if (variant === "background") {
    return (
      <Section tone="muted" spacing="lg" className="relative isolate overflow-hidden">
        {backdrop}
        <Container>{copy}</Container>
      </Section>
    );
  }

  if (centered) {
    return (
      <Section spacing="lg" className="relative isolate overflow-hidden">
        {backdrop}
        <Container size="narrow">{copy}</Container>
      </Section>
    );
  }

  return (
    <Section spacing="lg" className="relative isolate overflow-hidden">
      {backdrop}
      <Container className="grid items-center gap-10 lg:grid-cols-2">
        {copy}
        {/* `HOME_MEDIA.hero` rather than a literal path, so every image on
            this page is addressed through the one media module (the About
            section's ADR-047 §3 pattern). It is the one entry with real
            artwork today; the rest of the module is `null` by design. */}
        <Reveal
          variant="end"
          aria-hidden
          className="group relative hidden aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-primary-subtle to-muted shadow-lg ring-1 ring-foreground/10 lg:block"
        >
          <Image
            src={HOME_MEDIA.hero}
            alt=""
            fill
            priority
            sizes="(max-width: 1024px) 0px, 50vw"
            className="media-zoom object-cover"
          />
          {/* A soft brand sheen over the artwork — a large-area wash, which
              is the only thing raw --primary is for (ADR-018 rule 5). */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-primary/15 via-transparent to-transparent"
          />
        </Reveal>
      </Container>
    </Section>
  );
}
