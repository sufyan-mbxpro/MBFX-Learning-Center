import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthScreen } from "../../_components/auth-screen.tsx";
import { AnnouncementUnsubscribe } from "../_components/announcement-unsubscribe.tsx";
import { titleTemplate, titleFrom } from "../../../../_lib/seo.ts";

// Where the unsubscribe link in every announcement email lands (ADR-171 #9).
//
// A static shell with a button, never a GET that mutates: a mail scanner
// prefetching this URL must not unsubscribe a reader who never asked. The
// RFC 8058 one-click (`/api/email/unsubscribe`) is where the island posts, and
// where a mail client's own Unsubscribe button posts directly.
//
// `noindex`: the page is reached only from a link in an email and says nothing
// to a searcher.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/email/unsubscribe">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations("announcements.unsubscribe"),
    titleTemplate(),
  ]);
  return {
    title: titleFrom(template, t("title")),
    robots: { index: false, follow: false },
  };
}

export default async function AnnouncementUnsubscribePage({
  params,
}: PageProps<"/[locale]/email/unsubscribe">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("announcements.unsubscribe");

  return (
    <AuthScreen title={t("title")} description={t("description")}>
      <AnnouncementUnsubscribe
        labels={{
          body: t("body"),
          action: t("action"),
          pending: t("pending"),
          doneTitle: t("doneTitle"),
          doneBody: t("doneBody"),
          undo: t("undo"),
          undoneTitle: t("undoneTitle"),
          undoneBody: t("undoneBody"),
          newsletterPrompt: t("newsletterPrompt"),
          newsletterAction: t("newsletterAction"),
          newsletterDone: t("newsletterDone"),
          missingTitle: t("missingTitle"),
          missingBody: t("missingBody"),
          failed: t("failed"),
          backHome: t("backHome"),
        }}
      />
    </AuthScreen>
  );
}
