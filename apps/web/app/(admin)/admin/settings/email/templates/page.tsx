import { getTranslations } from "next-intl/server";
import { listEmailTemplates } from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import { can, requirePermission } from "@repo/rbac";
import { SettingsScreen } from "../../_components/settings-screen.tsx";
import { loadSettingsIndex } from "../../_components/settings-shared.ts";
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
  const [{ navEntries }, locales] = await Promise.all([
    loadSettingsIndex(subject, t),
    getActiveLocales(),
  ]);
  const rows = await listEmailTemplates(locales.map((locale) => locale.code));

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
    <SettingsScreen
      navHeading={t("settingsCategories")}
      navEntries={navEntries}
      title={t("email.templatesTitle")}
      description={t("email.templatesDescription")}
    >
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
    </SettingsScreen>
  );
}
