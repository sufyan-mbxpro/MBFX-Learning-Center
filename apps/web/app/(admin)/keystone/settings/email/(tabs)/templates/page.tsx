import { getTranslations } from "next-intl/server";
import { listEmailDesigns, listEmailTemplates } from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import { can, requirePermission } from "@repo/rbac";
import { EmailDesignsTable } from "./designs-table.tsx";
import { EmailTemplatesTable, type EmailTemplatesTableLabels } from "./templates-table.tsx";
import { formatDateTime } from "@repo/utils";

// The email templates list (Module 17, ADR-078 #5).
//
// Registry-driven: `listEmailTemplates` returns every key the code declares,
// whether or not a row exists, so "the seed has not run" shows as a template
// with no content rather than as a shorter list.
//
// Read gate here; every write re-gates in its own action (security.md #1).
export default async function EmailTemplatesPage() {
  const subject = await requirePermission("email.templates.view");
  const t = await getTranslations("admin");
  const locales = await getActiveLocales();
  const [rows, designs] = await Promise.all([
    listEmailTemplates(locales.map((locale) => locale.code)),
    // ADR-172 #3: the starting points for a custom email, on the same screen
    // as the emails the system sends — but a separate table, because they are
    // a different thing: nothing sends a design.
    listEmailDesigns(subject, { includeArchived: true }),
  ]);

  const labels: EmailTemplatesTableLabels = {
    search: t("email.searchTemplates"),
    columns: t("columns"),
    export: t("export"),
    selectedSuffix: t("selectedCount"),
    pageWord: t("pageWord"),
    ofWord: t("ofWord"),
    previous: t("previous"),
    next: t("next"),
    noResults: t("noResults"),
    nameCol: t("email.columnTemplate"),
    audienceCol: t("email.columnAudience"),
    activeCol: t("email.columnActive"),
    localesCol: t("email.columnLocales"),
    updatedCol: t("email.columnUpdated"),
    actionsCol: t("actionsCol"),
    edit: t("edit"),
    never: t("email.never"),
    critical: t("email.critical"),
    audiencePublic: t("email.audiencePublic"),
    audienceStaff: t("email.audienceStaff"),
    audienceAny: t("email.audienceAny"),
    stateCurrent: t("email.localeCurrent"),
    stateOutdated: t("email.localeOutdated"),
    stateMissing: t("email.localeMissing"),
    stateDraft: t("email.localeDraft"),
    noContent: t("email.noContent"),
    allAudiences: t("email.filterAllAudiences"),
    audienceLabel: t("email.filterAudience"),
    activateTitle: t("email.activateTitle"),
    activateBody: t("email.activateBody"),
    deactivateTitle: t("email.deactivateTitle"),
    deactivateBody: t("email.deactivateBody"),
    deactivateCriticalTitle: t("email.deactivateCriticalTitle"),
    deactivateCriticalBody: t("email.deactivateCriticalBody"),
    confirm: t("confirm"),
    cancel: t("cancel"),
    toggleLabel: t("email.toggleActive"),
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3" aria-labelledby="system-emails-heading">
        <h2 id="system-emails-heading" className="text-lg font-semibold">
          {t("email.systemTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("email.templatesDescription")}</p>
        <EmailTemplatesTable
          rows={rows.map((row) => ({
            key: row.key,
            audience: row.audience,
            critical: row.critical,
            isActive: row.isActive,
            subject: row.subject,
            locales: row.locales,
            updatedAtLabel: row.updatedAt ? formatDateTime(row.updatedAt) : null,
            updatedAtSort: row.updatedAt?.getTime() ?? 0,
          }))}
          canUpdate={can(subject, "email.templates.update")}
          labels={labels}
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="email-designs-heading">
        <h2 id="email-designs-heading" className="text-lg font-semibold">
          {t("email.designs.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("email.designs.description")}</p>
        <EmailDesignsTable
          rows={designs.map((design) => ({
            id: design.id,
            name: design.name,
            description: design.description,
            mode: design.mode,
            archived: design.archivedAt !== null,
            updatedLabel: formatDateTime(design.updatedAt),
            updatedSort: design.updatedAt.getTime(),
            updatedByName: design.updatedByName,
          }))}
          canUpdate={can(subject, "email.templates.update")}
        />
      </section>
    </div>
  );
}
