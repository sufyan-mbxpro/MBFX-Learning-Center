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
import { useMemo, useState, type ReactNode } from "react";
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
import { saveArticleSchema, updateArticleMetaSchema, type SaveArticleInput } from "@repo/contracts";
import { htmlToBlockText, parseVideoUrl } from "@repo/utils";
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
// The editor's labelled fields use EditorSection's `Field` wrapper; the raw
// primitive is only for the rows that wrapper does not shape — horizontal
// checkbox/switch rows and the locale switcher in a section header.
import {
  Field as UiField,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { Textarea } from "@repo/ui/components/textarea";
import { ImageUploadField } from "../../_components/image-upload-field.tsx";
import { RichTextEditor } from "../../_components/rich-text-editor.tsx";
import type { AiAssistantConfig, AiAssistantLabels } from "../../_components/ai-assistant.tsx";
import {
  AiFieldMenu,
  AiFillButton,
  type AiFaqValue,
  type AiFillConfig,
  type AiFillPatch,
} from "../../_components/ai-fill.tsx";
import { AiSeoButton, type AiSeoLabels } from "../../_components/ai-seo-dialog.tsx";
import {
  AiTranslateButton,
  type AiTranslateLabels,
} from "../../_components/ai-translate-button.tsx";
import { TakeawaysField, type TakeawaysLabels } from "../../_components/takeaways-field.tsx";
import {
  duplicateArticleAction,
  saveArticleAction,
  setArticleDeletedAction,
  transitionArticleAction,
} from "../../_actions/article-actions.ts";
import {
  StatusBadge,
  TRANSLATION_STATUS_TONE,
  statusTone,
} from "../../_components/status-badge.tsx";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";
import { ContentStats } from "../../_components/editor/content-stats.tsx";
import { EditorSection, Field } from "../../_components/editor/editor-section.tsx";
import { SeoAnalysis } from "../../_components/editor/seo-analysis.tsx";
import { FaqPanel } from "../../_components/editor/faq-panel.tsx";
import { RelatedPanel } from "./_panels/related-panel.tsx";
import { liveHref, storedSlug } from "../../_lib/live-href.ts";
import { PublishPanel } from "./_panels/publish-panel.tsx";
import { TaxonomyPanel } from "./_panels/taxonomy-panel.tsx";
import {
  TRANSLATABLE_FIELDS,
  translatableFields,
  type ArticleData,
  type EditorLabels,
  type FaqDraft,
  type TranslationDraft,
} from "./editor-types.ts";
import { HeaderActions } from "../../_components/header-actions.tsx";

// The over-limit ink is `-interactive` (audit F-03); past the limit the
// field's own inline error says so in words as well.
function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <span
      className={`text-xs tabular-nums ${value.length > max ? "text-destructive-interactive" : "text-muted-foreground"}`}
    >
      {value.length}/{max}
    </span>
  );
}

// ADR-077 — the save action's own schema. The one addition is the video
// provider whitelist, which the service enforces through this same
// `parseVideoUrl` (the contract only shapes the URL), so the form refuses
// exactly what the server would.
const editorSchema = saveArticleSchema.extend({
  meta: updateArticleMetaSchema.extend({
    videoUrl: updateArticleMetaSchema.shape.videoUrl.refine(
      (url) => url == null || parseVideoUrl(url) !== null,
    ),
  }),
});

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
    keyTakeaways: [],
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
  takeawaysLabels,
  ai,
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
  /**
   * The AI affordances this screen may draw, or nothing at all.
   *
   * **Its PRESENCE is the availability answer** (ADR-097 #6): the page resolves
   * `getAiAvailability()` on the server, and an AI-off install passes
   * `undefined` — so no AI control renders, and no AI client code reaches this
   * bundle. A boolean would invite a `disabled` prop, which is the failure
   * `ai-degradation.test.ts` exists to catch.
   */
  ai?: {
    assistant?: { config: AiAssistantConfig; labels: AiAssistantLabels };
    seo?: { labels: AiSeoLabels };
    translate?: { labels: AiTranslateLabels };
    /** B4's Generate. The FIELD is always drawn; only this half is optional. */
    summarize?: boolean;
    /** ADR-126's brief bar and per-field menus. */
    fill?: AiFillConfig;
  };
  takeawaysLabels: TakeawaysLabels;
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
    setDrafts((d) => {
      const current = d[locale] ?? blankTranslation(locale);
      // changes-29 B3. Any edit to a TRANSLATABLE field clears the
      // machine-written flag, unless the patch is itself setting it — which is
      // what makes a human's Save write `TRANSLATED` rather than
      // `MACHINE_TRANSLATED`. The review is the promotion.
      const touchesProse = TRANSLATABLE_FIELDS.some((field) => field in patch);
      const machineTranslated =
        "machineTranslated" in patch
          ? patch.machineTranslated
          : touchesProse
            ? false
            : current.machineTranslated;
      return { ...d, [locale]: { ...current, ...patch, machineTranslated } };
    });

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

  // ADR-126: the fillable fields as plain text — the review's "current" column,
  // the empty test behind each default tick, and the prompt's context.
  const aiFill = ai?.fill;
  const aiCurrent = {
    title: tr.title,
    excerpt: tr.excerpt,
    body: htmlToBlockText(tr.body),
    seoTitle: tr.seoTitle,
    seoDescription: tr.seoDescription,
    focusKeywords: tr.focusKeywords,
    ogTitle: tr.ogTitle,
    ogDescription: tr.ogDescription,
    faq: tr.faqItems.map((item) => `${item.question}\n${item.answer}`).join("\n\n"),
    keyTakeaways: tr.keyTakeaways.join("\n"),
  };
  // ONE `setTr`: several calls in a tick would each merge from the same draft.
  const applyFill = (patch: AiFillPatch) => {
    const next: Partial<TranslationDraft> = {};
    for (const key of [
      "title",
      "excerpt",
      "body",
      "seoTitle",
      "seoDescription",
      "ogTitle",
      "ogDescription",
    ] as const) {
      const value = patch[key];
      if (typeof value === "string") next[key] = value;
    }
    // The column is one comma-separated string; the model answers a list.
    if (Array.isArray(patch.focusKeywords)) {
      next.focusKeywords = (patch.focusKeywords as string[]).join(", ");
    }
    // Generated rows carry no `id`, so the service inserts them — the same
    // shape `FaqPanel` gives a row an editor adds by hand.
    if (Array.isArray(patch.faq)) {
      next.faqItems = (patch.faq as AiFaqValue[]).map(({ question, answer }) => ({
        question,
        answer,
      }));
    }
    if (Array.isArray(patch.keyTakeaways)) next.keyTakeaways = patch.keyTakeaways as string[];
    setTr(next);
  };
  const fieldMenu = (field: keyof typeof aiCurrent) =>
    aiFill ? (
      <AiFieldMenu
        config={aiFill}
        field={field}
        locale={locale}
        current={aiCurrent}
        onApply={(value) => setTr({ [field]: value })}
      />
    ) : undefined;
  // A field that already shows a character count keeps it beside the menu.
  const withMenu = (field: keyof typeof aiCurrent, count: ReactNode) =>
    aiFill ? (
      <span className="flex items-center gap-2">
        {count}
        {fieldMenu(field)}
      </span>
    ) : (
      count
    );

  const parsedVideo = videoUrl.trim() === "" ? null : parseVideoUrl(videoUrl);
  const videoInvalid = videoUrl.trim() !== "" && parsedVideo === null;

  const derivedSlug = tr.slug || tr.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
  const publicPath = `${locale === defaultLocale ? "" : `/${locale}`}/news/${derivedSlug}`;
  const postUrl = `${siteUrl}${publicPath}`;
  // The address a reader can open today, whichever locale is on screen.
  const viewLiveHref = liveHref(
    `/news/${storedSlug(article.translations, defaultLocale)}`,
    locale,
    defaultLocale,
  );

  const buildPayload = () =>
    ({
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
        // changes-29 B4. An empty list is sent as null, which the service
        // stores as SQL NULL: "no takeaways" and "an empty list" must not be
        // two states. Blank rows an editor left behind are dropped here.
        keyTakeaways:
          tr.keyTakeaways.filter((item) => item.trim().length > 0).length > 0
            ? tr.keyTakeaways.map((item) => item.trim()).filter((item) => item.length > 0)
            : null,
        // changes-29 B3. Sent only when the text came from AI and nothing has
        // been edited since; the service reads it as
        // `MACHINE_TRANSLATED` instead of `TRANSLATED`, and the AI path has no
        // other way to write a status at all.
        ...(tr.machineTranslated ? { machineTranslated: true } : {}),
      },
    }) satisfies SaveArticleInput;

  // Validated as the payload the action receives, so every path below is a
  // path in `saveArticleSchema` (`translation.title`, `meta.categoryId`, …).
  const form = useFieldErrors(editorSchema, buildPayload());

  /**
   * The screen had TWO publish buttons, each doing half the job: this header
   * read "Update & Publish" but only ever called `saveArticleAction`, while
   * the publish panel's "Publish now" only called `transitionArticleAction`.
   * So saving a draft left it a draft, and publishing with unsaved edits
   * shipped the LAST-SAVED body to readers. `submitForm` is the one
   * operation both of them now run.
   *
   * The two calls are SEQUENCED, not merged: publishing still goes through
   * `transitionArticle`, so its own permission gate
   * (`articleKindPermission(kind, "publish")`) and `assertArticleTransition`
   * are untouched. That gate was the real reason the panel's comment gave for
   * keeping them apart, and it survives intact — what does not survive is a
   * button whose label promised a publish it never performed.
   */
  const submitForm = async (
    thenTransitionTo?: "PUBLISHED" | "SCHEDULED",
    scheduledForIso?: string,
  ) => {
    await saveArticleAction(buildPayload());
    if (thenTransitionTo) {
      await transitionArticleAction(article.id, thenTransitionTo, scheduledForIso);
    }
  };

  /**
   * Whether the header's primary button publishes as well as saves — and so
   * whether it reads "Publish" or "Update". Only from DRAFT: a SCHEDULED post
   * already has a publish plan, and fixing a typo on one must not quietly
   * cancel that schedule by going live early.
   */
  const headerPublishes =
    article.status === "DRAFT" && canPublish && article.legalTransitions.includes("PUBLISHED");

  const save = () => {
    if (!form.validate()) return;
    run(() => submitForm(headerPublishes ? "PUBLISHED" : undefined), {
      successMessage: headerPublishes ? labels.publishedToast : labels.saved,
    });
  };

  const dateFmt = useMemo(() => labels.createdValue, [labels.createdValue]);

  return (
    // `min-w-0` all the way down the tree from here. A grid/flex child's
    // default `min-width: auto` means "as wide as my widest unbreakable
    // content", so ONE pasted 400-character URL in the body used to widen
    // the left track, push the 22rem sidebar off screen and put the entire
    // page into horizontal scroll (changes-10 item 9). Each level has to
    // opt out of that separately — fixing only the editor is not enough.
    <div className="flex w-full min-w-0 flex-col gap-4">
      {/* Cancel / Preview / View Live / Publish-or-Update, on the page
          heading's row (ADR-140 §3) — `EditorPage` pins that row under the
          shell's header, which is what this bar used to do on its own. */}
      <HeaderActions>
        {/* Colour is assigned by consequence, not by prominence (ADR-046):
            Cancel discards nothing and stays neutral; Preview is
            informational; the save is the one primary action on the screen.
            The lifecycle buttons that DO destroy live at the publish panel,
            where their own colours are. */}
        <Button variant="ghost" render={<Link href="/keystone/articles" />}>
          {labels.cancel}
        </Button>
        <Button
          variant="info"
          render={<a href={`/news/preview/${article.id}`} target="_blank" rel="noreferrer" />}
        >
          <Eye data-icon="inline-start" aria-hidden />
          {labels.previewDraft}
        </Button>
        {article.status === "PUBLISHED" && (
          <Button
            variant="outline"
            render={<a href={viewLiveHref} target="_blank" rel="noreferrer" />}
          >
            <ExternalLink data-icon="inline-start" aria-hidden />
            {labels.viewLive}
          </Button>
        )}
        {/* Enabled while fields are wrong: a disabled Save is silent about
            WHICH field (audit F-07). Pressing it names them instead. */}
        <Button loading={pending} onClick={save}>
          {headerPublishes ? labels.publishPost : labels.updatePost}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label={labels.openActions}>
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
                    router.push(`/keystone/articles/${id}`);
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
      </HeaderActions>

      {/* `minmax(0, 1fr)` rather than `1fr` — see the min-w-0 note above.
          `1fr` is shorthand for `minmax(auto, 1fr)`, which is exactly the
          track that grows to fit its widest child. */}
      <div className="grid grid-cols-1 min-w-0 gap-4 lg:grid-cols-(--grid-main-aside-wide)">
        {/* ── Left column ─────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-4">
          <EditorSection
            title={labels.content}
            description={labels.contentDescription}
            icon={FileText}
            accent="primary"
            actions={
              <div className="flex items-center gap-2">
                {aiFill && (
                  <AiFillButton
                    config={aiFill}
                    locale={locale}
                    current={aiCurrent}
                    withOptions
                    fieldLabels={{
                      title: labels.titleLabel,
                      excerpt: labels.excerpt,
                      body: labels.body,
                      seoTitle: labels.seoTitle,
                      seoDescription: labels.seoDescription,
                      focusKeywords: labels.focusKeywords,
                      ogTitle: labels.ogTitle,
                      ogDescription: labels.ogDescription,
                      faq: labels.faq.section,
                      keyTakeaways: takeawaysLabels.label,
                    }}
                    onApply={applyFill}
                  />
                )}
                <UiField orientation="horizontal" className="w-auto">
                  <FieldLabel className="text-xs">{labels.localeLabel}</FieldLabel>
                  <AdminCombobox
                    className="h-8 w-24"
                    value={locale}
                    onValueChange={(next) => setLocale(next || locale)}
                    options={locales.map((code) => ({ value: code, label: code }))}
                  />
                </UiField>
                <StatusBadge tone={statusTone(TRANSLATION_STATUS_TONE, tr.translationStatus)}>
                  {labels.statusLabels[tr.translationStatus] ?? tr.translationStatus}
                </StatusBadge>
                {/* changes-29 B3. Absent on the SOURCE locale — there is
                    nothing to translate from — and absent entirely when the
                    feature is off. */}
                {ai?.translate && locale !== defaultLocale && (
                  <AiTranslateButton
                    labels={ai.translate.labels}
                    sourceLocale={defaultLocale}
                    targetLocale={locale}
                    entity={{ type: "article", id: article.id }}
                    // Named fields from the SOURCE draft. Never a Prisma row,
                    // and never `slug`: a slug change writes a Redirect and is
                    // an SEO act, so it stays a human decision.
                    fields={translatableFields(drafts[defaultLocale])}
                    wouldOverwrite={
                      tr.translationStatus !== "MACHINE_TRANSLATED" &&
                      [tr.title, tr.excerpt, tr.body].some((value) => value.trim().length > 0)
                    }
                    onApply={(translated) =>
                      // `machineTranslated` rides with the patch: the SAVE is
                      // what writes the status, and any later edit to a
                      // translatable field clears the flag below.
                      setTr({ ...translated, machineTranslated: true })
                    }
                  />
                )}
              </div>
            }
            // The stats strip belongs WITH the body it measures, but below a
            // rule — it is a readout, not a field.
            footer={
              <ContentStats body={tr.body} focusKeywords={tr.focusKeywords} labels={labels.stats} />
            }
          >
            <Field
              label={labels.titleLabel}
              required
              adornment={fieldMenu("title")}
              error={form.error("translation.title")}
            >
              <Input value={tr.title} onChange={(e) => setTr({ title: e.target.value })} />
            </Field>
            <Field label={labels.slugLabel} error={form.error("translation.slug")}>
              <Input
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

            {/* Excerpt BEFORE the body (changes-22). It sat under it, which
                put a three-line field at the far side of the one control on
                this screen that can be thousands of words long — so the
                editor who writes the summary first had to scroll past the
                body to reach it, and the one who writes it last scrolled
                twice. It is also the field every card, feed and search result
                shows, which is an argument for reading it near the title. */}
            <Field
              label={labels.excerpt}
              adornment={withMenu("excerpt", <CharCount value={tr.excerpt} max={500} />)}
              error={form.error("translation.excerpt")}
            >
              <Textarea
                value={tr.excerpt}
                rows={4}
                onChange={(e) => setTr({ excerpt: e.target.value })}
              />
            </Field>

            {/* changes-29 B4. An ORDINARY content control that happens to have
                a Generate button: with AI off it is a list an editor types,
                and the public block renders identically either way. */}
            <TakeawaysField
              items={tr.keyTakeaways}
              onChange={(keyTakeaways) => setTr({ keyTakeaways })}
              labels={takeawaysLabels}
              error={form.error("translation.keyTakeaways")}
              {...(ai?.summarize
                ? {
                    ai: {
                      source: { title: tr.title, content: tr.body, locale },
                      entity: { type: "article", id: article.id },
                    },
                  }
                : {})}
            />

            <Field label={labels.body} error={form.error("translation.body")}>
              <RichTextEditor
                value={tr.body}
                onChange={(html) => setTr({ body: html })}
                labels={labels.editor}
                // Item 7: the body is the one field long enough, and edited
                // by people technical enough, to want a source view.
                allowHtmlMode
                mediaCategory="news"
                // changes-29 B1. The body is the only field the assistant is
                // wired into: it is the one long enough for drafting, expanding
                // or a tone change to mean anything.
                // The locale is the Content section's switcher, so a draft is
                // written in the language being edited.
                {...(ai?.assistant
                  ? {
                      ai: {
                        ...ai.assistant,
                        config: { ...ai.assistant.config, locale, panel: true, languages: locales },
                      },
                    }
                  : {})}
              />
            </Field>
          </EditorSection>

          {/* SEO — four tabs, matching the reference. */}
          <EditorSection
            title={labels.seoSection}
            description={labels.seoSectionDescription}
            icon={Search}
            accent="info"
            actions={
              // changes-29 B2. In the section HEADER, because it fills the whole
              // section rather than one field — and absent entirely when the
              // feature is off (ADR-097 #6).
              ai?.seo ? (
                <AiSeoButton
                  labels={ai.seo.labels}
                  entity={{ type: "article", id: article.id }}
                  current={{
                    seoTitle: tr.seoTitle,
                    seoDescription: tr.seoDescription,
                    ogTitle: tr.ogTitle,
                    ogDescription: tr.ogDescription,
                    focusKeywords: tr.focusKeywords,
                  }}
                  source={{
                    title: tr.title,
                    content: tr.body,
                    ...(tr.excerpt ? { excerpt: tr.excerpt } : {}),
                    locale,
                  }}
                  onApply={(patch) => setTr(patch)}
                />
              ) : undefined
            }
          >
            <Tabs defaultValue="basic">
              <TabsList>
                <TabsTrigger value="basic">{labels.seoTabBasic}</TabsTrigger>
                <TabsTrigger value="social">{labels.seoTabSocial}</TabsTrigger>
                <TabsTrigger value="analysis">{labels.seoTabAnalysis}</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="flex flex-col gap-3 pt-3">
                <Field
                  label={labels.seoTitle}
                  hint={labels.seoTitleHint}
                  adornment={withMenu("seoTitle", <CharCount value={tr.seoTitle} max={70} />)}
                  error={form.error("translation.seoTitle")}
                >
                  <Input
                    value={tr.seoTitle}
                    placeholder={tr.title}
                    onChange={(e) => setTr({ seoTitle: e.target.value })}
                  />
                </Field>
                <Field
                  label={labels.seoDescription}
                  hint={labels.seoDescriptionHint}
                  adornment={withMenu(
                    "seoDescription",
                    <CharCount value={tr.seoDescription} max={180} />,
                  )}
                  error={form.error("translation.seoDescription")}
                >
                  <Textarea
                    value={tr.seoDescription}
                    rows={3}
                    placeholder={tr.excerpt}
                    onChange={(e) => setTr({ seoDescription: e.target.value })}
                  />
                </Field>
                <Field
                  label={labels.focusKeywords}
                  hint={labels.focusKeywordsHint}
                  error={form.error("translation.focusKeywords")}
                >
                  <Input
                    value={tr.focusKeywords}
                    onChange={(e) => setTr({ focusKeywords: e.target.value })}
                  />
                </Field>
                <Field
                  label={labels.canonicalUrl}
                  hint={labels.canonicalUrlHint}
                  error={form.error("translation.canonicalUrl")}
                >
                  <Input
                    value={tr.canonicalUrl}
                    onChange={(e) => setTr({ canonicalUrl: e.target.value })}
                  />
                </Field>
                {/* The reference's two checkboxes are phrased positively; the
                    columns are negative (noIndex/noFollow), so they invert. */}
                <UiField orientation="horizontal">
                  <Checkbox
                    checked={!tr.noIndex}
                    onCheckedChange={(v) => setTr({ noIndex: v !== true })}
                  />
                  <FieldLabel className="font-normal">{labels.allowIndex}</FieldLabel>
                </UiField>
                <UiField orientation="horizontal">
                  <Checkbox
                    checked={!tr.noFollow}
                    onCheckedChange={(v) => setTr({ noFollow: v !== true })}
                  />
                  <FieldLabel className="font-normal">{labels.allowFollow}</FieldLabel>
                </UiField>
              </TabsContent>

              {/* changes-50: this tab IS used publicly — the article page's
                  Open Graph and X card metadata read every field here — so it
                  stays, and now says what it is for and shows the card. The
                  Advanced tab went: it only restated the Basic tab's robots
                  and canonical settings. */}
              <TabsContent value="social" className="flex flex-col gap-3 pt-3">
                <p className="text-xs text-muted-foreground">{labels.socialIntro}</p>
                <SharePreview
                  label={labels.sharePreview}
                  title={tr.ogTitle || tr.seoTitle || tr.title}
                  description={tr.ogDescription || tr.seoDescription || tr.excerpt}
                  image={tr.ogImageUrl || coverImageUrl || null}
                />
                <Field
                  label={labels.ogTitle}
                  adornment={fieldMenu("ogTitle")}
                  error={form.error("translation.ogTitle")}
                >
                  <Input
                    value={tr.ogTitle}
                    placeholder={tr.seoTitle || tr.title}
                    onChange={(e) => setTr({ ogTitle: e.target.value })}
                  />
                </Field>
                <Field
                  label={labels.ogDescription}
                  adornment={fieldMenu("ogDescription")}
                  error={form.error("translation.ogDescription")}
                >
                  <Textarea
                    value={tr.ogDescription}
                    rows={3}
                    placeholder={tr.seoDescription || tr.excerpt}
                    onChange={(e) => setTr({ ogDescription: e.target.value })}
                  />
                </Field>
                <ImageUploadField
                  label={labels.ogImageUrl}
                  value={tr.ogImageUrl || null}
                  purpose="article"
                  category="news"
                  sourceType="ARTICLE"
                  labels={labels.upload}
                  error={form.error("translation.ogImageUrl")}
                  onChange={(next) =>
                    setTr({ ogImageUrl: next?.url ?? "", ogImageAssetId: next?.id ?? null })
                  }
                />
                <Field label={labels.twitterCard}>
                  <AdminCombobox
                    value={tr.twitterCard || "summary_large_image"}
                    onValueChange={(twitterCard) => setTr({ twitterCard })}
                    options={Object.entries(labels.twitterCardOptions).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                  />
                </Field>
                <ImageUploadField
                  label={labels.twitterImage}
                  value={tr.twitterImageUrl || null}
                  purpose="article"
                  category="news"
                  sourceType="ARTICLE"
                  labels={labels.upload}
                  error={form.error("translation.twitterImageUrl")}
                  onChange={(next) =>
                    setTr({
                      twitterImageUrl: next?.url ?? "",
                      twitterImageAssetId: next?.id ?? null,
                    })
                  }
                />
              </TabsContent>

              <TabsContent value="analysis" className="pt-3">
                <SeoAnalysis
                  title={tr.seoTitle || tr.title}
                  description={tr.seoDescription || tr.excerpt}
                  body={tr.body}
                  focusKeywords={tr.focusKeywords}
                />
              </TabsContent>
            </Tabs>
          </EditorSection>

          <FaqPanel
            items={tr.faqItems}
            onChange={(faqItems) => setTr({ faqItems })}
            // An article FAQ row has a stable `id` the service diffs against
            // the stored rows, so it has to survive an edit (ADR-069 moved
            // this panel and made that the host’s call).
            makeItem={(fields, previous) => ({
              ...(previous?.id ? { id: previous.id } : {}),
              ...fields,
            })}
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
            validate={form.validate}
            submitForm={submitForm}
            labels={labels.publish}
          />

          <TaxonomyPanel
            categories={categories}
            tags={tags}
            categoryId={categoryId}
            tagIds={tagIds}
            onCategoryChange={setCategoryId}
            onTagsChange={setTagIds}
            categoryError={form.error("meta.categoryId")}
            labels={labels.taxonomy}
          />

          <EditorSection
            title={labels.postSettings}
            description={labels.postSettingsDescription}
            icon={SlidersHorizontal}
            accent="warning"
            footer={
              <div className="flex flex-col gap-2">
                {/* Switch first, label after — all three (ADR-089). */}
                <UiField orientation="horizontal">
                  <Switch checked={isFeatured} onCheckedChange={(v) => setIsFeatured(v === true)} />
                  <FieldLabel className="font-normal">{labels.featuredPost}</FieldLabel>
                </UiField>
                <UiField orientation="horizontal">
                  <Switch checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
                  <FieldLabel className="font-normal">{labels.activeLabel}</FieldLabel>
                </UiField>
                <UiField orientation="horizontal">
                  <Switch checked={isPremium} onCheckedChange={(v) => setIsPremium(v === true)} />
                  <FieldContent>
                    <FieldLabel className="font-normal">{labels.premium}</FieldLabel>
                    <FieldDescription className="text-xs">{labels.premiumHint}</FieldDescription>
                  </FieldContent>
                </UiField>
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
                  label={labels.coverImageUrl}
                  value={coverImageUrl || null}
                  purpose="article"
                  category="news"
                  sourceType="ARTICLE"
                  labels={labels.upload}
                  error={form.error("meta.coverImageUrl")}
                  onChange={(next) => {
                    setCoverImageUrl(next?.url ?? "");
                    setCoverImageAssetId(next?.id ?? null);
                  }}
                />
              </TabsContent>
              <TabsContent value="video" className="pt-3">
                {/* Still flagged as you type, as before; a submit also
                    catches a URL that is merely too long. The provider
                    message beats the schema's generic one when both apply. */}
                <Field
                  label={labels.videoUrl}
                  hint={
                    parsedVideo ? `${parsedVideo.provider} · ${parsedVideo.videoId}` : undefined
                  }
                  error={videoInvalid ? labels.videoInvalid : form.error("meta.videoUrl")}
                >
                  <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
                </Field>
              </TabsContent>
            </Tabs>

            <div className="flex flex-col gap-1.5 border-t pt-3">
              <ImageUploadField
                label={labels.headerImage}
                value={headerImageUrl || null}
                purpose="article"
                category="news"
                sourceType="ARTICLE"
                labels={labels.upload}
                error={form.error("meta.headerImageUrl")}
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
            <Field label={labels.kind}>
              <AdminCombobox
                value={kind}
                onValueChange={(next) => setKind(next || kind)}
                options={Object.entries(labels.kinds).map(([value, label]) => ({ value, label }))}
              />
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
            <Field label={labels.sourceLabel} error={form.error("meta.source")}>
              <Input value={source} onChange={(e) => setSource(e.target.value)} />
            </Field>
            <Field label={labels.sourceUrlLabel} error={form.error("meta.sourceUrl")}>
              <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
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

/**
 * The card a shared link unfurls into (changes-50), built from the same
 * fallback chain the public article's metadata uses: share field → SEO field
 * → the post itself, and the cover when no share image is set.
 */
function SharePreview({
  label,
  title,
  description,
  image,
}: {
  label: string;
  title: string;
  description: string;
  image: string | null;
}) {
  return (
    <figure className="flex max-w-md flex-col gap-1.5">
      <figcaption className="text-xs font-medium text-muted-foreground">{label}</figcaption>
      <div className="overflow-hidden rounded-md border bg-card">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element -- an admin preview of an arbitrary stored URL, never optimised
          <img src={image} alt="" className="aspect-1200/630 w-full object-cover" />
        )}
        <div className="flex flex-col gap-0.5 border-t bg-muted/40 p-3">
          <p className="line-clamp-2 text-sm font-semibold">{title}</p>
          {description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    </figure>
  );
}
