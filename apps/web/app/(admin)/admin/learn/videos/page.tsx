import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { listVideoCategoriesAdmin, listVideoTopicsAdmin } from "@repo/core";
import { LEARN_TRACK_KEYS } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../../_components/admin-page.tsx";
import { contentStatusLabels, trackLabels } from "../_lib/learn-labels.ts";
import { NewVideoTopicDialog } from "./videos-controls.tsx";
import { VideosTable, type VideosTableLabels } from "./videos-table.tsx";

// Video topic admin list (changes-16 PR 5, ADR-068).
//
// **Gated on `lessons.view`, not `videos.view`** — ADR-068 §3, the third time
// this repo has refused to add keys for a new content type. There is no
// `videos.*` group in the seed registry, so a key like that would be one no
// role can hold and every check would silently 403.
export default async function VideosAdminPage() {
  const subject = await requirePermission("lessons.view");
  const [t, rows, categories] = await Promise.all([
    getTranslations("admin"),
    listVideoTopicsAdmin(),
    listVideoCategoriesAdmin(),
  ]);

  const statuses = contentStatusLabels(t);
  const tracks = trackLabels(t);
  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

  const labels: VideosTableLabels = {
    search: t("videos.searchPlaceholder"),
    columns: t("columns"),
    export: t("export"),
    selectedSuffix: t("selectedCount"),
    pageWord: t("pageWord"),
    ofWord: t("ofWord"),
    previous: t("previous"),
    next: t("next"),
    noResults: t("noResults"),
    titleCol: t("videos.columnTitle"),
    trackCol: t("videos.columnTrack"),
    statusCol: t("videos.columnStatus"),
    videosCol: t("videos.columnVideos"),
    linksCol: t("videos.columnLinks"),
    updatedCol: t("videos.columnUpdated"),
    actionsCol: t("actionsCol"),
    untitled: t("untitled"),
    uncategorised: t("videos.uncategorised"),
    deleted: t("deleted"),
    edit: t("edit"),
    softDelete: t("softDelete"),
    restore: t("restore"),
    confirmDeleteTitle: t("videos.confirmDeleteTitle"),
    confirmDeleteBody: t("videos.confirmDeleteBody"),
    confirm: t("confirm"),
    cancel: t("cancel"),
    openActions: t("openActions"),
    emptyTitle: t("videos.empty"),
    emptyBody: t("videos.emptyBody"),
    allStatuses: t("videos.filterAllStatuses"),
    statusLabel: t("videos.filterStatus"),
    allTracks: t("videos.filterAllTracks"),
    trackLabel: t("trackLabel"),
    allCategories: t("videos.filterAllCategories"),
    categoryLabel: t("videos.categoryLabel"),
    statuses,
    tracks,
  };

  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <AdminPage
      title={t("learnVideos")}
      description={t("pageDesc.learnVideos")}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/admin/learn/videos/categories" />}
          >
            {t("videos.manageCategories")}
          </Button>
          {can(subject, "lessons.create") && (
            <NewVideoTopicDialog
              categories={categoryOptions}
              labels={{
                newTopic: t("videos.create"),
                newTopicDescription: t("videos.createDescription"),
                create: t("create"),
                cancel: t("cancel"),
                close: t("close"),
                titleLabel: t("videos.titleLabel"),
                trackLabel: t("trackLabel"),
                categoryLabel: t("videos.categoryLabel"),
                noCategory: t("videos.uncategorised"),
                tracks,
              }}
            />
          )}
        </div>
      }
    >
      <VideosTable
        rows={rows.map((row) => ({
          id: row.id,
          title: row.title,
          slug: row.slug,
          track: row.track,
          // ADR-044 #5: a raw identifier never renders. `trackLabels` falls back
          // to `humanizeKey()` for a track with no admin label yet.
          trackLabel: tracks[row.track] ?? row.track,
          categoryId: row.categoryId,
          categoryLabel: row.categoryName,
          status: row.status,
          statusLabel: statuses[row.status] ?? row.status,
          videoCount: row.videoCount,
          linkCount: row.linkCount,
          deleted: row.deletedAt !== null,
          updatedAtLabel: dateFormat.format(row.updatedAt),
          updatedAtSort: row.updatedAt.getTime(),
        }))}
        statusKeys={Object.keys(statuses)}
        trackKeys={[...LEARN_TRACK_KEYS]}
        categories={categoryOptions}
        canDelete={can(subject, "lessons.delete")}
        labels={labels}
      />
    </AdminPage>
  );
}
