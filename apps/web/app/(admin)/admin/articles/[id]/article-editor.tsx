"use client";

// Two-column article editor: content + SEO per locale on the left,
// lifecycle/organization/media/advanced panels on the right. The body is
// the Tiptap widget (changes-02) landing on the ADR-009 pipeline — it emits
// the same HTML vocabulary the textarea always saved, and sanitization
// still happens server-side on save (sanitize-tiptap.test.ts pins this).
import { useState } from "react";
import { parseVideoUrl } from "@repo/utils";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { ImageUploadField, type ImageUploadLabels } from "../../_components/image-upload-field.tsx";
import { RichTextEditor, type RichTextLabels } from "../../_components/rich-text-editor.tsx";
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
  saveArticleTranslationAction,
  setArticleDeletedAction,
  transitionArticleAction,
  updateArticleMetaAction,
} from "../../_actions/article-actions.ts";
import {
  ARTICLE_STATUS_TONE,
  StatusBadge,
  TRANSLATION_STATUS_TONE,
  statusTone,
} from "../../_components/status-badge.tsx";
import { useServerAction } from "../../_hooks/use-server-action.ts";

interface TranslationData {
  locale: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
  translationStatus: string;
}

interface ArticleData {
  id: string;
  kind: string;
  status: string;
  isActive: boolean;
  isPremium: boolean;
  coverImageUrl: string | null;
  videoUrl: string | null;
  categoryId: string;
  source: string | null;
  sourceUrl: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  updatedAt: string;
  deleted: boolean;
  tagIds: string[];
  translations: TranslationData[];
  legalTransitions: string[];
}

interface EditorLabels {
  kinds: Record<string, string>;
  content: string;
  titleLabel: string;
  slugLabel: string;
  excerpt: string;
  body: string;
  localeLabel: string;
  seoSection: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  canonicalUrl: string;
  noIndex: string;
  saveTranslation: string;
  saved: string;
  publishSection: string;
  statusLabel: string;
  publishedLabel: string;
  updatedLabel: string;
  scheduleFor: string;
  transitions: Record<string, string>;
  statusLabels: Record<string, string>;
  previewDraft: string;
  softDelete: string;
  restore: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  confirm: string;
  cancel: string;
  organizationSection: string;
  kind: string;
  category: string;
  tags: string;
  mediaSection: string;
  coverImageUrl: string;
  videoUrl: string;
  videoInvalid: string;
  advancedSection: string;
  premium: string;
  premiumHint: string;
  activeLabel: string;
  sourceLabel: string;
  sourceUrlLabel: string;
  saveMeta: string;
  editor: RichTextLabels;
  upload: ImageUploadLabels;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-hover flex flex-col gap-3 rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function ArticleEditor({
  article,
  categories,
  tags,
  locales,
  canPublish,
  canDelete,
  labels,
}: {
  article: ArticleData;
  categories: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  locales: string[];
  canPublish: boolean;
  canDelete: boolean;
  labels: EditorLabels;
}) {
  const [locale, setLocale] = useState(locales[0] ?? "en");

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-4">
        <Panel title={labels.content}>
          <div className="flex items-center gap-2">
            <Label htmlFor="article-locale">{labels.localeLabel}</Label>
            <Select value={locale} onValueChange={(v) => setLocale(v ?? locale)}>
              <SelectTrigger id="article-locale" className="w-28">
                <SelectValue>{locale}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {locales.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {article.translations.map(
              (tr) =>
                tr.locale === locale && (
                  <StatusBadge
                    key={tr.locale}
                    tone={statusTone(TRANSLATION_STATUS_TONE, tr.translationStatus)}
                  >
                    {labels.statusLabels[tr.translationStatus] ?? tr.translationStatus}
                  </StatusBadge>
                ),
            )}
          </div>
          <TranslationForm
            key={locale}
            articleId={article.id}
            locale={locale}
            initial={article.translations.find((tr) => tr.locale === locale) ?? null}
            labels={labels}
          />
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <PublishPanel
          article={article}
          canPublish={canPublish}
          canDelete={canDelete}
          labels={labels}
        />
        <MetaPanel article={article} categories={categories} tags={tags} labels={labels} />
      </div>
    </div>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <span
      className={`text-xs ${value.length > max ? "text-destructive" : "text-muted-foreground"}`}
    >
      {value.length}/{max}
    </span>
  );
}

function TranslationForm({
  articleId,
  locale,
  initial,
  labels,
}: {
  articleId: string;
  locale: string;
  initial: TranslationData | null;
  labels: EditorLabels;
}) {
  const { run, pending } = useServerAction();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? "");
  const [ogImageUrl, setOgImageUrl] = useState(initial?.ogImageUrl ?? "");
  const [canonicalUrl, setCanonicalUrl] = useState(initial?.canonicalUrl ?? "");
  const [noIndex, setNoIndex] = useState(initial?.noIndex ?? false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="article-title">{labels.titleLabel}</Label>
        <Input id="article-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="article-slug">{labels.slugLabel}</Label>
        <Input
          id="article-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder={title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="article-excerpt">{labels.excerpt}</Label>
          <CharCount value={excerpt} max={500} />
        </div>
        <Textarea
          id="article-excerpt"
          value={excerpt}
          rows={3}
          onChange={(e) => setExcerpt(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="article-body">{labels.body}</Label>
        <RichTextEditor
          id="article-body"
          value={body}
          onChange={setBody}
          labels={labels.editor}
        />
      </div>

      <h3 className="mt-2 text-sm font-semibold">{labels.seoSection}</h3>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="article-seo-title">{labels.seoTitle}</Label>
          <CharCount value={seoTitle} max={70} />
        </div>
        <Input
          id="article-seo-title"
          value={seoTitle}
          placeholder={title}
          onChange={(e) => setSeoTitle(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="article-seo-description">{labels.seoDescription}</Label>
          <CharCount value={seoDescription} max={180} />
        </div>
        <Textarea
          id="article-seo-description"
          value={seoDescription}
          rows={2}
          placeholder={excerpt}
          onChange={(e) => setSeoDescription(e.target.value)}
        />
      </div>
      <ImageUploadField
        id="article-og-image"
        label={labels.ogImageUrl}
        value={ogImageUrl || null}
        purpose="article"
        labels={labels.upload}
        onChange={(next) => setOgImageUrl(next?.url ?? "")}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="article-canonical">{labels.canonicalUrl}</Label>
        <Input
          id="article-canonical"
          value={canonicalUrl}
          onChange={(e) => setCanonicalUrl(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={noIndex} onCheckedChange={(v) => setNoIndex(v === true)} />
        {labels.noIndex}
      </label>

      <Button
        size="sm"
        className="self-start"
        disabled={pending || title.trim() === ""}
        onClick={() =>
          run(
            () =>
              saveArticleTranslationAction({
                articleId,
                locale,
                title,
                slug: slug || undefined,
                excerpt: excerpt || null,
                body: body || null,
                seoTitle: seoTitle || null,
                seoDescription: seoDescription || null,
                ogImageUrl: ogImageUrl || null,
                canonicalUrl: canonicalUrl || null,
                noIndex,
              }),
            { successMessage: labels.saved },
          )
        }
      >
        {labels.saveTranslation}
      </Button>
    </div>
  );
}

function PublishPanel({
  article,
  canPublish,
  canDelete,
  labels,
}: {
  article: ArticleData;
  canPublish: boolean;
  canDelete: boolean;
  labels: EditorLabels;
}) {
  const [scheduleFor, setScheduleFor] = useState("");
  const { run, pending } = useServerAction();

  const transitions = article.legalTransitions.filter(
    (to) => canPublish || (to !== "PUBLISHED" && to !== "SCHEDULED"),
  );

  return (
    <Panel title={labels.publishSection}>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{labels.statusLabel}</span>
        <StatusBadge tone={statusTone(ARTICLE_STATUS_TONE, article.status)}>
          {labels.statusLabels[article.status] ?? article.status}
        </StatusBadge>
      </div>
      {article.publishedAt && (
        <p className="text-xs text-muted-foreground">
          {labels.publishedLabel}: {article.publishedAt}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {labels.updatedLabel}: {article.updatedAt}
      </p>

      {transitions.includes("SCHEDULED") && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="article-schedule">{labels.scheduleFor}</Label>
          <Input
            id="article-schedule"
            type="datetime-local"
            value={scheduleFor}
            onChange={(e) => setScheduleFor(e.target.value)}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {transitions.map((to) => (
          <Button
            key={to}
            variant={to === "PUBLISHED" ? "default" : "outline"}
            size="xs"
            disabled={pending || (to === "SCHEDULED" && scheduleFor === "")}
            onClick={() =>
              run(() =>
                transitionArticleAction(
                  article.id,
                  to,
                  to === "SCHEDULED" ? new Date(scheduleFor).toISOString() : undefined,
                ),
              )
            }
          >
            {labels.transitions[to] ?? to}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
        <Button
          variant="outline"
          size="xs"
          render={<a href={`/news/preview/${article.id}`} target="_blank" rel="noreferrer" />}
        >
          {labels.previewDraft}
        </Button>
        {canDelete &&
          (article.deleted ? (
            <Button
              variant="outline"
              size="xs"
              disabled={pending}
              onClick={() => run(() => setArticleDeletedAction(article.id, false))}
            >
              {labels.restore}
            </Button>
          ) : (
            <ConfirmDialog
              trigger={
                <Button variant="destructive" size="xs" disabled={pending}>
                  {labels.softDelete}
                </Button>
              }
              title={labels.confirmDeleteTitle}
              description={labels.confirmDeleteBody}
              confirmLabel={labels.confirm}
              cancelLabel={labels.cancel}
              onConfirm={() => run(() => setArticleDeletedAction(article.id, true))}
            />
          ))}
      </div>
    </Panel>
  );
}

function MetaPanel({
  article,
  categories,
  tags,
  labels,
}: {
  article: ArticleData;
  categories: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  labels: EditorLabels;
}) {
  const { run, pending } = useServerAction();
  const [kind, setKind] = useState(article.kind);
  const [categoryId, setCategoryId] = useState(article.categoryId);
  const [tagIds, setTagIds] = useState<string[]>(article.tagIds);
  const [coverImageUrl, setCoverImageUrl] = useState(article.coverImageUrl ?? "");
  const [videoUrl, setVideoUrl] = useState(article.videoUrl ?? "");
  const [isPremium, setIsPremium] = useState(article.isPremium);
  const [isActive, setIsActive] = useState(article.isActive);
  const [source, setSource] = useState(article.source ?? "");
  const [sourceUrl, setSourceUrl] = useState(article.sourceUrl ?? "");

  const parsedVideo = videoUrl.trim() === "" ? null : parseVideoUrl(videoUrl);
  const videoInvalid = videoUrl.trim() !== "" && parsedVideo === null;

  return (
    <>
      <Panel title={labels.organizationSection}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="article-kind">{labels.kind}</Label>
          <Select value={kind} onValueChange={(v) => setKind(v ?? kind)}>
            <SelectTrigger id="article-kind">
              <SelectValue>{labels.kinds[kind] ?? kind}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(labels.kinds).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="article-category">{labels.category}</Label>
          <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? categoryId)}>
            <SelectTrigger id="article-category">
              <SelectValue>{categories.find((c) => c.id === categoryId)?.name ?? ""}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium">{labels.tags}</legend>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={tagIds.includes(tag.id)}
                  onCheckedChange={(checked) =>
                    setTagIds((current) =>
                      checked === true
                        ? [...current, tag.id]
                        : current.filter((id) => id !== tag.id),
                    )
                  }
                />
                {tag.name}
              </label>
            ))}
          </div>
        </fieldset>
      </Panel>

      <Panel title={labels.mediaSection}>
        <ImageUploadField
          id="article-cover"
          label={labels.coverImageUrl}
          value={coverImageUrl || null}
          purpose="article"
          labels={labels.upload}
          onChange={(next) => setCoverImageUrl(next?.url ?? "")}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="article-video">{labels.videoUrl}</Label>
          <Input
            id="article-video"
            value={videoUrl}
            aria-invalid={videoInvalid}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
          {videoInvalid && <p className="text-xs text-destructive">{labels.videoInvalid}</p>}
          {parsedVideo && (
            <p className="text-xs text-muted-foreground">
              {parsedVideo.provider} · {parsedVideo.videoId}
            </p>
          )}
        </div>
      </Panel>

      <Panel title={labels.advancedSection}>
        <label className="flex items-center justify-between gap-2 text-sm">
          {labels.activeLabel}
          <Switch checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
        </label>
        <label className="flex items-center justify-between gap-2 text-sm">
          <span>
            {labels.premium}
            <span className="block text-xs text-muted-foreground">{labels.premiumHint}</span>
          </span>
          <Switch checked={isPremium} onCheckedChange={(v) => setIsPremium(v === true)} />
        </label>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="article-source">{labels.sourceLabel}</Label>
          <Input id="article-source" value={source} onChange={(e) => setSource(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="article-source-url">{labels.sourceUrlLabel}</Label>
          <Input
            id="article-source-url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
        </div>

        <Button
          size="sm"
          className="self-start"
          disabled={pending || videoInvalid || categoryId === ""}
          onClick={() =>
            run(
              () =>
                updateArticleMetaAction(article.id, {
                  kind: kind as "NEWS" | "ANALYSIS" | "TRADE_IDEA",
                  categoryId,
                  tagIds,
                  coverImageUrl: coverImageUrl || null,
                  videoUrl: videoUrl || null,
                  isPremium,
                  isActive,
                  source: source || null,
                  sourceUrl: sourceUrl || null,
                }),
              { successMessage: labels.saved },
            )
          }
        >
          {labels.saveMeta}
        </Button>
      </Panel>
    </>
  );
}
