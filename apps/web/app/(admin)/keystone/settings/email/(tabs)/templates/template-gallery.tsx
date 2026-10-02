"use client";

// The Templates screen as a gallery (changes-59): one tab per kind of email,
// each with its count, a search box on the same row, and a card per email
// whose picture IS the email — the real render, through the isolated preview
// route (ADR-078 #8).
//
// The tabs are "Your designs" (ADR-172 #3: starting points for a custom email,
// which nothing sends) and then one tab per CATEGORY of system email. A
// category is the registry key's first segment (`auth.*`, `newsletter.*`), so
// a new template lands in its tab with no list to update; its label is a
// catalog key with a `humanizeKey()` fallback (code-style #5).
//
// Nothing the two tables showed is lost: subject, key, critical, audience,
// the on/off switch with its consequence-naming confirmation, each language's
// state and the last edit for templates; name, description, mode, archived,
// editor and the edit / duplicate / archive menu for designs.
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Archive,
  ArchiveRestore,
  Copy,
  Eye,
  LayoutTemplate,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
} from "lucide-react";
import type { EmailAudience, EmailBodyMode } from "@repo/contracts";
import type { EmailTemplateLocaleState, EmailTranslationState } from "@repo/core";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { SearchInput } from "@repo/ui/components/search-input";
import { Switch } from "@repo/ui/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { humanizeKey } from "@repo/utils";
import {
  duplicateEmailDesignAction,
  setEmailDesignArchivedAction,
} from "../../../../_actions/custom-email-actions.ts";
import { setEmailTemplateActiveAction } from "../../../../_actions/email-actions.ts";
import { AdminCombobox } from "../../../../_components/combobox.tsx";
import {
  EmailPreviewDialog,
  EmailPreviewThumbnail,
  type EmailPreviewFields,
} from "../../../../_components/email-preview.tsx";
import { HeaderActions } from "../../../../_components/header-actions.tsx";
import { StatusBadge, type StatusTone } from "../../../../_components/status-badge.tsx";
import { useServerAction } from "../../../../_hooks/use-server-action.ts";

export interface GalleryTemplate {
  key: string;
  audience: EmailAudience;
  critical: boolean;
  isActive: boolean;
  /** The default locale's subject — the template's readable name. */
  subject: string;
  locales: EmailTemplateLocaleState[];
  updatedAtLabel: string | null;
}

export interface GalleryDesign {
  id: string;
  name: string;
  description: string | null;
  mode: EmailBodyMode;
  archived: boolean;
  updatedLabel: string;
  updatedByName: string | null;
}

const DESIGNS_TAB = "designs";
const TEMPLATE_PATH = "/keystone/settings/email/templates";
const DESIGN_PATH = "/keystone/settings/email/designs";

const STATE_TONE: Record<EmailTranslationState, StatusTone> = {
  current: "success",
  outdated: "warning",
  missing: "neutral",
  draft: "info",
};

/** A registry key's category: its first segment (`auth.password_reset` → `auth`). */
export function templateCategory(key: string): string {
  return key.split(".")[0] ?? key;
}

function useCategoryLabel() {
  const t = useTranslations("admin.email.gallery");
  return React.useCallback(
    (category: string, part: "label" | "description") => {
      const key = `categories.${category}.${part}`;
      if (t.has(key)) return t(key);
      return part === "label" ? humanizeKey(category) : "";
    },
    [t],
  );
}

function useAudienceLabel() {
  const t = useTranslations("admin.email");
  return (value: EmailAudience) =>
    value === "public"
      ? t("audiencePublic")
      : value === "staff"
        ? t("audienceStaff")
        : t("audienceAny");
}

// ─── Templates ───────────────────────────────────────────────

function ActiveSwitch({ row }: { row: GalleryTemplate }) {
  const t = useTranslations("admin");
  const { run, pending } = useServerAction();
  const [confirming, setConfirming] = React.useState(false);

  const next = !row.isActive;
  const copy = next
    ? { title: t("email.activateTitle"), body: t("email.activateBody") }
    : row.critical
      ? { title: t("email.deactivateCriticalTitle"), body: t("email.deactivateCriticalBody") }
      : { title: t("email.deactivateTitle"), body: t("email.deactivateBody") };

  return (
    <>
      <Switch
        aria-label={t("email.toggleActive")}
        checked={row.isActive}
        disabled={pending}
        onCheckedChange={() => setConfirming(true)}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={copy.title}
        description={copy.body}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        // Turning a template ON is not destructive; turning one off is.
        destructive={!next}
        onConfirm={() => run(() => setEmailTemplateActiveAction({ key: row.key, isActive: next }))}
      />
    </>
  );
}

function LocaleStates({ locales }: { locales: EmailTemplateLocaleState[] }) {
  const t = useTranslations("admin.email");
  const label: Record<EmailTranslationState, string> = {
    current: t("localeCurrent"),
    outdated: t("localeOutdated"),
    missing: t("localeMissing"),
    draft: t("localeDraft"),
  };
  return (
    <div className="flex flex-wrap gap-1">
      {locales.map((entry) => (
        <StatusBadge key={entry.locale} tone={STATE_TONE[entry.state]} appearance="tonal">
          {/* The locale code is how a translator names a catalog — the one
              identifier that IS the display form (ADR-044 #5). */}
          <span className="uppercase">{entry.locale}</span>
          <span className="font-medium opacity-80">{label[entry.state]}</span>
        </StatusBadge>
      ))}
    </div>
  );
}

function TemplateCard({
  row,
  canUpdate,
  previewLocale,
  locales,
}: {
  row: GalleryTemplate;
  canUpdate: boolean;
  previewLocale: string;
  locales: { code: string; name: string }[];
}) {
  const t = useTranslations("admin");
  const audienceLabel = useAudienceLabel();
  const [viewing, setViewing] = React.useState(false);
  const [locale, setLocale] = React.useState(previewLocale);
  const hasContent = row.subject !== "";
  const fields: EmailPreviewFields = { key: row.key, locale };

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-xs transition-shadow hover:shadow-md">
      {hasContent ? (
        <EmailPreviewThumbnail
          fields={{ key: row.key, locale: previewLocale }}
          label={t("emailPreview.thumbnailTitle", { name: row.subject })}
        />
      ) : (
        <div className="flex h-56 items-center justify-center bg-muted text-muted-foreground">
          <Mail aria-hidden className="size-8" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 border-t p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link
              href={`${TEMPLATE_PATH}/${row.key}`}
              className="truncate font-medium hover:underline"
            >
              {row.subject || t("email.noContent")}
            </Link>
            {/* The registry key, as a muted span rather than `<code>` —
                code-style #6: admin chrome is one typeface. */}
            <span className="truncate text-xs text-muted-foreground">{row.key}</span>
          </div>
          <StatusBadge tone={row.isActive ? "success" : "neutral"} appearance="tonal">
            {row.isActive ? t("email.gallery.active") : t("email.gallery.inactive")}
          </StatusBadge>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="info">{audienceLabel(row.audience)}</Badge>
          {row.critical && <Badge variant="warning">{t("email.critical")}</Badge>}
        </div>

        <LocaleStates locales={row.locales} />

        <p className="text-xs text-muted-foreground">
          {t("email.columnUpdated")}: {row.updatedAtLabel ?? t("email.never")}
        </p>

        <div className="mt-auto flex items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasContent}
            onClick={() => setViewing(true)}
          >
            <Eye aria-hidden data-icon="inline-start" />
            {t("email.gallery.view")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            render={
              <Link href={`${TEMPLATE_PATH}/${row.key}`}>
                <Pencil aria-hidden data-icon="inline-start" />
                {t("edit")}
              </Link>
            }
          />
          {canUpdate && (
            <div className="ms-auto">
              <ActiveSwitch row={row} />
            </div>
          )}
        </div>
      </div>

      <EmailPreviewDialog
        open={viewing}
        onOpenChange={setViewing}
        title={row.subject || row.key}
        fields={fields}
        toolbarStart={
          locales.length > 1 ? (
            <AdminCombobox
              aria-label={t("email.gallery.language")}
              className="w-36"
              value={locale}
              onValueChange={setLocale}
              options={locales.map((entry) => ({ value: entry.code, label: entry.name }))}
            />
          ) : undefined
        }
      />
    </article>
  );
}

// ─── Designs ─────────────────────────────────────────────────

function DesignActions({ row, canUpdate }: { row: GalleryDesign; canUpdate: boolean }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const { run } = useServerAction();
  const [confirmArchive, setConfirmArchive] = React.useState(false);

  if (!canUpdate) {
    return (
      <Button
        variant="ghost"
        size="sm"
        render={
          <Link href={`${DESIGN_PATH}/${row.id}`}>
            <Pencil aria-hidden data-icon="inline-start" />
            {t("open")}
          </Link>
        }
      />
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={t("openActions")}>
              <MoreHorizontal aria-hidden />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`${DESIGN_PATH}/${row.id}`)}>
            <Pencil aria-hidden data-icon="inline-start" />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              run(
                async () => {
                  const result = await duplicateEmailDesignAction(row.id);
                  if (!result.ok)
                    throw new Error(t(`announcements.direct.refusals.${result.reason}`));
                  router.push(`${DESIGN_PATH}/${result.id}`);
                },
                { successMessage: t("email.designs.duplicated") },
              )
            }
          >
            <Copy aria-hidden data-icon="inline-start" />
            {t("email.designs.duplicate")}
          </DropdownMenuItem>
          {row.archived ? (
            <DropdownMenuItem
              onClick={() =>
                run(() => setEmailDesignArchivedAction({ id: row.id, archived: false }), {
                  successMessage: t("email.designs.restored"),
                })
              }
            >
              <ArchiveRestore aria-hidden data-icon="inline-start" />
              {t("email.designs.restore")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmArchive(true)}>
              <Archive aria-hidden data-icon="inline-start" />
              {t("email.designs.archive")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={t("email.designs.archiveTitle")}
        description={t("email.designs.archiveBody")}
        confirmLabel={t("email.designs.archive")}
        cancelLabel={t("cancel")}
        destructive
        onConfirm={() =>
          run(() => setEmailDesignArchivedAction({ id: row.id, archived: true }), {
            successMessage: t("email.designs.archived"),
          })
        }
      />
    </>
  );
}

function DesignMeta({ row }: { row: GalleryDesign }) {
  const t = useTranslations("admin");
  const edited = row.updatedByName
    ? t("email.gallery.editedBy", { when: row.updatedLabel, name: row.updatedByName })
    : t("email.gallery.edited", { when: row.updatedLabel });
  const line = row.description ? `${edited} · ${row.description}` : edited;

  return (
    <p className="truncate text-xs text-muted-foreground" title={line}>
      {line}
    </p>
  );
}

function DesignCard({ row, canUpdate }: { row: GalleryDesign; canUpdate: boolean }) {
  const t = useTranslations("admin");
  const [viewing, setViewing] = React.useState(false);
  const fields: EmailPreviewFields = { preview: "design", designId: row.id };

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-xs transition-shadow hover:shadow-md">
      <EmailPreviewThumbnail
        fields={fields}
        label={t("emailPreview.thumbnailTitle", { name: row.name })}
        className={row.archived ? "opacity-60" : undefined}
      />
      <div className="flex flex-1 flex-col gap-3 border-t p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`${DESIGN_PATH}/${row.id}`}
            className="min-w-0 truncate font-medium hover:underline"
          >
            {row.name}
          </Link>
          <Badge variant={row.mode === "HTML" ? "warning" : "info"}>
            {row.mode === "HTML" ? t("email.designs.modeHtml") : t("email.designs.modeRich")}
          </Badge>
        </div>
        {/* One line: when, who and what. A narrow card wrapped the three into
            seven lines; the title attribute keeps the clipped tail readable. */}
        <DesignMeta row={row} />

        {row.archived && (
          <StatusBadge tone="neutral" appearance="tonal">
            {t("email.designs.archivedBadge")}
          </StatusBadge>
        )}
        <div className="mt-auto flex items-center gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={() => setViewing(true)}>
            <Eye aria-hidden data-icon="inline-start" />
            {t("email.gallery.view")}
          </Button>
          <div className="ms-auto">
            <DesignActions row={row} canUpdate={canUpdate} />
          </div>
        </div>
      </div>
      <EmailPreviewDialog
        open={viewing}
        onOpenChange={setViewing}
        title={row.name}
        fields={fields}
      />
    </article>
  );
}

// ─── The gallery ─────────────────────────────────────────────

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {children}
    </div>
  );
}

function NoMatches() {
  const t = useTranslations("admin");
  return (
    <Empty>
      <EmptyMedia>
        <LayoutTemplate aria-hidden />
      </EmptyMedia>
      <EmptyTitle>{t("noResults")}</EmptyTitle>
      <EmptyDescription>{t("email.gallery.noMatches")}</EmptyDescription>
    </Empty>
  );
}

export function TemplateGallery({
  templates,
  designs,
  canUpdate,
  previewLocale,
  locales,
}: {
  templates: GalleryTemplate[];
  designs: GalleryDesign[];
  canUpdate: boolean;
  previewLocale: string;
  locales: { code: string; name: string }[];
}) {
  const t = useTranslations("admin");
  const categoryLabel = useCategoryLabel();
  const [tab, setTab] = React.useState(DESIGNS_TAB);
  const [query, setQuery] = React.useState("");
  const [showArchived, setShowArchived] = React.useState<"active" | "all">("active");

  // Categories in REGISTRY order: the first template of each opens its tab.
  const categories = React.useMemo(
    () => [...new Set(templates.map((row) => templateCategory(row.key)))],
    [templates],
  );

  const needle = query.trim().toLowerCase();
  const matches = (text: string) => needle === "" || text.toLowerCase().includes(needle);
  const visibleDesigns = designs.filter(
    (row) =>
      (showArchived === "all" || !row.archived) && matches(`${row.name} ${row.description ?? ""}`),
  );
  const designCount = designs.filter((row) => !row.archived).length;

  const createButton = canUpdate ? (
    // The screen's primary action sits on its TITLE row (ADR-140 §3).
    <HeaderActions>
      <Button render={<Link href={`${DESIGN_PATH}/new`} />}>
        <Plus aria-hidden data-icon="inline-start" />
        {t("email.designs.create")}
      </Button>
    </HeaderActions>
  ) : null;

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(String(value))} className="gap-4">
      {createButton}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList aria-label={t("email.gallery.tabsLabel")}>
          <TabsTrigger value={DESIGNS_TAB}>
            {t("email.gallery.designsTab")}
            <Badge variant="secondary" size="xs" className="tabular-nums">
              {designCount}
            </Badge>
          </TabsTrigger>
          {categories.map((category) => (
            <TabsTrigger key={category} value={category}>
              {categoryLabel(category, "label")}
              <Badge variant="secondary" size="xs" className="tabular-nums">
                {templates.filter((row) => templateCategory(row.key) === category).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        <SearchInput
          aria-label={t("email.searchTemplates")}
          placeholder={t("email.searchTemplates")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          wrapperClassName="w-full sm:w-72"
        />
      </div>

      <TabsContent value={DESIGNS_TAB} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t("email.designs.description")}</p>
          <AdminCombobox
            aria-label={t("email.designs.filterArchived")}
            className="w-48"
            value={showArchived}
            onValueChange={(value) => setShowArchived(value as "active" | "all")}
            options={[
              { value: "active", label: t("email.designs.filterActive") },
              { value: "all", label: t("email.designs.filterAll") },
            ]}
          />
        </div>
        {designs.length === 0 ? (
          <Empty>
            <EmptyMedia>
              <LayoutTemplate aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{t("email.designs.empty")}</EmptyTitle>
            <EmptyDescription>{t("email.designs.emptyBody")}</EmptyDescription>
          </Empty>
        ) : visibleDesigns.length === 0 ? (
          <NoMatches />
        ) : (
          <CardGrid>
            {visibleDesigns.map((row) => (
              <DesignCard key={row.id} row={row} canUpdate={canUpdate} />
            ))}
          </CardGrid>
        )}
      </TabsContent>

      {categories.map((category) => {
        const rows = templates.filter(
          (row) => templateCategory(row.key) === category && matches(`${row.key} ${row.subject}`),
        );
        const description = categoryLabel(category, "description");
        return (
          <TabsContent key={category} value={category} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {description || t("email.templatesDescription")}
            </p>
            {rows.length === 0 ? (
              <NoMatches />
            ) : (
              <CardGrid>
                {rows.map((row) => (
                  <TemplateCard
                    key={row.key}
                    row={row}
                    canUpdate={canUpdate}
                    previewLocale={previewLocale}
                    locales={locales}
                  />
                ))}
              </CardGrid>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
