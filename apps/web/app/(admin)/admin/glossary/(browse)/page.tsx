import { getTranslations } from "next-intl/server";
import {
  listGlossaryTopics,
  listOutdatedGlossaryTranslations,
  loadGlossaryAdminList,
} from "@repo/core";
import { LEARN_TRACK_KEYS } from "@repo/contracts";
import { can, requirePermission } from "@repo/rbac";
import { HeaderActions } from "../../_components/header-actions.tsx";
import { trackLabels } from "../../learn/_lib/learn-labels.ts";
import { NewTermButton } from "./glossary-controls.tsx";
import { GlossaryTable, type GlossaryRow } from "./glossary-table.tsx";
import { formatDate } from "@repo/utils";

// The glossary list (ADR-069). A table, not a stack of inline editors — see
// `glossary-table.tsx` for why. Editing is `/admin/glossary/[id]`.
export default async function GlossaryAdminPage() {
  const subject = await requirePermission("glossary.view");
  const [t, terms, outdated, machineTranslated, topics] = await Promise.all([
    getTranslations("admin"),
    loadGlossaryAdminList(),
    listOutdatedGlossaryTranslations(),
    // changes-29 B3 — "what has a machine written that nobody has read" is the
    // second question this queue answers, and it is one filter rather than a
    // column scan because `MACHINE_TRANSLATED` is a STATUS.
    listOutdatedGlossaryTranslations({ status: "MACHINE_TRANSLATED" }),
    listGlossaryTopics(),
  ]);
  const tracks = trackLabels(t);

  // Shared ContentStatus labels — a raw enum value never renders (ADR-044 #5).
  const statuses: Record<string, string> = {
    DRAFT: t("statusDraft"),
    IN_REVIEW: t("statusInReview"),
    SEO_REVIEW: t("statusSeoReview"),
    APPROVED: t("statusApproved"),
    SCHEDULED: t("statusScheduled"),
    PUBLISHED: t("statusPublished"),
    ARCHIVED: t("statusArchived"),
    OUTDATED: t("statusOutdated"),
  };
  const difficulties: Record<string, string> = {
    BEGINNER: t("difficultyBeginner"),
    INTERMEDIATE: t("difficultyIntermediate"),
    ADVANCED: t("difficultyAdvanced"),
  };

  const rows: GlossaryRow[] = terms.map((term) => ({
    id: term.id,
    term: term.term ?? "",
    slug: term.slug ?? "",
    status: term.status,
    statusLabel: statuses[term.status] ?? term.status,
    topicId: term.topicId,
    topicLabel: term.topicName,
    // Resolved to a LABEL here rather than in the table: "Both schools" is a
    // real value, not a missing one, and the table should not have to know
    // which null means what (ADR-069 §3).
    trackLabel: term.track === null ? t("glossaryTrackBoth") : (tracks[term.track] ?? term.track),
    trackKey: term.track ?? "",
    difficultyLabel: difficulties[term.difficulty] ?? term.difficulty,
    localesLabel: term.locales
      .map(
        (l) => `${l.locale.toUpperCase()}: ${statuses[l.translationStatus] ?? l.translationStatus}`,
      )
      .join(" · "),
    deleted: term.deletedAt !== null,
    updatedAtLabel: formatDate(term.updatedAt),
    updatedAtSort: term.updatedAt.getTime(),
  }));

  const topicOptions = topics.map((topic) => ({ id: topic.id, name: topic.name || t("untitled") }));

  return (
    <>
      <HeaderActions>
        {can(subject, "glossary.create") ? (
          <NewTermButton
            topicOptions={topicOptions}
            labels={{
              trigger: t("newTerm"),
              title: t("glossaryEditor.newTermTitle"),
              description: t("glossaryEditor.newTermDescription"),
              topicLabel: t("glossaryEditor.topicLabel"),
              topicNone: t("glossaryEditor.topicNone"),
              trackLabel: t("trackLabel"),
              trackBoth: t("glossaryTrackBoth"),
              create: t("create"),
              cancel: t("cancel"),
              tracks,
            }}
          />
        ) : undefined}
      </HeaderActions>
      {outdated.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border border-warning-interactive/40 bg-card p-4">
          <h2 className="text-sm font-semibold">{t("outdatedQueue")}</h2>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {outdated.map((row) => (
              <li key={`${row.termId}:${row.locale}`}>
                {row.term} — <span className="text-muted-foreground">{row.locale}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* A second band rather than a mixed list: "the source moved under this
          translation" and "a machine wrote this and nobody has read it" are
          different jobs for different people, and an info border rather than a
          warning one says the second is not yet a problem. */}
      {machineTranslated.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border border-info-interactive/40 bg-card p-4">
          <h2 className="text-sm font-semibold">{t("machineTranslatedQueue")}</h2>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {machineTranslated.map((row) => (
              <li key={`${row.termId}:${row.locale}`}>
                {row.term} — <span className="text-muted-foreground">{row.locale}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <GlossaryTable
        rows={rows}
        statusKeys={Object.keys(statuses)}
        topicOptions={topicOptions.map((topic) => ({ value: topic.id, label: topic.name }))}
        trackOptions={LEARN_TRACK_KEYS.map((key) => ({ value: key, label: tracks[key] ?? key }))}
        canCreate={can(subject, "glossary.create")}
        canDelete={can(subject, "glossary.delete")}
        labels={{
          search: t("glossaryEditor.searchPlaceholder"),
          columns: t("columns"),
          export: t("export"),
          selectedSuffix: t("selectedCount"),
          pageWord: t("pageWord"),
          ofWord: t("ofWord"),
          previous: t("previous"),
          next: t("next"),
          noResults: t("noResults"),
          termCol: t("termLabel"),
          statusCol: t("statusLabel"),
          topicCol: t("glossaryEditor.topicLabel"),
          trackCol: t("trackLabel"),
          difficultyCol: t("difficultyLabel"),
          localesCol: t("glossaryEditor.localesCol"),
          updatedCol: t("updatedLabel"),
          actionsCol: t("actionsCol"),
          untitled: t("untitled"),
          unfiled: t("glossaryEditor.unfiled"),
          deleted: t("deleted"),
          edit: t("edit"),
          duplicate: t("duplicate"),
          softDelete: t("softDelete"),
          restore: t("restore"),
          confirmDeleteTitle: t("confirmDeleteGlossaryTitle"),
          confirmDeleteBody: t("confirmDeleteGlossaryBody"),
          confirm: t("confirm"),
          cancel: t("cancel"),
          openActions: t("openActions"),
          emptyTitle: t("noTerms"),
          emptyBody: t("noTermsHint"),
          allStatuses: t("allStatuses"),
          allTopics: t("glossaryEditor.allTopics"),
          allTracks: t("glossaryEditor.allTracks"),
          statusLabel: t("statusLabel"),
          topicLabel: t("glossaryEditor.topicLabel"),
          trackLabel: t("trackLabel"),
          statuses,
        }}
      />
    </>
  );
}
