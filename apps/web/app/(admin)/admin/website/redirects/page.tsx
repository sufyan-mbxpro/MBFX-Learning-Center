import { getTranslations } from "next-intl/server";
import { listRedirects } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../../_components/admin-page.tsx";
import { SubNav } from "../../_components/sub-nav.tsx";
import { RedirectsManager } from "./redirect-controls.tsx";

// Website → Redirects. The `Redirect` model and slug-change writes already
// exist (ADR-015 #1); this is the screen and its two mutations, reusing
// the seeded `redirects.manage` permission (plan §3.2 — no
// `cms.redirects.manage`).
export default async function WebsiteRedirectsPage() {
  const subject = await requirePermission("redirects.manage");
  const [t, redirects] = await Promise.all([getTranslations("admin"), listRedirects()]);

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
      <RedirectsManager
        redirects={redirects}
        canManage={can(subject, "redirects.manage")}
        labels={{
          newRedirect: t("newRedirect"),
          redirectFromLabel: t("redirectFromLabel"),
          redirectToLabel: t("redirectToLabel"),
          redirectStatusCodeLabel: t("redirectStatusCodeLabel"),
          create: t("create"),
          cancel: t("cancel"),
          close: t("close"),
          active: t("active"),
          noResults: t("noResults"),
        }}
      />
    </AdminPage>
  );
}
