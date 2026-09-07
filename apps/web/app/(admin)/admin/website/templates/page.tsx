import { getTranslations } from "next-intl/server";
import { listLayoutTemplates } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../../_components/admin-page.tsx";
import { SubNav } from "../../_components/sub-nav.tsx";
import { LayoutTemplatesManager } from "./templates-manager.tsx";

// Website → Templates (Module 16, plan v2.2 PR 3.1, ADR-033 §1/§3).
// "Start from": a placed copy is independent — no create screen here yet,
// since nothing produces a new template without the composer's "Save as
// template" (Phase 3 PR 3.3).
export default async function WebsiteTemplatesPage() {
  const subject = await requirePermission("cms.templates.manage");
  const [t, templates] = await Promise.all([getTranslations("admin"), listLayoutTemplates()]);

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
      <LayoutTemplatesManager
        templates={templates}
        canManage={can(subject, "cms.templates.manage")}
        labels={{
          nameLabel: t("styleNameLabel"),
          kindLabel: t("kind"),
          rename: t("rename"),
          cancel: t("cancel"),
          close: t("close"),
          save: t("save"),
          delete: t("delete"),
          systemBadge: t("systemBadge"),
          usageCount: t("usageCount"),
          noResults: t("noResults"),
          confirmDeleteTitle: t("confirmDeleteTemplateTitle"),
          confirmDeleteBody: t("confirmDeleteTemplateBody"),
          confirm: t("confirm"),
        }}
      />
    </AdminPage>
  );
}
