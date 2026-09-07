import { getTranslations } from "next-intl/server";
import { listCardTemplates } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../../_components/admin-page.tsx";
import { SubNav } from "../../_components/sub-nav.tsx";
import { CardTemplatesManager } from "./cards-manager.tsx";

// Website → Cards (Module 16, plan v2.2 PR 4.3, ADR-023). "Referenced, not
// copied": editing a template updates every placement; system rows are
// clone-only, same posture as Styles (PR 3.1).
export default async function WebsiteCardsPage() {
  const subject = await requirePermission("cms.cards.manage");
  const [t, templates] = await Promise.all([getTranslations("admin"), listCardTemplates()]);

  return (
    <AdminPage title={t("website")}>
      <SubNav
        aria-label={t("website")}
        items={[
          { href: "/admin/website/pages?tab=pages", label: t("websitePages") },
          { href: "/admin/website/pages?tab=designs", label: t("websiteDesigns") },
          { href: "/admin/website/pages?tab=global", label: t("websiteGlobal") },
          { href: "/admin/website/styles", label: t("websiteStyles") },
          { href: "/admin/website/templates", label: t("websiteTemplates") },
          { href: "/admin/website/cards", label: t("websiteCards") },
          { href: "/admin/website/media", label: t("websiteMedia") },
          { href: "/admin/website/redirects", label: t("websiteRedirects") },
        ]}
      />
      <CardTemplatesManager
        templates={templates}
        canManage={can(subject, "cms.cards.manage")}
        labels={{
          newTemplate: t("newCardTemplate"),
          keyLabel: t("cardKeyLabel"),
          nameLabel: t("cardNameLabel"),
          contentTypeLabel: t("cardContentTypeLabel"),
          variantLabel: t("cardVariantLabel"),
          configLabel: t("cardConfigLabel"),
          create: t("create"),
          cancel: t("cancel"),
          close: t("close"),
          delete: t("delete"),
          duplicate: t("duplicate"),
          systemBadge: t("systemBadge"),
          usageCount: t("usageCount"),
          noResults: t("noResults"),
          confirmDeleteTitle: t("confirmDeleteCardTitle"),
          confirmDeleteBody: t("confirmDeleteCardBody"),
          confirm: t("confirm"),
          invalidJson: t("invalidJson"),
          preview: t("cardPreview"),
        }}
      />
    </AdminPage>
  );
}
