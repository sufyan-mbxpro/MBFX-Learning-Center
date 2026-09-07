import { getTranslations } from "next-intl/server";
import { listPagesAdmin } from "@repo/core";
import { listPagesQuerySchema } from "@repo/contracts";
import { can, requirePermission } from "@repo/rbac";
import { getActiveLocales } from "@repo/i18n";
import { AdminPage } from "../../_components/admin-page.tsx";
import { SubNav } from "../../_components/sub-nav.tsx";
import { NewPageDialog } from "./new-page-dialog.tsx";
import { PagesTable } from "./pages-table.tsx";

// Website → Pages (Module 16 Phase 1, plan v2.2 §8.1). Three tabs because
// the three kinds have different verbs and only STATIC/COLLECTION have a
// URL — Designs (DETAIL) and Global (PART) are seeded catalogs that stay
// empty until Phases 5/6 build the kinds that populate them.
export default async function WebsitePagesPage({
  searchParams,
}: PageProps<"/admin/website/pages">) {
  const subject = await requirePermission("cms.pages.view");
  const params = await searchParams;
  const query = listPagesQuerySchema.parse({
    tab: typeof params.tab === "string" ? params.tab : undefined,
    q: typeof params.q === "string" ? params.q : undefined,
    status: typeof params.status === "string" ? params.status : undefined,
    page: typeof params.page === "string" ? params.page : undefined,
  });

  const [t, locales] = await Promise.all([getTranslations("admin"), getActiveLocales()]);
  const defaultLocale = locales.find((l) => l.isDefault)?.code ?? "en";
  const { rows } = await listPagesAdmin(query, defaultLocale);

  const tab = query.tab ?? "pages";
  const canCreate = can(subject, "cms.pages.create");
  const canDelete = can(subject, "cms.pages.delete");

  return (
    <AdminPage
      title={t("website")}

      actions={
        canCreate && tab === "pages" ? (
          <NewPageDialog
            labels={{
              newPage: t("newPage"),
              titleLabel: t("titleLabel"),
              slugLabel: t("slugLabel"),
              create: t("create"),
              cancel: t("cancel"),
              close: t("close"),
            }}
          />
        ) : undefined
      }
    >
      <SubNav
        aria-label={t("website")}
        items={[
          { href: "/admin/website/pages?tab=pages", label: t("websitePages"), exact: false },
          { href: "/admin/website/pages?tab=designs", label: t("websiteDesigns"), exact: false },
          { href: "/admin/website/pages?tab=global", label: t("websiteGlobal"), exact: false },
          { href: "/admin/website/styles", label: t("websiteStyles") },
          { href: "/admin/website/templates", label: t("websiteTemplates") },
          { href: "/admin/website/cards", label: t("websiteCards") },
          { href: "/admin/website/media", label: t("websiteMedia") },
          { href: "/admin/website/redirects", label: t("websiteRedirects") },
        ]}
      />

      {tab === "designs" && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("designsTabEmpty")}</p>
      )}
      {tab === "global" && <p className="text-sm text-muted-foreground">{t("globalTabEmpty")}</p>}
      {tab !== "global" && (
        <PagesTable
          rows={rows.map((r) => ({
            id: r.id,
            title: r.title,
            path: r.path,
            status: r.status,
            isActive: r.isActive,
            hasUnpublishedChanges: r.hasUnpublishedChanges,
          }))}
          canDelete={canDelete}
          labels={{
            titleLabel: t("titleLabel"),
            pagePath: t("pagePath"),
            statusLabel: t("statusLabel"),
            activeLabel: t("activeLabel"),
            actionsCol: t("actionsCol"),
            untitled: t("untitled"),
            edit: t("edit"),
            duplicate: t("duplicate"),
            softDelete: t("softDelete"),
            restore: t("restore"),
            deleted: t("deleted"),
            noResults: t("noPagesYet"),
            noResultsHint: t("noPagesHint"),
            confirmDeleteTitle: t("confirmDeletePageTitle"),
            confirmDeleteBody: t("confirmDeletePageBody"),
            confirm: t("confirm"),
            cancel: t("cancel"),
            publishedBadge: t("publishedBadge"),
            draftBadge: t("draftBadge"),
            unpublishedChangesBadge: t("unpublishedChangesBadge"),
            statusDraft: t("statusDraft"),
            statusPublished: t("statusPublished"),
          }}
        />
      )}
    </AdminPage>
  );
}
