import { listEmailDesigns, listEmailTemplates } from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import { can, requirePermission } from "@repo/rbac";
import { formatDateTime } from "@repo/utils";
import { TemplateGallery } from "./template-gallery.tsx";

// The email templates gallery (Module 17, ADR-078 #5; presentation changes-59).
//
// Registry-driven: `listEmailTemplates` returns every key the code declares,
// whether or not a row exists, so "the seed has not run" shows as a template
// with no content rather than as a shorter list.
//
// Read gate here; every write re-gates in its own action (security.md #1).
export default async function EmailTemplatesPage() {
  const subject = await requirePermission("email.templates.view");
  const locales = await getActiveLocales();
  const [rows, designs] = await Promise.all([
    listEmailTemplates(locales.map((locale) => locale.code)),
    // ADR-172 #3: the starting points for a custom email, on the same screen
    // as the emails the system sends — but their own tab, because they are a
    // different thing: nothing sends a design.
    listEmailDesigns(subject, { includeArchived: true }),
  ]);
  const defaultLocale =
    locales.find((locale) => locale.isDefault)?.code ?? locales[0]?.code ?? "en";

  return (
    <TemplateGallery
      templates={rows.map((row) => ({
        key: row.key,
        audience: row.audience,
        critical: row.critical,
        isActive: row.isActive,
        subject: row.subject,
        locales: row.locales,
        updatedAtLabel: row.updatedAt ? formatDateTime(row.updatedAt) : null,
      }))}
      designs={designs.map((design) => ({
        id: design.id,
        name: design.name,
        description: design.description,
        mode: design.mode,
        archived: design.archivedAt !== null,
        updatedLabel: formatDateTime(design.updatedAt),
        updatedByName: design.updatedByName,
      }))}
      canUpdate={can(subject, "email.templates.update")}
      previewLocale={defaultLocale}
      locales={locales.map((locale) => ({ code: locale.code, name: locale.name }))}
    />
  );
}
