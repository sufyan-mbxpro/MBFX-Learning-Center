import { getTranslations } from "next-intl/server";
import { getActiveLocales } from "@repo/i18n";
import { routing } from "@repo/i18n/routing";
import { can, requirePermission } from "@repo/rbac";
import { EditorPage } from "../../_components/admin-page.tsx";
import { PromotionEditor } from "../_components/promotion-editor.tsx";
import { newPromotionInitial } from "../_lib/editor-initial.ts";

// A new promotion (ADR-167, changes-52 P3). Nothing is written until Save:
// the editor opens blank, and the first save creates the row and moves to its
// own address, where the other languages become editable.
export default async function NewPromotionPage() {
  const subject = await requirePermission("promotions.create");
  const [t, activeLocales] = await Promise.all([getTranslations("admin"), getActiveLocales()]);

  const defaultLocale = routing.defaultLocale;
  const locales = [
    defaultLocale,
    ...activeLocales.map((l) => l.code).filter((code) => code !== defaultLocale),
  ];

  return (
    <EditorPage
      title={t("promotions.newHeading")}
      description={t("promotions.editorDescription")}
      backHref="/keystone/promotions"
      backLabel={t("nav.promotions")}
    >
      <PromotionEditor
        initial={newPromotionInitial(locales)}
        locales={locales}
        defaultLocale={defaultLocale}
        canUpdate={can(subject, "promotions.update")}
        canCreate
        canPublish={can(subject, "promotions.publish")}
        canDelete={false}
      />
    </EditorPage>
  );
}
