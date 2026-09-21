// The account's shell: one section bar over its two pages (ADR-125 §1).
//
// Reads NO session — the bar is the same for every reader, so the layout stays
// as cached as every other public layout. Each page's body does its own
// session read inside `<Suspense>` (ADR-123 §1).
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ACCOUNT_PATH, ACCOUNT_PROGRESS_PATH } from "@repo/contracts";
import { SectionNav } from "../_components/section-nav.tsx";

export default async function AccountLayout({
  children,
  params,
}: LayoutProps<"/[locale]/account">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "account.nav" });

  return (
    <>
      <SectionNav
        ariaLabel={t("label")}
        items={[
          { href: ACCOUNT_PATH, label: t("profile") },
          { href: ACCOUNT_PROGRESS_PATH, label: t("progress") },
        ]}
      />
      {children}
    </>
  );
}
