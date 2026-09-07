import { getTranslations } from "next-intl/server";
import { listStylePresets } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../../_components/admin-page.tsx";
import { SubNav } from "../../_components/sub-nav.tsx";
import { StylePresetsManager } from "./styles-manager.tsx";

// Website → Styles (Module 16, plan v2.2 PR 3.1, ADR-033 §1-2). "Linked":
// editing a preset updates every placement; system rows are clone-only.
export default async function WebsiteStylesPage() {
  const subject = await requirePermission("cms.styles.manage");
  const [t, presets] = await Promise.all([getTranslations("admin"), listStylePresets()]);

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
      <StylePresetsManager
        presets={presets}
        canManage={can(subject, "cms.styles.manage")}
        labels={{
          newStyle: t("newStyle"),
          keyLabel: t("styleKeyLabel"),
          nameLabel: t("styleNameLabel"),
          scopeLabel: t("styleScopeLabel"),
          configLabel: t("styleConfigLabel"),
          create: t("create"),
          cancel: t("cancel"),
          close: t("close"),
          delete: t("delete"),
          duplicate: t("duplicate"),
          systemBadge: t("systemBadge"),
          usageCount: t("usageCount"),
          noResults: t("noResults"),
          confirmDeleteTitle: t("confirmDeleteStyleTitle"),
          confirmDeleteBody: t("confirmDeleteStyleBody"),
          confirm: t("confirm"),
          invalidJson: t("invalidJson"),
        }}
      />
    </AdminPage>
  );
}
