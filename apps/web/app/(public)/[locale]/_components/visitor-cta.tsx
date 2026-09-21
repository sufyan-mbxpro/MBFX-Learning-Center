"use client";

// The signed-out visitor band (changes-28 PR 5, ADR-094) — the brief's image
// 52: a full-bleed band carrying one line of promise and the two account
// actions, on every public page.
//
// ─── Where it sits, and why not at the bottom of the viewport ─────────────
//
// Above the footer, in the page flow. The reference pins an equivalent bar to
// the bottom of the window; this one does not, for two reasons. A fixed bar
// covers content on exactly the screens with least of it, and on a phone it
// lands on top of the one thing a reader is trying to finish. And a persistent
// fixed element is a second thing competing with the sticky header for the
// small vertical budget a 667px phone has. In flow it is unmissable when a
// reader reaches the end of a page, which is when an account offer is welcome
// rather than in the way.
//
// ─── The three states, and the one that renders nothing ───────────────────
//
// - `loading` — nothing. The band would appear and then vanish for every
//   signed-in learner, a layout shift at the bottom of every page, in exchange
//   for showing an anonymous visitor the offer ~200ms sooner.
// - `learner` — nothing. They already have the account this band offers.
// - `anonymous` — the band. STAFF resolve to `anonymous` at the provider, but
//   that is deliberate elsewhere (ADR-052) and harmless here: the worst case
//   is an administrator being offered a learner account on the public site.
//
// Composition is code (ADR-042): this is chrome, not content, so there is no
// setting behind it — and code-style.md #28 is explicit that a seeded row
// nothing reads is worse than no feature at all.
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";

import { Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";

import { usePublicSession } from "./public-session.tsx";

export function VisitorCta() {
  const t = useTranslations("nav");
  const session = usePublicSession();

  if (session.status !== "anonymous") return null;

  return (
    // `--secondary` and its paired ink, the same surface the footer below it
    // paints, so the two read as one closing block rather than as a banner
    // stuck on top of a footer. No colour is chosen here.
    <aside aria-label={t("visitorCtaLabel")} className="bg-secondary text-secondary-foreground">
      <Container className="flex flex-col items-center gap-4 py-6 text-center sm:flex-row sm:justify-between sm:text-start">
        <p className="text-lg font-semibold text-balance">{t("visitorCtaTitle")}</p>
        <div className="flex shrink-0 items-center gap-3">
          <Button
            variant="ghost"
            className="bg-transparent text-secondary-foreground ring-1 ring-secondary-foreground/35 ring-inset hover:bg-secondary-foreground/10 hover:text-secondary-foreground"
            render={<Link href="/sign-in" />}
          >
            {t("signIn")}
          </Button>
          <Button render={<Link href="/sign-up" />}>
            {t("visitorCtaAction")}
            <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
          </Button>
        </div>
      </Container>
    </aside>
  );
}
