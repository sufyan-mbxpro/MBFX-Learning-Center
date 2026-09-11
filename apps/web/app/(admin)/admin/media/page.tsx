import { getTranslations } from "next-intl/server";
import { getMediaFacets, listMediaAssets } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../_components/admin-page.tsx";
import { MediaLibrary } from "../_components/media-library.tsx";

// Standalone Content → Media screen: the one media library, reachable on
// its own (sidebar) and from every News & Analysis screen's SubNav, not
// nested under the paused Website Builder (ADR-037 Decision #4's
// follow-up). Same `MediaLibrary` component the (hidden) website/media
// screen still uses — one implementation, two entry points.
export default async function MediaPage() {
  const subject = await requirePermission("media.view");
  // The FIRST page only (ADR-067 §1) — this screen used to serialise the
  // whole library into the RSC payload on a force-dynamic route.
  const [t, page, facets] = await Promise.all([
    getTranslations("admin"),
    listMediaAssets({ withUsage: true }),
    getMediaFacets(),
  ]);

  return (
    <AdminPage title={t("websiteMedia")} description={t("pageDesc.media")}>
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
          titleLabel: t("titleLabel"),
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
