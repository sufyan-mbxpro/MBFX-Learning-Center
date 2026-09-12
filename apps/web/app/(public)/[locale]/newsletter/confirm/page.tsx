import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSetting } from "@repo/settings";
import { AuthScreen } from "../../_components/auth-screen.tsx";
import { confirmSubscriptionAction } from "../../_actions/newsletter.ts";
import { TokenAction } from "../_components/token-action.tsx";

// Where the double opt-in confirmation link lands (ADR-080 #1, #4).
//
// The page reads NO search params, so the shell prerenders: the token is read
// from the live URL inside the client island, exactly as `/reset-password`
// does. And the island renders a BUTTON — a mail scanner that fetched this
// page must not have confirmed anything by doing so.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/newsletter/confirm">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations("newsletter"),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t("confirmTitle")),
    // The URL carries a live token. It must never reach an index.
    robots: { index: false, follow: false },
  };
}

export default async function NewsletterConfirmPage({
  params,
}: PageProps<"/[locale]/newsletter/confirm">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("newsletter");

  return (
    <AuthScreen title={t("confirmTitle")} description={t("confirmBody")}>
      <TokenAction
        action={confirmSubscriptionAction}
        doneStatus="confirmed"
        labels={{
          body: t("confirmBody"),
          action: t("confirmAction"),
          pending: t("confirmPending"),
          doneTitle: t("confirmedTitle"),
          doneBody: t("confirmedBody"),
          invalidTitle: t("confirmInvalidTitle"),
          invalidBody: t("confirmInvalidBody"),
          missingTitle: t("missingTokenTitle"),
          missingBody: t("missingTokenBody"),
          failed: t("confirmInvalidBody"),
          backHome: t("backHome"),
        }}
      />
    </AuthScreen>
  );
}
