"use client";

// Page metadata editor: a locale switcher over the translation form, plus
// page-level fields and publish controls. No layout JSON here — that's
// the Phase 3 composer (ADR-026).
import { useEffect, useMemo, useState } from "react";
import { AdminSection } from "../../../_components/admin-page.tsx";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import {
  previewPagePathAction,
  publishPageAction,
  savePageTranslationAction,
  unpublishPageAction,
  updatePageMetaAction,
} from "../../../_actions/cms-page-actions.ts";
import {
  StatusBadge,
  ARTICLE_STATUS_TONE,
  statusTone,
} from "../../../_components/status-badge.tsx";
import { useServerAction } from "../../../_hooks/use-server-action.ts";

interface PageTranslationData {
  locale: string;
  title: string;
  slug: string;
  path: string;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
}

interface PageData {
  id: string;
  isHome: boolean;
  status: string;
  isActive: boolean;
  visibility: string;
  requiresFeature: string | null;
  parentId: string | null;
  group: string | null;
  publishedVersionId: string | null;
  draftRevision: number;
  translations: PageTranslationData[];
}

interface PageEditorLabels {
  localeLabel: string;
  titleLabel: string;
  slugLabel: string;
  pagePath: string;
  seoTitleLabel: string;
  seoDescriptionLabel: string;
  canonicalUrlLabel: string;
  save: string;
  saved: string;
  pageParent: string;
  noParent: string;
  group: string;
  visibility: string;
  visibilityPublic: string;
  visibilityAuthenticated: string;
  visibilityPremium: string;
  visibilityAdmin: string;
  active: string;
  publish: string;
  unpublish: string;
  publishedBadge: string;
  draftBadge: string;
  unpublishedChangesBadge: string;
  confirmUnpublishTitle: string;
  confirmUnpublishBody: string;
  confirm: string;
  cancel: string;
  previewLink: string;
}

const EMPTY_TRANSLATION = (locale: string): PageTranslationData => ({
  locale,
  title: "",
  slug: "",
  path: "",
  seoTitle: null,
  seoDescription: null,
  canonicalUrl: null,
});

function TranslationPanel({
  pageId,
  isHome,
  translation,
  labels,
}: {
  pageId: string;
  isHome: boolean;
  translation: PageTranslationData;
  labels: PageEditorLabels;
}) {
  const { run, pending } = useServerAction();
  const [title, setTitle] = useState(translation.title);
  const [slug, setSlug] = useState(translation.slug);
  const [seoTitle, setSeoTitle] = useState(translation.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(translation.seoDescription ?? "");
  const [canonicalUrl, setCanonicalUrl] = useState(translation.canonicalUrl ?? "");
  const [previewPath, setPreviewPath] = useState(translation.path);

  // Debounced live preview — a read action, never a write (plan §8: "live
  // path preview, including the parent chain, and a collision check").
  useEffect(() => {
    if (isHome) return;
    const handle = setTimeout(() => {
      previewPagePathAction(pageId, translation.locale, slug).then((result) => {
        if (result.ok) setPreviewPath(result.path);
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [pageId, translation.locale, slug, isHome]);

  return (
    <AdminSection>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-title">{labels.titleLabel}</Label>
          <Input id="page-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        {!isHome && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-slug">{labels.slugLabel}</Label>
            <Input id="page-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{labels.pagePath}</span>
          <code className="text-sm">{previewPath || "/"}</code>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-seo-title">{labels.seoTitleLabel}</Label>
          <Input
            id="page-seo-title"
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-seo-description">{labels.seoDescriptionLabel}</Label>
          <Textarea
            id="page-seo-description"
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            rows={2}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-canonical-url">{labels.canonicalUrlLabel}</Label>
          <Input
            id="page-canonical-url"
            value={canonicalUrl}
            onChange={(e) => setCanonicalUrl(e.target.value)}
          />
        </div>
        <div>
          <Button
            size="sm"
            disabled={pending || !title.trim() || (!isHome && !slug.trim())}
            onClick={() =>
              run(
                () =>
                  savePageTranslationAction(pageId, {
                    locale: translation.locale,
                    title,
                    slug: isHome ? "" : slug,
                    seoTitle: seoTitle || null,
                    seoDescription: seoDescription || null,
                    canonicalUrl: canonicalUrl || null,
                  }),
                { successMessage: labels.saved },
              )
            }
          >
            {labels.save}
          </Button>
        </div>
      </div>
    </AdminSection>
  );
}

export function PageEditor({
  page,
  locales,
  defaultLocale,
  parents,
  canUpdate,
  canPublish,
  openBuilderLabel,
  labels,
}: {
  page: PageData;
  locales: { code: string; label: string }[];
  defaultLocale: string;
  parents: { id: string; title: string }[];
  canUpdate: boolean;
  canPublish: boolean;
  openBuilderLabel: string;
  labels: PageEditorLabels;
}) {
  const { run, pending } = useServerAction();
  const [locale, setLocale] = useState(defaultLocale);
  const [parentId, setParentId] = useState(page.parentId ?? "");
  const [group, setGroup] = useState(page.group ?? "");
  const [visibility, setVisibility] = useState(page.visibility);
  const [isActive, setIsActive] = useState(page.isActive);
  const [unpublishConfirmOpen, setUnpublishConfirmOpen] = useState(false);

  const activeTranslation = useMemo(
    () => page.translations.find((t) => t.locale === locale) ?? EMPTY_TRANSLATION(locale),
    [page.translations, locale],
  );

  const hasUnpublishedChanges = page.publishedVersionId === null || page.draftRevision > 0;

  return (
    <div className="flex flex-col gap-6">
      <AdminSection className="flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={statusTone(ARTICLE_STATUS_TONE, page.status)}>
            {page.status === "PUBLISHED" ? labels.publishedBadge : labels.draftBadge}
          </StatusBadge>
          {hasUnpublishedChanges && page.status === "PUBLISHED" && (
            <StatusBadge tone="warning">{labels.unpublishedChangesBadge}</StatusBadge>
          )}
        </div>
        {(canUpdate || canPublish) && (
          <div className="flex items-center gap-2">
            {canUpdate && (
              <Button size="sm" render={<a href={`/admin/website/pages/${page.id}/builder`} />}>
                {openBuilderLabel}
              </Button>
            )}
            {canPublish && (
              <>
                {activeTranslation.path && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={`/api/preview?pageId=${page.id}&locale=${locale}`}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    {labels.previewLink}
                  </Button>
                )}
                {page.publishedVersionId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => setUnpublishConfirmOpen(true)}
                  >
                    {labels.unpublish}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => publishPageAction(page.id, {}))}
                >
                  {labels.publish}
                </Button>
              </>
            )}
          </div>
        )}
      </AdminSection>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="page-locale">{labels.localeLabel}</Label>
        <Select value={locale} onValueChange={(v) => setLocale(v ?? locale)}>
          <SelectTrigger id="page-locale" className="max-w-64">
            <SelectValue>{locales.find((l) => l.code === locale)?.label ?? locale}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {locales.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TranslationPanel
        key={activeTranslation.locale}
        pageId={page.id}
        isHome={page.isHome}
        translation={activeTranslation}
        labels={labels}
      />

      {canUpdate && !page.isHome && (
        <AdminSection>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="page-parent">{labels.pageParent}</Label>
              <Select
                value={parentId || "none"}
                onValueChange={(v) => setParentId(v === "none" ? "" : (v ?? ""))}
              >
                <SelectTrigger id="page-parent">
                  <SelectValue>
                    {parentId
                      ? (parents.find((p) => p.id === parentId)?.title ?? parentId)
                      : labels.noParent}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{labels.noParent}</SelectItem>
                  {parents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="page-group">{labels.group}</Label>
              <Input id="page-group" value={group} onChange={(e) => setGroup(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="page-visibility">{labels.visibility}</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v ?? visibility)}>
                <SelectTrigger id="page-visibility">
                  <SelectValue>
                    {
                      {
                        PUBLIC: labels.visibilityPublic,
                        AUTHENTICATED: labels.visibilityAuthenticated,
                        PREMIUM: labels.visibilityPremium,
                        ADMIN: labels.visibilityAdmin,
                      }[visibility]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">{labels.visibilityPublic}</SelectItem>
                  <SelectItem value="AUTHENTICATED">{labels.visibilityAuthenticated}</SelectItem>
                  <SelectItem value="PREMIUM">{labels.visibilityPremium}</SelectItem>
                  <SelectItem value="ADMIN">{labels.visibilityAdmin}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="page-active"
                checked={isActive}
                onCheckedChange={(c) => setIsActive(c === true)}
              />
              <Label htmlFor="page-active">{labels.active}</Label>
            </div>
            <div>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      updatePageMetaAction(page.id, {
                        parentId: parentId || null,
                        group: group || null,
                        visibility: visibility as "PUBLIC" | "AUTHENTICATED" | "PREMIUM" | "ADMIN",
                        isActive,
                      }),
                    { successMessage: labels.saved },
                  )
                }
              >
                {labels.save}
              </Button>
            </div>
          </div>
        </AdminSection>
      )}

      <ConfirmDialog
        open={unpublishConfirmOpen}
        onOpenChange={setUnpublishConfirmOpen}
        title={labels.confirmUnpublishTitle}
        description={labels.confirmUnpublishBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => run(() => unpublishPageAction(page.id))}
      />
    </div>
  );
}
