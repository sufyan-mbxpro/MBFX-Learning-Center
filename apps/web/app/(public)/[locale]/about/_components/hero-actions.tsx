// The pair of buttons every About hero carries.
//
// It exists because the hero's default surface is a --primary gradient
// (PageHero's `brand` tone), and the button variants are all designed
// against --background: a `default` Button on that hero is primary-on-primary,
// and an `outline` Button inherits `text-foreground`, which is not the ink
// that band is contrast-checked for. Both actions therefore ride on
// --primary-foreground, the one colour ADR-003 derives to be legible on
// --primary — stated once here instead of five times across the section.
import { ArrowRight } from "lucide-react";
import { Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";

export interface HeroAction {
  label: string;
  href: string;
}

export function HeroActions({
  primary,
  secondary,
}: {
  primary: HeroAction;
  secondary?: HeroAction;
}) {
  return (
    <>
      {/* `secondary` (the theme's neutral surface + its own derived ink), not
          `default` — a primary fill on a primary band is invisible. */}
      <Button size="xl" shape="pill" variant="secondary" render={<Link href={primary.href} />}>
        {primary.label}
        <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
      </Button>

      {secondary && (
        <Button
          size="xl"
          shape="pill"
          variant="outline"
          className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          render={<Link href={secondary.href} />}
        >
          {secondary.label}
        </Button>
      )}
    </>
  );
}
