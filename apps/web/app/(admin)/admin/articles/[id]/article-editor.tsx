"use client";

// Article editor v2 (changes-07). Rebuilt to the reference screen's
// information architecture: content + SEO + FAQ + related on the left,
// publishing / taxonomy / post settings / post info on the right, and ONE
// header save that commits the whole screen through `saveArticleAction`.
//
// Two things the reference does not have and that stay (plan §2.3 #29):
//
//   - The LOCALE SWITCHER. Per-translation fields (title, slug, excerpt, body,
//     every SEO field, FAQ) swap with it; per-article fields (media, category,
//     tags, flags, related, schedule) do not. Edits to a locale are held in
//     `drafts` so switching away and back does not lose them.
//   - `kind`, `isPremium`, `source`/`sourceUrl`, Duplicate, Preview — each has
//     a home in the new layout rather than being dropped.
//
// ADR-043: this is ADMIN surface, so its labels are English-only by design.
// The article CONTENT it edits is fully multilingual.
//
// changes-10 (ADR-046) reworked the presentation, not the data flow. Every
// panel is an `EditorSection` with an icon, an accent and a one-line
// description; the header's actions carry intent colours; and the whole grid
// is width-constrained so nothing pasted into the body can widen the page.
// The save payload below is byte-for-byte what it was.
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Eye,
  FileText,
  Info,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { parseVideoUrl } from "@repo/utils";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { Textarea } from "@repo/ui/components/textarea";
import { ImageUploadField } from "../../_components/image-upload-field.tsx";
import { RichTextEditor } from "../../_components/rich-text-editor.tsx";
import {
  duplicateArticleAction,
  saveArticleAction,
  setArticleDeletedAction,
} from "../../_actions/article-actions.ts";
import {
  StatusBadge,
  TRANSLATION_STATUS_TONE,
  statusTone,
} from "../../_components/status-badge.tsx";
import { useServerAction } from "../../_hooks/use-server-action.ts";
import { ContentStats } from "./_panels/content-stats.tsx";
import { EditorSection, Field } from "./_panels/editor-section.tsx";
import { SeoAnalysis } from "./_panels/seo-analysis.tsx";
import { FaqPanel } from "./_panels/faq-panel.tsx";
import { RelatedPanel } from "./_panels/related-panel.tsx";
import { PublishPanel } from "./_panels/publish-panel.tsx";
import { TaxonomyPanel } from "./_panels/taxonomy-panel.tsx";
import type { ArticleData, EditorLabels, FaqDraft, TranslationDraft } from "./editor-types.ts";

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <span
      className={`text-xs tabular-nums ${value.length > max ? "text-destructive" : "text-muted-foreground"}`}
    >
      {value.length}/{max}
    </span>
  );
}

function blankTranslation(locale: string): TranslationDraft {
  return {
    locale,
    title: "",
    slug: "",
    excerpt: "",
    body: "",
    seoTitle: "",
    seoDescription: "",
    ogImageUrl: "",
    ogImageAssetId: null,
    canonicalUrl: "",
    noIndex: false,
    focusKeywords: "",
    noFollow: false,
    ogTitle: "",
    ogDescription: "",
    twitterCard: "",
    twitterImageUrl: "",
    twitterImageAssetId: null,
    faqItems: [],
    translationStatus: "DRAFT",
  };
}

export function ArticleEditor({
  article,
  categories,
  tags,
  relatedOptions,
  locales,
  siteUrl,
  defaultLocale,
  canPublish,
  canDelete,
  canCreate,
  labels,
}: {
  article: ArticleData;
  categories: { id: string; name: string; count: number }[];
  tags: { id: string; name: string; count: number }[];
  relatedOptions: { id: string; title: string }[];
  locales: string[];
  siteUrl: string;
  defaultLocale: string;
  canPublish: boolean;
  canDelete: boolean;
  canCreate: boolean;
  labels: EditorLabels;
}) {
  const router = useRouter();
  const { run, pending } = useServerAction();

  const [locale, setLocale] = useState(locales[0] ?? defaultLocale);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Every locale's draft, so switching away and back keeps unsaved edits.
  const [drafts, setDrafts] = useState<Record<string, TranslationDraft>>(() =>
    Object.fromEntries(article.translations.map((t) => [t.locale, t])),
  );
  const tr = drafts[locale] ?? blankTranslation(locale);
  const setTr = (patch: Partial<TranslationDraft>) =>
    setDrafts((d) => ({
      ...d,
      [locale]: { ...(d[locale] ?? blankTranslation(locale)), ...patch },
    }));

  // Per-ARTICLE state — unchanged by the locale switcher.
  const [kind, setKind] = useState(article.kind);
  const [categoryId, setCategoryId] = useState(article.categoryId);
  const [tagIds, setTagIds] = useState<string[]>(article.tagIds);
  const [relatedIds, setRelatedIds] = useState<string[]>(article.relatedArticleIds);
  const [coverImageUrl, setCoverImageUrl] = useState(article.coverImageUrl ?? "");
  const [coverImageAssetId, setCoverImageAssetId] = useState(article.coverImageAssetId);
  const [headerImageUrl, setHeaderImageUrl] = useState(article.headerImageUrl ?? "");
  const [headerImageAssetId, setHeaderImageAssetId] = useState(article.headerImageAssetId);
  const [videoUrl, setVideoUrl] = useState(article.videoUrl ?? "");
  const [isFeatured, setIsFeatured] = useState(article.isFeatured);
  const [isActive, setIsActive] = useState(article.isActive);
  const [isPremium, setIsPremium] = useState(article.isPremium);
  const [showRelated, setShowRelated] = useState(article.showRelated);
  const [relatedCount, setRelatedCount] = useState(article.relatedCount);
  const [source, setSource] = useState(article.source ?? "");
  const [sourceUrl, setSourceUrl] = useState(article.sourceUrl ?? "");

  const parsedVideo = videoUrl.trim() === "" ? null : parseVideoUrl(videoUrl);
  const videoInvalid = videoUrl.trim() !== "" && parsedVideo === null;

  const derivedSlug = tr.slug || tr.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
  const publicPath = `${locale === defaultLocale ? "" : `/${locale}`}/news/${derivedSlug}`;
  const postUrl = `${siteUrl}${publicPath}`;

  const canSave = tr.title.trim() !== "" && categoryId !== "" && !videoInvalid;

  const save = () =>
    run(
      () =>
        saveArticleAction({
          articleId: article.id,
          meta: {
            kind: kind as "NEWS" | "ANALYSIS" | "TRADE_IDEA",
            categoryId,
            tagIds,
            relatedArticleIds: relatedIds,
            coverImageUrl: coverImageUrl || null,
            coverImageAssetId,
            headerImageUrl: headerImageUrl || null,
            headerImageAssetId,
            videoUrl: videoUrl || null,
            isFeatured,
            isActive,
            isPremium,
            showRelated,
            relatedCount,
            source: source || null,
            sourceUrl: sourceUrl || null,
          },
          translation: {
            articleId: article.id,
            locale,
            title: tr.title,
            slug: tr.slug || undefined,
            excerpt: tr.excerpt || null,
            body: tr.body || null,
            seoTitle: tr.seoTitle || null,
            seoDescription: tr.seoDescription || null,
            ogImageUrl: tr.ogImageUrl || null,
            ogImageAssetId: tr.ogImageAssetId,
            canonicalUrl: tr.canonicalUrl || null,
            noIndex: tr.noIndex,
            focusKeywords: tr.focusKeywords || null,
            noFollow: tr.noFollow,
            ogTitle: tr.ogTitle || null,
            ogDescription: tr.ogDescription || null,
            twitterCard:
              tr.twitterCard === "summary" || tr.twitterCard === "summary_large_image"
                ? tr.twitterCard
                : null,
            twitterImageUrl: tr.twitterImageUrl || null,
            twitterImageAssetId: tr.twitterImageAssetId,
            faqItems: tr.faqItems.map((f: FaqDraft) => ({
              ...(f.id ? { id: f.id } : {}),
              question: f.question,
              answer: f.answer,
            })),
          },
        }),
      { successMessage: labels.saved },
    );

  const dateFmt = useMemo(() => labels.createdValue, [labels.createdValue]);

  return (
    // `min-w-0` all the way down the tree from here. A grid/flex child's
    // default `min-width: auto` means "as wide as my widest unbreakable
    // content", so ONE pasted 400-character URL in the body used to widen
    // the left track, push the 22rem sidebar off screen and put the entire
    // page into horizontal scroll (changes-10 item 9). Each level has to
    // opt out of that separately — fixing only the editor is not enough.
    <div className="flex w-full min-w-0 flex-col gap-4">
      {/* Sticky header — Cancel / Preview / View Live / Update & Publish. */}
      {/* Sticks BELOW the admin shell’s own sticky header, not under it:
          that header is `sticky top-0 z-30 h-[var(--height-header)]`, so a
          plain `top-0 z-10` here slid the save button behind it and made it
          unclickable once the page scrolled. Caught in live verification. */}
      <div className="sticky top-[var(--height-header)] z-20 -mx-1 flex flex-wrap items-center justify-end gap-2 border-b bg-background/95 px-1 py-3 backdrop-blur">
        {/* Colour is assigned by consequence, not by prominence (ADR-046):
            Cancel discards nothing and stays neutral; Preview is
            informational; the save is the one primary action on the screen.
            The lifecycle buttons that DO destroy live at the publish panel,
            where their own colours are. */}
        <Button variant="ghost" size="sm" render={<Link href="/admin/articles" />}>
          {labels.cancel}
        </Button>
        <Button
          variant="info"
          size="sm"
          render={<a href={`/news/preview/${article.id}`} target="_blank" rel="noreferrer" />}
        >
          <Eye data-icon="inline-start" aria-hidden />
          {labels.previewDraft}
        </Button>
        {article.status === "PUBLISHED" && (
          <Button
            variant="outline"
            size="sm"
            render={<a href={publicPath} target="_blank" rel="noreferrer" />}
          >
            <ExternalLink data-icon="inline-start" aria-hidden />
            {labels.viewLive}
          </Button>
        )}
        <Button size="sm" disabled={pending || !canSave} onClick={save}>
          {labels.updateAndPublish}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={labels.openActions}>
                <MoreHorizontal aria-hidden />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {canCreate && (
              <DropdownMenuItem
                onClick={() =>
                  run(async () => {
                    const id = await duplicateArticleAction(article.id);
                    router.push(`/admin/articles/${id}`);
                  })
                }
              >
                {labels.duplicate}
              </DropdownMenuItem>
            )}
            {canDelete && <DropdownMenuSeparator />}
            {canDelete &&
              (article.deleted ? (
                <DropdownMenuItem
                  onClick={() => run(() => setArticleDeletedAction(article.id, false))}
                >
                  {labels.restore}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  {labels.softDelete}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* `minmax(0, 1fr)` rather than `1fr` — see the min-w-0 note above.
          `1fr` is shorthand for `minmax(auto, 1fr)`, which is exactly the
          track that grows to fit its widest child. */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ── Left column ─────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-4">
          <EditorSection
            title={labels.content}
            description={labels.contentDescription}
            icon={FileText}
            accent="primary"
            actions={
              <div className="flex items-center gap-2">
                <Label htmlFor="article-locale" className="text-xs">
                  {labels.localeLabel}
                </Label>
                <Select value={locale} onValueChange={(v) => setLocale(v ?? locale)}>
                  <SelectTrigger id="article-locale" className="h-8 w-24">
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
                <StatusBadge tone={statusTone(TRANSLATION_STATUS_TONE, tr.translationStatus)}>
                  {labels.statusLabels[tr.translationStatus] ?? tr.translationStatus}
                </StatusBadge>
              </div>
            }
            // The stats strip belongs WITH the body it measures, but below a
            // rule — it is a readout, not a field.
            footer={
              <ContentStats body={tr.body} focusKeywords={tr.focusKeywords} labels={labels.stats} />
            }
          >
            <Field id="article-title" label={labels.titleLabel}>
              <Input
                id="article-title"
                value={tr.title}
                onChange={(e) => setTr({ title: e.target.value })}
              />
            </Field>
            <Field id="article-slug" label={labels.slugLabel}>
              <Input
                id="article-slug"
                value={tr.slug}
                placeholder={derivedSlug}
                className="font-mono text-xs"
                onChange={(e) => setTr({ slug: e.target.value })}
              />
            </Field>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium">{labels.postUrl}</span>
              {/* ADR-044 #6: `<code>` is not used for admin chrome. This is a
                  read-only URL display, so it is a muted span — and it
                  truncates rather than stretching the column. */}
              <span className="truncate rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                {postUrl}
              </span>
            </div>

            <Field id="article-body" label={labels.body}>
              <RichTextEditor
                id="article-body"
                value={tr.body}
                onChange={(html) => setTr({ body: html })}
                labels={labels.editor}
                // Item 7: the body is the one field long enough, and edited
                // by people technical enough, to want a source view.
                allowHtmlMode
              />
            </Field>

            <Field
              id="article-excerpt"
              label={labels.excerpt}
              adornment={<CharCount value={tr.excerpt} max={500} />}
            >
              <Textarea
                id="article-excerpt"
                value={tr.excerpt}
                rows={3}
                onChange={(e) => setTr({ excerpt: e.target.value })}
              />
            </Field>
          </EditorSection>

          {/* SEO — four tabs, matching the reference. */}
          <EditorSection
            title={labels.seoSection}
            description={labels.seoSectionDescription}
            icon={Search}
            accent="info"
          >
            <Tabs defaultValue="basic">
              <TabsList>
                <TabsTrigger value="basic">{labels.seoTabBasic}</TabsTrigger>
                <TabsTrigger value="social">{labels.seoTabSocial}</TabsTrigger>
                <TabsTrigger value="advanced">{labels.seoTabAdvanced}</TabsTrigger>
                <TabsTrigger value="analysis">{labels.seoTabAnalysis}</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="flex flex-col gap-3 pt-3">
                <Field
                  id="article-seo-title"
                  label={labels.seoTitle}
                  hint={labels.seoTitleHint}
                  adornment={<CharCount value={tr.seoTitle} max={70} />}
                >
                  <Input
                    id="article-seo-title"
                    value={tr.seoTitle}
                    placeholder={tr.title}
                    onChange={(e) => setTr({ seoTitle: e.target.value })}
                  />
                </Field>
                <Field
                  id="article-seo-description"
                  label={labels.seoDescription}
                  hint={labels.seoDescriptionHint}
                  adornment={<CharCount value={tr.seoDescription} max={180} />}
                >
                  <Textarea
                    id="article-seo-description"
                    value={tr.seoDescription}
                    rows={2}
                    placeholder={tr.excerpt}
                    onChange={(e) => setTr({ seoDescription: e.target.value })}
                  />
                </Field>
                <Field
                  id="article-keywords"
                  label={labels.focusKeywords}
                  hint={labels.focusKeywordsHint}
                >
                  <Input
                    id="article-keywords"
                    value={tr.focusKeywords}
                    onChange={(e) => setTr({ focusKeywords: e.target.value })}
                  />
                </Field>
                <Field
                  id="article-canonical"
                  label={labels.canonicalUrl}
                  hint={labels.canonicalUrlHint}
                >
                  <Input
                    id="article-canonical"
                    value={tr.canonicalUrl}
                    onChange={(e) => setTr({ canonicalUrl: e.target.value })}
                  />
                </Field>
                {/* The reference's two checkboxes are phrased positively; the
                    columns are negative (noIndex/noFollow), so they invert. */}
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!tr.noIndex}
                    onCheckedChange={(v) => setTr({ noIndex: v !== true })}
                  />
                  {labels.allowIndex}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!tr.noFollow}
                    onCheckedChange={(v) => setTr({ noFollow: v !== true })}
                  />
                  {labels.allowFollow}
                </label>
              </TabsContent>

              <TabsContent value="social" className="flex flex-col gap-3 pt-3">
                <Field id="article-og-title" label={labels.ogTitle}>
                  <Input
                    id="article-og-title"
                    value={tr.ogTitle}
                    placeholder={tr.seoTitle || tr.title}
                    onChange={(e) => setTr({ ogTitle: e.target.value })}
                  />
                </Field>
                <Field id="article-og-description" label={labels.ogDescription}>
                  <Textarea
                    id="article-og-description"
                    value={tr.ogDescription}
                    rows={2}
                    placeholder={tr.seoDescription || tr.excerpt}
                    onChange={(e) => setTr({ ogDescription: e.target.value })}
                  />
                </Field>
                <ImageUploadField
                  id="article-og-image"
                  label={labels.ogImageUrl}
                  value={tr.ogImageUrl || null}
                  purpose="article"
                  labels={labels.upload}
                  onChange={(next) =>
                    setTr({ ogImageUrl: next?.url ?? "", ogImageAssetId: next?.id ?? null })
                  }
                />
                <Field id="article-twitter-card" label={labels.twitterCard}>
                  <Select
                    value={tr.twitterCard || "summary_large_image"}
                    onValueChange={(v) => setTr({ twitterCard: v ?? "" })}
                  >
                    <SelectTrigger id="article-twitter-card">
                      <SelectValue>
                        {labels.twitterCardOptions[tr.twitterCard || "summary_large_image"]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(labels.twitterCardOptions).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <ImageUploadField
                  id="article-twitter-image"
                  label={labels.twitterImage}
                  value={tr.twitterImageUrl || null}
                  purpose="article"
                  labels={labels.upload}
                  onChange={(next) =>
                    setTr({
                      twitterImageUrl: next?.url ?? "",
                      twitterImageAssetId: next?.id ?? null,
                    })
                  }
                />
              </TabsContent>

              <TabsContent value="advanced" className="flex flex-col gap-3 pt-3">
                <p className="text-xs text-muted-foreground">{labels.robotsSummaryHint}</p>
                <ul className="flex flex-col gap-1 text-sm">
                  <li>
                    {labels.robotsIndexRow}: <strong>{tr.noIndex ? "noindex" : "index"}</strong>
                  </li>
                  <li>
                    {labels.robotsFollowRow}: <strong>{tr.noFollow ? "nofollow" : "follow"}</strong>
                  </li>
                  <li className="break-words">
                    {labels.canonicalUrl}:{" "}
                    <strong>{tr.canonicalUrl || labels.canonicalDefault}</strong>
                  </li>
                </ul>
              </TabsContent>

              <TabsContent value="analysis" className="pt-3">
                <SeoAnalysis
                  title={tr.seoTitle || tr.title}
                  description={tr.seoDescription || tr.excerpt}
                  body={tr.body}
                  focusKeywords={tr.focusKeywords}
                  labels={labels.analysis}
                />
              </TabsContent>
            </Tabs>
          </EditorSection>

          <FaqPanel
            items={tr.faqItems}
            onChange={(faqItems) => setTr({ faqItems })}
            labels={labels.faq}
          />

          <RelatedPanel
            selected={relatedIds}
            options={relatedOptions}
            showRelated={showRelated}
            relatedCount={relatedCount}
            onSelectedChange={setRelatedIds}
            onShowRelatedChange={setShowRelated}
            onRelatedCountChange={setRelatedCount}
            labels={labels.related}
          />
        </div>

        {/* ── Right column ────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-4">
          <PublishPanel
            articleId={article.id}
            status={article.status}
            legalTransitions={article.legalTransitions}
            publishedAt={article.publishedAt}
            updatedAt={article.updatedAt}
            canPublish={canPublish}
            labels={labels.publish}
          />

          <TaxonomyPanel
            categories={categories}
            tags={tags}
            categoryId={categoryId}
            tagIds={tagIds}
            onCategoryChange={setCategoryId}
            onTagsChange={setTagIds}
            labels={labels.taxonomy}
          />

          <EditorSection
            title={labels.postSettings}
            description={labels.postSettingsDescription}
            icon={SlidersHorizontal}
            accent="warning"
            footer={
              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between gap-2 text-sm">
                  {labels.featuredPost}
                  <Switch checked={isFeatured} onCheckedChange={(v) => setIsFeatured(v === true)} />
                </label>
                <label className="flex items-center justify-between gap-2 text-sm">
                  {labels.activeLabel}
                  <Switch checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
                </label>
                <label className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {labels.premium}
                    <span className="block text-xs text-muted-foreground">
                      {labels.premiumHint}
                    </span>
                  </span>
                  <Switch checked={isPremium} onCheckedChange={(v) => setIsPremium(v === true)} />
                </label>
              </div>
            }
          >
            <Tabs defaultValue="image">
              <TabsList>
                <TabsTrigger value="image">{labels.mediaTabImage}</TabsTrigger>
                <TabsTrigger value="video">{labels.mediaTabVideo}</TabsTrigger>
              </TabsList>
              <TabsContent value="image" className="pt-3">
                <ImageUploadField
                  id="article-cover"
                  label={labels.coverImageUrl}
                  value={coverImageUrl || null}
                  purpose="article"
                  labels={labels.upload}
                  onChange={(next) => {
                    setCoverImageUrl(next?.url ?? "");
                    setCoverImageAssetId(next?.id ?? null);
                  }}
                />
              </TabsContent>
              <TabsContent value="video" className="pt-3">
                <Field id="article-video" label={labels.videoUrl}>
                  <Input
                    id="article-video"
                    value={videoUrl}
                    aria-invalid={videoInvalid}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                  {videoInvalid && (
                    <p className="text-xs text-destructive">{labels.videoInvalid}</p>
                  )}
                  {parsedVideo && (
                    <p className="truncate text-xs text-muted-foreground">
                      {parsedVideo.provider} · {parsedVideo.videoId}
                    </p>
                  )}
                </Field>
              </TabsContent>
            </Tabs>

            <div className="flex flex-col gap-1.5 border-t pt-3">
              <ImageUploadField
                id="article-header-image"
                label={labels.headerImage}
                value={headerImageUrl || null}
                purpose="article"
                labels={labels.upload}
                onChange={(next) => {
                  setHeaderImageUrl(next?.url ?? "");
                  setHeaderImageAssetId(next?.id ?? null);
                }}
              />
              <p className="text-xs text-muted-foreground">{labels.headerImageHint}</p>
            </div>
          </EditorSection>

          <EditorSection
            title={labels.postInfo}
            description={labels.postInfoDescription}
            icon={Info}
            accent="neutral"
          >
            <Field id="article-kind" label={labels.kind}>
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
            </Field>
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{labels.createdLabel}</dt>
                <dd>{dateFmt}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{labels.updatedLabel}</dt>
                <dd>{article.updatedAt}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">{labels.idLabel}</dt>
                {/* ADR-044 #6: an identifier read character by character keeps
                    a fixed-width face, but never via <code> — that inherits a
                    monospace family the admin does not otherwise use. */}
                <dd className="min-w-0 truncate font-mono text-xs">{article.id}</dd>
              </div>
            </dl>
            <Field id="article-source" label={labels.sourceLabel}>
              <Input
                id="article-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </Field>
            <Field id="article-source-url" label={labels.sourceUrlLabel}>
              <Input
                id="article-source-url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
            </Field>
          </EditorSection>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={labels.confirmDeleteTitle}
        description={labels.confirmDeleteBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={async () => {
          await setArticleDeletedAction(article.id, true);
          router.refresh();
        }}
      />
    </div>
  );
}
