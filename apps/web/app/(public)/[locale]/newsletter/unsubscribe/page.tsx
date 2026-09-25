import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthScreen } from "../../_components/auth-screen.tsx";
import { unsubscribeAction } from "../../_actions/newsletter.ts";
import { TokenAction } from "../_components/token-action.tsx";
import { titleTemplate, titleFrom } from "../../../../_lib/seo.ts";

// Where the unsubscribe link in every newsletter email lands (ADR-080 #4).
//
// A button, not a GET, for the same reason confirm is: a scanner prefetching
// this URL would otherwise unsubscribe a reader who never asked. The RFC 8058
// one-click endpoint (`/api/newsletter/unsubscribe`) is the single exception,
// and it is a POST too — mail clients post to it directly.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/newsletter/unsubscribe">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([getTranslations("newsletter"), titleTemplate()]);
  return {
    title: titleFrom(template, t("unsubscribeTitle")),
    robots: { index: false, follow: false },
  };
}

export default async function NewsletterUnsubscribePage({
  params,
}: PageProps<"/[locale]/newsletter/unsubscribe">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("newsletter");

  return (
    <AuthScreen title={t("unsubscribeTitle")} description={t("unsubscribeBody")}>
      <TokenAction
        action={unsubscribeAction}
        doneStatus="unsubscribed"
        labels={{
          body: t("unsubscribeBody"),
          action: t("unsubscribeAction"),
          pending: t("unsubscribePending"),
          doneTitle: t("unsubscribedTitle"),
          doneBody: t("unsubscribedBody"),
          invalidTitle: t("unsubscribeInvalidTitle"),
          invalidBody: t("unsubscribeInvalidBody"),
          missingTitle: t("missingTokenTitle"),
          missingBody: t("missingTokenBody"),
          failed: t("unsubscribeInvalidBody"),
          backHome: t("backHome"),
        }}
      />
    </AuthScreen>
  );
}
