// Header top bar (changes-03-plan.md §6.1) — the slim contact/promo strip
// above the main nav in the reference. Entirely settings-driven
// (`header.topBar`, cached under settings:layout) and OFF by default, so an
// install that never configures it renders nothing at all.
import { Phone } from "lucide-react";
import { Container } from "@repo/ui/components/container";

export function TopBar({
  phone,
  promoText,
  promoUrl,
}: {
  phone: string;
  promoText: string;
  promoUrl: string;
}) {
  // An enabled bar with nothing in it would render an empty coloured strip.
  if (!phone && !promoText) return null;

  return (
    <div className="border-b bg-muted/40 text-xs text-muted-foreground">
      <Container className="flex h-9 items-center justify-between gap-4">
        {phone ? (
          <a
            href={`tel:${phone.replace(/[^+\d]/g, "")}`}
            className="link-underline flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Phone aria-hidden className="size-3.5" />
            {phone}
          </a>
        ) : (
          <span />
        )}

        {promoText &&
          (promoUrl ? (
            <a
              href={promoUrl}
              className="link-underline truncate transition-colors hover:text-foreground"
            >
              {promoText}
            </a>
          ) : (
            <span className="truncate">{promoText}</span>
          ))}
      </Container>
    </div>
  );
}
