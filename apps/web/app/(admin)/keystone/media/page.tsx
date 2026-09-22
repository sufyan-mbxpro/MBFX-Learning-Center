import { getTranslations } from "next-intl/server";
import { formatUsd, getAiAvailability } from "@repo/ai";
import { getMediaFacets, listAiFeatureCards, listMediaAssets } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../_components/admin-page.tsx";
import { altTextFieldLabels, altTextReviewLabels } from "../_components/ai-labels.ts";
import { MediaLibrary } from "../_components/media-library.tsx";
import { AltTextReview } from "./alt-text-review.tsx";

/** How many undescribed images one bulk run covers. The service clamps at 25. */
const ALT_TEXT_BATCH = 10;

// Standalone Content → Media screen: the one media library, reachable on
// its own (sidebar) and from every News & Analysis screen's SubNav, not
// nested under the paused Website Builder (ADR-037 Decision #4's
// follow-up). Same `MediaLibrary` component the (hidden) website/media
// screen still uses — one implementation, two entry points.
export default async function MediaPage() {
  const subject = await requirePermission("media.view");
  // The FIRST page only (ADR-067 §1) — this screen used to serialise the
  // whole library into the RSC payload on a force-dynamic route.
  const [t, tAi, page, facets, availability] = await Promise.all([
    getTranslations("admin"),
    getTranslations("admin.ai"),
    listMediaAssets({ withUsage: true }),
    getMediaFacets(),
    // ONE server read (ADR-097 #6), already folded with the global switch and
    // the budget. Its ABSENCE downstream is what makes an AI-off install ship
    // no AI control here.
    getAiAvailability(),
  ]);

  // `ai.use` is the spend gate; `media.update` is what a suggestion may be
  // saved into, and both are re-checked in the action (security.md #1).
  const altTextAi =
    availability.features.alt_text && can(subject, "ai.use") && can(subject, "media.update");

  // The estimated per-call cost, times the batch. It is the number that makes
  // "suggest descriptions" a decision rather than a guess, and it says
  // "estimated" like every other figure this platform prints (ADR-100 #4).
  const perCall = altTextAi
    ? ((await listAiFeatureCards()).find((card) => card.key === "alt_text")
        ?.estimatedCostPerCallUsd ?? 0)
    : 0;

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
          ...(altTextAi ? { ai: altTextFieldLabels((key) => tAi(key as "altTextGenerate")) } : {}),
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
          download: t("mediaDownload"),
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

      {/* changes-29 B5. ABSENT when the feature is off, and below the library
          rather than above it: the library is what this screen is for, and a
          bulk AI run is a job somebody comes here to do on purpose. */}
      {altTextAi && (
        <AltTextReview
          limit={ALT_TEXT_BATCH}
          labels={altTextReviewLabels(
            (key, values) => tAi(key as "altTextStart", values),
            tAi("altTextCostNote", {
              cost: formatUsd(perCall * ALT_TEXT_BATCH),
              count: ALT_TEXT_BATCH,
            }),
          )}
        />
      )}
    </AdminPage>
  );
}
