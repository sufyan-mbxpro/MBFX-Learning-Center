import { getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { Card } from "@repo/ui/components/card";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { TRADINGVIEW_ATTRIBUTION_URL } from "@repo/utils";
import { MarketNewsBoard } from "./market-news-board.tsx";

// "Top providers — market news" (ADR-136 §6): the reference's card, holding
// TradingView's Timeline widget, framed rather than scripted (§2).
//
// It comes AFTER our own analysis and its taxonomy, on purpose. A reader on
// /analysis came for our editorial first, and the vendor's feed is the
// supplement. The band also says plainly that nobody here reviewed these
// stories.
export async function MarketNewsBand({ locale }: { locale: string }) {
  const t = await getTranslations("news");

  return (
    <Section spacing="lg" id="market-news" className="scroll-mt-(--header-offset)">
      <Container className="flex flex-col gap-8">
        <Reveal variant="up">
          <SectionHeading
            eyebrow={t("marketNewsEyebrow")}
            title={t("marketNewsTitle")}
            lead={t("marketNewsLead")}
          />
        </Reveal>
        <Reveal variant="up" delay={80}>
          <Card className="gap-0 overflow-hidden py-0 shadow-md">
            {/* changes-42: a row of market chips heads the feed. */}
            <MarketNewsBoard locale={locale} />
            <div className="flex flex-col gap-1 border-t border-border px-6 py-4 text-sm text-muted-foreground">
              <p>
                {t("marketNewsAttribution")}{" "}
                <a
                  href={TRADINGVIEW_ATTRIBUTION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline inline-flex items-center gap-1 hover:text-foreground"
                >
                  TradingView
                  <ExternalLink aria-hidden className="size-3.5" />
                </a>
              </p>
              <p>{t("marketNewsNote")}</p>
            </div>
          </Card>
        </Reveal>
      </Container>
    </Section>
  );
}
