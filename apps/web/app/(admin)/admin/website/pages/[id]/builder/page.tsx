import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ALL_BLOCK_DEFINITIONS } from "@repo/blocks/definitions";
import {
  listLayoutTemplates,
  listParentCandidates,
  listStylePresets,
  loadDraftForEditing,
  loadPageDetail,
} from "@repo/core";
import { stylePresetConfigSchema } from "@repo/contracts";
import { routing } from "@repo/i18n/routing";
import { requirePermission } from "@repo/rbac";
import { getSetting } from "@repo/settings";
import { AdminPage } from "../../../../_components/admin-page.tsx";
import { richTextLabels } from "../../../../_components/editor-labels.ts";
import { PageBuilder, type PageBuilderLabels } from "./_builder/page-builder.tsx";
import type { SerializedBlockDefinition, StylePresetSummary } from "./_builder/types.ts";

// Module 16 Phase 3 PR 3.3 — the composer. `AdminPage`'s own chrome (site
// nav, page title bar) is skipped in favour of a tighter, full-height
// three-pane shell: a full admin page frame around a page builder leaves
// too little vertical room for the tree/preview/settings panes to be
// useful. The AdminPage frame still gets the shared top bar/sidebar toggle
// (it is full-width unconditionally since ADR-040 — the `width` prop this
// comment used to name is gone).
export default async function PageBuilderRoute({
  params,
}: PageProps<"/admin/website/pages/[id]/builder">) {
  await requirePermission("cms.pages.view");
  const { id } = await params;

  const [t, detail, draft, stylePresetRows, sectionTemplates, blockTemplates, pages, dataBudget] =
    await Promise.all([
      getTranslations(),
      loadPageDetail(id),
      loadDraftForEditing(id),
      listStylePresets(),
      listLayoutTemplates("SECTION"),
      listLayoutTemplates("BLOCK"),
      listParentCandidates(routing.defaultLocale),
      getSetting("cms.dataBudget"),
    ]);
  if (!detail || !draft) notFound();

  // Every catalog key is resolved to a plain string HERE — a Server
  // Component may only pass plain data (or a "use server" action) as a
  // prop to a Client Component, never an ordinary function like `t`
  // itself (confirmed the hard way: Next.js throws at render time).
  const definitions: SerializedBlockDefinition[] = ALL_BLOCK_DEFINITIONS.map((d) => ({
    type: d.type,
    version: d.version,
    label: t(d.labelKey),
    category: d.category,
    defaults: d.defaults,
    fields: (d.fields ?? []).map((field) => ({
      path: String(field.path),
      kind: field.kind,
      label: t(field.labelKey),
      help: field.helpKey ? t(field.helpKey) : undefined,
      options: field.options?.map((option) => ({ value: option.value, label: t(option.labelKey) })),
      translatable: field.translatable,
    })),
    translatable: (d.translatable ?? []).map(String),
    responsive: (d.responsive ?? []).map(String),
    links: (d.links ?? []).map(String),
    supports: d.supports,
  }));

  const stylePresets: StylePresetSummary[] = stylePresetRows.map((row) => {
    const parsed = stylePresetConfigSchema.safeParse(row.config);
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      config: parsed.success ? parsed.data : {},
    };
  });

  const templates = [...sectionTemplates, ...blockTemplates].map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    kind: row.kind as "SECTION" | "BLOCK",
    layout: row.layout,
  }));

  // `t` here is rooted above the namespace, so the prefix is applied at
  // the boundary rather than duplicated through the whole label set.
  const editorLabels = richTextLabels((key) => t(`admin.${key}`));

  const mediaPickerLabels = {
    choose: t("cms.builder.mediaChoose"),
    clear: t("cms.builder.mediaClear"),
    title: t("cms.builder.mediaPickerTitle"),
    search: t("cms.builder.mediaSearch"),
    upload: t("cms.builder.mediaUpload"),
    uploading: t("cms.builder.mediaUploading"),
    empty: t("cms.builder.mediaEmpty"),
  };

  const linkEditorLabels = {
    typeLabel: t("cms.builder.linkTypeLabel"),
    none: t("cms.builder.linkTypeNone"),
    url: t("cms.builder.linkTypeUrl"),
    route: t("cms.builder.linkTypeRoute"),
    page: t("cms.builder.linkTypePage"),
    anchor: t("cms.builder.linkTypeAnchor"),
    urlLabel: t("cms.builder.linkUrlLabel"),
    newTab: t("cms.builder.linkNewTab"),
    routeLabel: t("cms.builder.linkRouteLabel"),
    pageLabel: t("cms.builder.linkPageLabel"),
    anchorLabel: t("cms.builder.linkAnchorLabel"),
  };

  const styleEditorLabels = {
    useStyle: t("cms.builder.useStyle"),
    useStyleNone: t("cms.builder.useStyleNone"),
    inherit: t("cms.builder.inherit"),
    background: t("cms.builder.background"),
    backgroundNone: t("cms.builder.backgroundNone"),
    backgroundToken: t("cms.builder.backgroundToken"),
    backgroundGradient: t("cms.builder.backgroundGradient"),
    backgroundImage: t("cms.builder.backgroundImage"),
    backgroundVideo: t("cms.builder.backgroundVideo"),
    overlayTone: t("cms.builder.overlayTone"),
    overlayStrength: t("cms.builder.overlayStrength"),
    gradientFrom: t("cms.builder.gradientFrom"),
    gradientTo: t("cms.builder.gradientTo"),
    textTone: t("cms.builder.textTone"),
    padding: t("cms.builder.padding"),
    gap: t("cms.builder.gap"),
    radius: t("cms.builder.radius"),
    shadow: t("cms.builder.shadow"),
    border: t("cms.builder.border"),
    width: t("cms.builder.width"),
    entrance: t("cms.builder.entrance"),
    hover: t("cms.builder.hover"),
    media: mediaPickerLabels,
  };

  const fieldControlLabels = {
    invalidJson: t("admin.invalidJson"),
    link: linkEditorLabels,
    media: mediaPickerLabels,
    richText: editorLabels,
  };

  const settingsPanelLabels = {
    tabGeneral: t("cms.builder.tabGeneral"),
    tabStyle: t("cms.builder.tabStyle"),
    tabMotion: t("cms.builder.tabMotion"),
    tabVisibility: t("cms.builder.tabVisibility"),
    tabResponsive: t("cms.builder.tabResponsive"),
    labelField: t("cms.builder.labelField"),
    anchorField: t("cms.builder.anchorField"),
    visibilityField: t("cms.builder.visibilityField"),
    requiresFeatureField: t("cms.builder.requiresFeatureField"),
    visibilityPublic: t("cms.builder.visibilityPublic"),
    visibilityAuthenticated: t("cms.builder.visibilityAuthenticated"),
    visibilityPremium: t("cms.builder.visibilityPremium"),
    visibilityAdmin: t("cms.builder.visibilityAdmin"),
    deviceMobile: t("cms.builder.deviceMobile"),
    deviceTablet: t("cms.builder.deviceTablet"),
    deviceDesktop: t("cms.builder.deviceDesktop"),
    hide: t("cms.builder.hide"),
    fieldControl: fieldControlLabels,
    style: styleEditorLabels,
    saveAsStyle: t("cms.builder.saveAsStyle"),
    saveAsTemplate: t("cms.builder.saveAsTemplate"),
  };

  const blockPickerLabels = {
    addBlock: t("cms.builder.addBlock"),
    searchBlocks: t("cms.builder.searchBlocks"),
    noBlocks: t("cms.builder.noBlocks"),
    groupLayout: t("cms.builder.groupLayout"),
    groupContent: t("cms.builder.groupContent"),
    groupData: t("cms.builder.groupData"),
    startFromSection: t("cms.builder.startFromSection"),
  };

  const treePanelLabels = {
    linked: t("cms.builder.linkedBadge"),
    duplicate: t("cms.builder.duplicate"),
    delete: t("cms.builder.delete"),
    moveUp: t("cms.builder.moveUp"),
    moveDown: t("cms.builder.moveDown"),
    hide: t("cms.builder.hide"),
    show: t("cms.builder.show"),
    copy: t("cms.builder.copy"),
    paste: t("cms.builder.paste"),
  };

  const versionsPanelLabels = {
    title: t("cms.builder.versionsTitle"),
    description: t("cms.builder.versionsDescription"),
    empty: t("cms.builder.versionsEmpty"),
    restoreAsDraft: t("cms.builder.restoreAsDraft"),
    discardDraft: t("cms.builder.discardDraftButton"),
    confirmRestoreTitle: t("cms.builder.confirmRestoreTitle"),
    confirmRestoreBody: t("cms.builder.confirmRestoreBody"),
    confirmDiscardTitle: t("cms.builder.confirmDiscardTitle"),
    confirmDiscardBody: t("cms.builder.confirmDiscardBody"),
    cancel: t("cms.builder.cancel"),
    publishedBy: t("cms.builder.publishedBy"),
    close: t("cms.builder.cancel"),
  };

  const translationsPanelLabels = {
    title: t("cms.builder.translationsTitle"),
    description: t("cms.builder.translationsDescription"),
    empty: t("cms.builder.translationsEmpty"),
    close: t("cms.builder.cancel"),
    missing: t("cms.builder.translationsMissing"),
    block: t("cms.builder.translationsBlock"),
    field: t("cms.builder.translationsField"),
  };

  const labels: PageBuilderLabels = {
    addBlock: t("cms.builder.addBlock"),
    undo: t("cms.builder.undo"),
    redo: t("cms.builder.redo"),
    savedDraft: t("cms.builder.savedDraft"),
    saving: t("cms.builder.saving"),
    unsavedChanges: t("cms.builder.unsavedChanges"),
    conflictTitle: t("cms.builder.conflictTitle"),
    conflictBody: t("cms.builder.conflictBody"),
    reloadLatest: t("cms.builder.reloadLatest"),
    gateErrors: t("cms.builder.gateErrors"),
    gateWarnings: t("cms.builder.gateWarnings"),
    preview: t("cms.builder.preview"),
    tree: t("cms.builder.tree"),
    settings: t("cms.builder.settings"),
    empty: t("cms.builder.empty"),
    emptySelection: t("cms.builder.emptySelection"),
    confirmDeleteBlockTitle: t("cms.builder.confirmDeleteBlockTitle"),
    confirmDeleteBlockBody: t("cms.builder.confirmDeleteBlockBody"),
    confirm: t("cms.builder.confirm"),
    cancel: t("cms.builder.cancel"),
    save: t("cms.builder.save"),
    saveAsStyleTitle: t("cms.builder.saveAsStyleTitle"),
    saveAsTemplateTitle: t("cms.builder.saveAsTemplateTitle"),
    styleKeyLabel: t("cms.builder.styleKeyLabel"),
    styleNameLabel: t("cms.builder.styleNameLabel"),
    dataPanel: t("cms.builder.dataPanel"),
    dataPanelCollections: t("cms.builder.dataPanelCollections"),
    versionsButton: t("cms.builder.versionsButton"),
    translationsButton: t("cms.builder.translationsButton"),
    blockPicker: blockPickerLabels,
    tree_: treePanelLabels,
    settingsPanel: settingsPanelLabels,
    versionsPanel: versionsPanelLabels,
    translationsPanel: translationsPanelLabels,
  };

  return (
    <AdminPage title={t("cms.builder.title")}>
      <PageBuilder
        pageId={id}
        initialLayout={draft.layout}
        initialRevision={draft.revision}
        definitions={definitions}
        initialStylePresets={stylePresets}
        templates={templates}
        pages={pages}
        locales={[...routing.locales]}
        defaultLocale={routing.defaultLocale}
        dataBudget={dataBudget}
        hasPublishedVersion={detail.publishedVersionId !== null}
        labels={labels}
      />
    </AdminPage>
  );
}
