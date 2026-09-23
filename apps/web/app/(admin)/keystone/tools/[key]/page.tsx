import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { isToolKey, TOOLS } from "@repo/contracts";
import { listInstruments, listRelatedCandidates, loadTool } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { siteOrigin } from "@repo/utils";
import { richTextLabels } from "../../_components/editor-labels.ts";
import { EditorPage } from "../../_components/admin-page.tsx";
import { loadEditorAi } from "../../_lib/editor-ai.ts";
import { ToolEditor, type ToolEditorData, type ToolEditorLabels } from "./tool-editor.tsx";
import type { RelatedOption } from "./_panels/related-panel.tsx";

// The tool editor's loader (changes-25 T5).
//
// `notFound()` for a key the REGISTRY does not know — not for a key with no
// row. The set of tools is code (ADR-086 #1), so a missing row is a tool that
// has simply never been edited, and the editor opens on registry defaults
// rather than a 404.
export default async function ToolEditorPage({ params }: PageProps<"/keystone/tools/[key]">) {
  const subject = await requirePermission("tools.update");
  const t = await getTranslations("admin");
  const { key } = await params;

  if (!isToolKey(key)) notFound();

  const [tool, instruments, ai] = await Promise.all([
    loadTool(key),
    listInstruments(),
    // ADR-126: the brief bar, each field's ✨ menu, the writing assistant and
    // "Generate SEO" — each present only when its own feature is on.
    loadEditorAi(subject, {
      module: "tool",
      entity: { type: "tool", id: key },
      contentKeys: ["tools.update"],
    }),
  ]);

  // The candidates the related picker offers. Read through @repo/core, not
  // Prisma: apps/web may not import @repo/db (architecture.md #2), and the
  // type checker said so here before a reviewer had to.
  const relatedOptions: RelatedOption[] = await listRelatedCandidates();

  const data: ToolEditorData = {
    key,
    isEnabled: tool?.isEnabled ?? true,
    sortOrder: tool?.sortOrder ?? 0,
    coverAssetId: tool?.coverAssetId ?? null,
    coverUrl: tool?.coverUrl ?? null,
    config: (tool?.config as Record<string, unknown>) ?? {},
    relatedCount: tool?.relatedCount ?? TOOLS[key].defaultRelatedCount,
    showRelated: tool?.showRelated ?? true,
    locale: "en",
    title: tool?.translation?.title ?? "",
    tagline: tool?.translation?.tagline ?? "",
    intro: tool?.translation?.intro ?? "",
    body: tool?.translation?.body ?? "",
    faq: tool?.translation?.faq ?? [],
    highlights: tool?.translation?.highlights ?? [],
    seoTitle: tool?.translation?.seoTitle ?? "",
    seoDescription: tool?.translation?.seoDescription ?? "",
    seoFocusKeyword: tool?.translation?.seoFocusKeyword ?? "",
    related: tool?.related ?? [],
  };

  const labels = {
    contentSection: t("toolsAdmin.contentSection"),
    contentDescription: t("toolsAdmin.contentDescription"),
    configSection: t("toolsAdmin.configSection"),
    configDescription: t("toolsAdmin.configDescription"),
    relatedSection: t("toolsAdmin.relatedSection"),
    relatedDescription: t("toolsAdmin.relatedDescription"),
    mediaSection: t("toolsAdmin.mediaSection"),
    mediaDescription: t("toolsAdmin.mediaDescription"),
    seoSection: t("toolsAdmin.seoSection"),
    seoDescription: t("toolsAdmin.seoDescription"),
    settingsSection: t("toolsAdmin.settingsSection"),
    settingsDescription: t("toolsAdmin.settingsDescription"),
    titleField: t("toolsAdmin.titleField"),
    taglineField: t("toolsAdmin.taglineField"),
    taglineHint: t("toolsAdmin.taglineHint"),
    introField: t("toolsAdmin.introField"),
    introHint: t("toolsAdmin.introHint"),
    bodyField: t("toolsAdmin.bodyField"),
    bodyHint: t("toolsAdmin.bodyHint"),
    coverField: t("toolsAdmin.coverField"),
    seoTitleField: t("toolsAdmin.seoTitleField"),
    seoDescriptionField: t("toolsAdmin.seoDescriptionField"),
    seoKeywordField: t("toolsAdmin.seoKeywordField"),
    enabledField: t("toolsAdmin.enabledField"),
    enabledHint: t("toolsAdmin.enabledHint"),
    showRelatedField: t("toolsAdmin.showRelatedField"),
    relatedCountField: t("toolsAdmin.relatedCountField"),
    relatedCountHint: t("toolsAdmin.relatedCountHint"),
    editor: richTextLabels(t),
    save: t("save"),
    viewLive: t("viewLive"),
    enabledBadge: t("toolsAdmin.enabled"),
    disabledBadge: t("toolsAdmin.disabled"),
    saved: t("saved"),
    // Config panel
    defaultAccountCurrency: t("toolsAdmin.config.defaultAccountCurrency"),
    defaultPair: t("toolsAdmin.config.defaultPair"),
    defaultRisk: t("toolsAdmin.config.defaultRisk"),
    minRisk: t("toolsAdmin.config.minRisk"),
    maxRisk: t("toolsAdmin.config.maxRisk"),
    pairs: t("toolsAdmin.config.pairs"),
    accountCurrencies: t("toolsAdmin.config.accountCurrencies"),
    defaultUnits: t("toolsAdmin.config.defaultUnits"),
    defaultStartBalance: t("toolsAdmin.config.defaultStartBalance"),
    decimals: t("toolsAdmin.config.decimals"),
    intervals: t("toolsAdmin.config.intervals"),
    defaultInterval: t("toolsAdmin.config.defaultInterval"),
    symbols: t("toolsAdmin.config.symbols"),
    defaultSymbol: t("toolsAdmin.config.defaultSymbol"),
    sessions: t("toolsAdmin.config.sessions"),
    sessionName: t("toolsAdmin.config.sessionName"),
    sessionCity: t("toolsAdmin.config.sessionCity"),
    sessionZone: t("toolsAdmin.config.sessionZone"),
    sessionOpen: t("toolsAdmin.config.sessionOpen"),
    sessionClose: t("toolsAdmin.config.sessionClose"),
    addSession: t("toolsAdmin.config.addSession"),
    removeSession: t("toolsAdmin.config.removeSession"),
    mediumVolumeFrom: t("toolsAdmin.config.mediumVolumeFrom"),
    highVolumeFrom: t("toolsAdmin.config.highVolumeFrom"),
    currencies: t("toolsAdmin.config.currencies"),
    defaultFrom: t("toolsAdmin.config.defaultFrom"),
    defaultTo: t("toolsAdmin.config.defaultTo"),
    defaultAmount: t("toolsAdmin.config.defaultAmount"),
    rateMarkups: t("toolsAdmin.config.rateMarkups"),
    rateMarkupsHint: t("toolsAdmin.config.rateMarkupsHint"),
    offeredRateTypes: t("toolsAdmin.config.offeredRateTypes"),
    windows: t("toolsAdmin.config.windows"),
    defaultWindow: t("toolsAdmin.config.defaultWindow"),
    instruments: t("toolsAdmin.config.instruments"),
    components: t("toolsAdmin.config.components"),
    componentsHint: t("toolsAdmin.config.componentsHint"),
    addComponent: t("toolsAdmin.config.addComponent"),
    removeComponent: t("toolsAdmin.config.removeComponent"),
    weight: t("toolsAdmin.config.weight"),
    direction: t("toolsAdmin.config.direction"),
    lookbackDays: t("toolsAdmin.config.lookbackDays"),
    riskOffBelow: t("toolsAdmin.config.riskOffBelow"),
    riskOnAbove: t("toolsAdmin.config.riskOnAbove"),
    defaultBalance: t("toolsAdmin.config.defaultBalance"),
    leverageOptions: t("toolsAdmin.config.leverageOptions"),
    defaultLeverage: t("toolsAdmin.config.defaultLeverage"),
    // Resolved on the client with the ratio, so it is passed as a raw template.
    leverageValue: t.raw("toolsAdmin.config.leverageValue") as string,
    defaultLots: t("toolsAdmin.config.defaultLots"),
    conservativeMax: t("toolsAdmin.config.conservativeMax"),
    moderateMax: t("toolsAdmin.config.moderateMax"),
    riskLevelsHint: t("toolsAdmin.config.riskLevelsHint"),
    minRecommendedRatio: t("toolsAdmin.config.minRecommendedRatio"),
    minRecommendedRatioHint: t("toolsAdmin.config.minRecommendedRatioHint"),
    none: t("toolsAdmin.config.none"),
    selectedSuffix: t("toolsAdmin.config.selectedSuffix"),
    selectAll: t("toolsAdmin.config.selectAll"),
    clearAll: t("toolsAdmin.config.clearAll"),
    filterInstruments: t("toolsAdmin.config.filterInstruments"),
    noInstrumentMatch: t("toolsAdmin.config.noInstrumentMatch"),
    manageInstruments: t("toolsAdmin.config.manageInstruments"),
    // Related panel
    relatedType: t("toolsAdmin.related.type"),
    relatedItem: t("toolsAdmin.related.item"),
    relatedAdd: t("toolsAdmin.related.add"),
    relatedRemove: t("toolsAdmin.related.remove"),
    relatedMoveUp: t("moveUp"),
    relatedMoveDown: t("moveDown"),
    relatedEmptyTitle: t("toolsAdmin.related.emptyTitle"),
    relatedEmptyBody: t("toolsAdmin.related.emptyBody"),
    relatedMissing: t("toolsAdmin.related.missing"),
    faq: {
      section: t("faqSection"),
      description: t("toolsAdmin.faqDescription"),
      emptyTitle: t("faqEmptyTitle"),
      emptyBody: t("faqEmptyBody"),
      add: t("add"),
      addFirst: t("add"),
      edit: t("edit"),
      dialogDescription: t("faqDialogDescription"),
      answerHint: t("faqAnswerHint"),
      saveItem: t("faqSaveItem"),
      unanswered: t("faqUnanswered"),
      question: t("toolsAdmin.faqQuestion"),
      answer: t("toolsAdmin.faqAnswer"),
      remove: t("remove"),
      cancel: t("cancel"),
      confirm: t("confirm"),
      confirmRemoveTitle: t("toolsAdmin.faqRemoveTitle"),
      confirmRemoveBody: t("toolsAdmin.faqRemoveBody"),
      moveUp: t("moveUp"),
      moveDown: t("moveDown"),
    },
    highlights: {
      section: t("toolsAdmin.highlights.section"),
      description: t("toolsAdmin.highlights.description"),
      emptyTitle: t("toolsAdmin.highlights.emptyTitle"),
      emptyBody: t("toolsAdmin.highlights.emptyBody"),
      add: t("add"),
      addFirst: t("add"),
      edit: t("edit"),
      dialogDescription: t("toolsAdmin.highlights.dialogDescription"),
      iconField: t("toolsAdmin.highlights.iconField"),
      titleField: t("toolsAdmin.highlights.titleField"),
      textField: t("toolsAdmin.highlights.textField"),
      textHint: t("toolsAdmin.highlights.textHint"),
      saveItem: t("toolsAdmin.highlights.saveItem"),
      remove: t("remove"),
      cancel: t("cancel"),
      confirm: t("confirm"),
      confirmRemoveTitle: t("toolsAdmin.highlights.removeTitle"),
      confirmRemoveBody: t("toolsAdmin.highlights.removeBody"),
      moveUp: t("moveUp"),
      moveDown: t("moveDown"),
      full: t("toolsAdmin.highlights.full"),
    },
    upload: {
      upload: t("uploadImage"),
      replace: t("replaceImage"),
      remove: t("removeImage"),
      uploading: t("uploading"),
      hint: t("uploadHint"),
    },
  } satisfies ToolEditorLabels;

  return (
    <EditorPage
      title={t("editorHeading.tool")}
      description={t("toolsAdmin.editorDescription")}
      backHref="/keystone/tools"
      backLabel={t("toolsAdmin.title")}
    >
      <ToolEditor
        tool={data}
        instruments={instruments.map((i) => ({
          id: i.id,
          symbol: i.symbol,
          displayName: i.displayName,
          kind: i.kind,
        }))}
        relatedOptions={relatedOptions}
        canPublish={can(subject, "tools.publish")}
        siteUrl={siteOrigin()}
        labels={labels}
        {...(ai ? { ai } : {})}
      />
    </EditorPage>
  );
}
