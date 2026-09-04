import { getTranslations } from "next-intl/server";
import { BookOpen } from "lucide-react";
import { listOutdatedGlossaryTranslations, loadGlossaryAdminList } from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import { requirePermission } from "@repo/rbac";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { AdminPage } from "../_components/admin-page.tsx";
import { StatusBadge, TRANSLATION_STATUS_TONE, statusTone } from "../_components/status-badge.tsx";
import { GlossaryControls, NewTermButton, TranslationForm } from "./glossary-controls.tsx";

// Glossary admin (Module 11 core slice): the full content pipeline on one
// screen — create, edit (sanitize-on-save), status machine, OUTDATED
// queue. Course/lesson editors reuse these exact services when their
// screens land.
export default async function GlossaryAdminPage() {
  await requirePermission("glossary.view");
  const [t, terms, outdated, activeLocales] = await Promise.all([
    getTranslations("admin"),
    loadGlossaryAdminList(),
    listOutdatedGlossaryTranslations(),
    getActiveLocales(),
  ]);
  const locales = activeLocales.map((l) => ({ code: l.code, label: `${l.name} (${l.nativeName})` }));

  // Shared ContentStatus labels — raw enum values never render (code-style #2).
  const statusLabels: Record<string, string> = {
    DRAFT: t("statusDraft"),
    IN_REVIEW: t("statusInReview"),
    PUBLISHED: t("statusPublished"),
    ARCHIVED: t("statusArchived"),
    OUTDATED: t("statusOutdated"),
  };

  return (
    <AdminPage title={t("glossary")} actions={<NewTermButton label={t("newTerm")} />}>
      {outdated.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border border-warning-interactive/40 bg-card p-4">
          <h2 className="text-sm font-semibold">{t("outdatedQueue")}</h2>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {outdated.map((row) => (
              <li key={`${row.termId}:${row.locale}`}>
                {row.term} — <code>{row.locale}</code>
              </li>
            ))}
          </ul>
        </section>
      )}

      {terms.length === 0 ? (
        <Empty>
          <EmptyMedia>
            <BookOpen aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{t("noTerms")}</EmptyTitle>
          <EmptyDescription>{t("noTermsHint")}</EmptyDescription>
        </Empty>
      ) : (
        <section className="flex flex-col gap-4">
          {terms.map((term) => (
            <div key={term.id} className="card-hover flex flex-col gap-3 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{term.term ?? t("untitled")}</span>
                {term.slug && <code className="text-xs text-muted-foreground">/{term.slug}</code>}
                <StatusBadge tone={statusTone(TRANSLATION_STATUS_TONE, term.status)}>
                  {statusLabels[term.status] ?? term.status}
                </StatusBadge>
                {term.deletedAt && <StatusBadge tone="destructive">{t("deleted")}</StatusBadge>}
                <span className="ms-auto text-xs text-muted-foreground">
                  {term.locales
                    .map(
                      (l) =>
                        `${l.locale}: ${statusLabels[l.translationStatus] ?? l.translationStatus}`,
                    )
                    .join(" · ")}
                </span>
              </div>
              <GlossaryControls
                termId={term.id}
                legalTransitions={term.legalTransitions}
                deleted={term.deletedAt !== null}
                labels={{
                  delete: t("softDelete"),
                  restore: t("restore"),
                  statusLabels,
                }}
              />
              <TranslationForm
                termId={term.id}
                locales={locales}
                labels={{
                  term: t("termLabel"),
                  slug: t("slugLabel"),
                  locale: t("localeLabel"),
                  body: t("bodyLabel"),
                  save: t("save"),
                  saved: t("saved"),
                  editor: {
                    bold: t("editorBold"),
                    italic: t("editorItalic"),
                    underline: t("editorUnderline"),
                    strike: t("editorStrike"),
                    heading2: t("editorHeading2"),
                    heading3: t("editorHeading3"),
                    bulletList: t("editorBulletList"),
                    orderedList: t("editorOrderedList"),
                    blockquote: t("editorBlockquote"),
                    codeBlock: t("editorCodeBlock"),
                    link: t("editorLink"),
                    unlink: t("editorUnlink"),
                    image: t("editorImage"),
                    horizontalRule: t("editorHorizontalRule"),
                    undo: t("editorUndo"),
                    redo: t("editorRedo"),
                    linkPrompt: t("editorLinkPrompt"),
                    placeholder: t("editorPlaceholder"),
                  },
                }}
              />
            </div>
          ))}
        </section>
      )}
    </AdminPage>
  );
}
