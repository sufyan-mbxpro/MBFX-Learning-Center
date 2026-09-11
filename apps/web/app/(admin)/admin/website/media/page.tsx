import { getTranslations } from "next-intl/server";
import { getMediaFacets, listMediaAssets } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../../_components/admin-page.tsx";
import { MediaLibrary } from "../../_components/media-library.tsx";
import { SubNav } from "../../_components/sub-nav.tsx";

// Website → Media (Module 16, plan v2.2 PR 3.2, ADR-034 §5). Full-page
// mode of the one `MediaLibrary` component; the composer's `mode:
// "select"` picker host lands with the composer itself (Phase 3 PR 3.3).
export default async function WebsiteMediaPage() {
  const subject = await requirePermission("media.view");
  // The FIRST page only (ADR-067 §1) — this screen used to serialise the
  // whole library into the RSC payload on a force-dynamic route.
  const [t, page, facets] = await Promise.all([
    getTranslations("admin"),
    listMediaAssets({ withUsage: true }),
    getMediaFacets(),
  ]);

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
      <MediaLibrary
        initialPage={{ ...page, facets }}
        canUpload={can(subject, "media.upload")}
        canManage={can(subject, "media.update") && can(subject, "media.delete")}
        labels={{
          title: t("websiteMedia"),
          upload: t("mediaUpload"),
          searchPlaceholder: t("mediaSearchPlaceholder"),
          allKind: t("mediaKindAll"),
          imageKind: t("mediaKindImage"),
          videoKind: t("mediaKindVideo"),
          audioKind: t("mediaKindAudio"),
          documentKind: t("mediaKindDocument"),
          noResults: t("noResults"),
          detailTitle: t("mediaDetailTitle"),
          detailDescription: t("dialogDesc.mediaDetail"),
          titleLabel: t("styleNameLabel"),
          altTextLabel: t("mediaAltTextLabel"),
          categoryLabel: t("mediaCategoryLabel"),
          allCategories: t("mediaCategoryAll"),
          categories: {
            news: t("mediaCategory.news"),
            learn: t("mediaCategory.learn"),
            brand: t("mediaCategory.brand"),
            general: t("mediaCategory.general"),
          },
          subfolderLabel: t("mediaSubfolderLabel"),
          subfolderHint: t("mediaSubfolderHint"),
          loading: t("loading"),
          loadMore: t("mediaLoadMore"),
          tagsLabel: t("mediaTagsLabel"),
          tagsHint: t("mediaTagsHint"),
          usageCount: t("usageCount"),
          replace: t("mediaReplace"),
          save: t("save"),
          delete: t("delete"),
          close: t("close"),
          cancel: t("cancel"),
          confirm: t("confirm"),
          confirmDeleteTitle: t("confirmDeleteMediaTitle"),
          confirmDeleteBody: t("confirmDeleteMediaBody"),
        }}
      />
    </AdminPage>
  );
}
