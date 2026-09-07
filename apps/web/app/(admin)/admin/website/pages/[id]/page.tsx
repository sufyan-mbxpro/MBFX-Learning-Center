import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listParentCandidates, loadPageDetail } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { getActiveLocales } from "@repo/i18n";
import { AdminPage } from "../../../_components/admin-page.tsx";
import { PageEditor } from "./page-editor.tsx";

// Page metadata screen (Module 16 Phase 1, plan v2.2 §8/§12 PR 1.5). The
// composer — the layout JSON editor — is Phase 3; this screen never shows
// a block tree, only title/slug/SEO per locale, page-level fields, and
// publish/unpublish/rollback.
export default async function WebsitePageDetailPage({
  params,
}: PageProps<"/admin/website/pages/[id]">) {
  const subject = await requirePermission("cms.pages.view");
  const { id } = await params;

  const [t, tRoot, detail, locales] = await Promise.all([
    getTranslations("admin"),
    getTranslations(),
    loadPageDetail(id),
    getActiveLocales(),
  ]);
  if (!detail) notFound();

  const defaultLocale = locales.find((l) => l.isDefault)?.code ?? "en";
  const parents = await listParentCandidates(defaultLocale, detail.id);

  const canUpdate = can(subject, "cms.pages.update");
  const canPublish = can(subject, "cms.pages.publish");

  const heading =
    detail.translations.find((tr) => tr.locale === defaultLocale)?.title ??
    detail.translations[0]?.title ??
    t("untitled");

  return (
    <AdminPage title={heading} backHref="/admin/website/pages" backLabel={t("websitePages")}>
      <PageEditor
        page={{
          id: detail.id,
          isHome: detail.key === "home",
          status: detail.status,
          isActive: detail.isActive,
          visibility: detail.visibility,
          requiresFeature: detail.requiresFeature,
          parentId: detail.parentId,
          group: detail.group,
          publishedVersionId: detail.publishedVersionId,
          draftRevision: detail.draftRevision,
          translations: detail.translations,
        }}
        locales={locales.map((l) => ({ code: l.code, label: `${l.name} (${l.nativeName})` }))}
        defaultLocale={defaultLocale}
        parents={parents}
        canUpdate={canUpdate}
        canPublish={canPublish}
        openBuilderLabel={tRoot("cms.builder.openBuilder")}
        labels={{
          localeLabel: t("localeLabel"),
          titleLabel: t("titleLabel"),
          slugLabel: t("slugLabel"),
          pagePath: t("pagePath"),
          seoTitleLabel: t("seoTitleLabel"),
          seoDescriptionLabel: t("seoDescriptionLabel"),
          canonicalUrlLabel: t("canonicalUrlLabel"),
          save: t("save"),
          saved: t("saved"),
          pageParent: t("pageParent"),
          noParent: t("noParent"),
          group: t("group"),
          visibility: t("visibility"),
          visibilityPublic: t("visibilityPublic"),
          visibilityAuthenticated: t("visibilityAuthenticated"),
          visibilityPremium: t("visibilityPremium"),
          visibilityAdmin: t("visibilityAdmin"),
          active: t("active"),
          publish: t("publish"),
          unpublish: t("unpublish"),
          publishedBadge: t("publishedBadge"),
          draftBadge: t("draftBadge"),
          unpublishedChangesBadge: t("unpublishedChangesBadge"),
          confirmUnpublishTitle: t("confirmUnpublishTitle"),
          confirmUnpublishBody: t("confirmUnpublishBody"),
          confirm: t("confirm"),
          cancel: t("cancel"),
          previewLink: t("previewLink"),
        }}
      />
    </AdminPage>
  );
}
