"use client";

// The composer (plan §8, PR 3.3) — tree/layers panel, block picker,
// settings panel, undo/redo, autosave with a revision-based conflict
// toast, gates shown inline, a locale switcher, and "Use style / Save as
// style / Save as template". The preview pane iframes the REAL public
// route in draft mode (ADR-026 point 5, "preview is the real page") — a
// simple version here; Versions/Translations panels are PR 3.5.
import * as React from "react";
import { AlertTriangle, Monitor, Redo2, Smartphone, Tablet, Undo2 } from "lucide-react";
import type { DataBudget, LayoutTree, StoredNode } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";
import { toast } from "sonner";
import {
  checkDraftGatesAction,
  createLayoutTemplateFromNodeAction,
  createStylePresetFromNodeAction,
  saveDraftAction,
} from "../../../../../_actions/builder-actions.ts";
import { BlockPicker, type BlockPickerLabels } from "./block-picker.tsx";
import { SettingsPanel, type SettingsPanelLabels } from "./settings-panel.tsx";
import { TranslationsPanel, type TranslationsPanelLabels } from "./translations-panel.tsx";
import { TreePanel, type TreePanelLabels } from "./tree-panel.tsx";
import { VersionsPanel, type VersionsPanelLabels } from "./versions-panel.tsx";
import {
  cloneWithFreshIds,
  findNode,
  findParentId,
  genNodeId,
  insertNode,
  moveSibling,
  removeNode,
  updateNode,
} from "./tree-utils.ts";
import type {
  SectionTemplateSummary,
  SerializedBlockDefinition,
  StylePresetSummary,
} from "./types.ts";

const AUTOSAVE_DELAY_MS = 1500;
// The composer's own preview widths (plan §8/ADR-032 §3's three fixed
// breakpoints) — 0 stands in for "full width" (desktop, no fixed frame).
const PREVIEW_WIDTHS = [375, 768, 1440] as const;
type PreviewWidth = (typeof PREVIEW_WIDTHS)[number];

export interface PageBuilderLabels {
  addBlock: string;
  undo: string;
  redo: string;
  savedDraft: string;
  saving: string;
  unsavedChanges: string;
  conflictTitle: string;
  conflictBody: string;
  reloadLatest: string;
  gateErrors: string;
  gateWarnings: string;
  preview: string;
  tree: string;
  settings: string;
  empty: string;
  emptySelection: string;
  confirmDeleteBlockTitle: string;
  confirmDeleteBlockBody: string;
  confirm: string;
  cancel: string;
  save: string;
  saveAsStyleTitle: string;
  saveAsTemplateTitle: string;
  styleKeyLabel: string;
  styleNameLabel: string;
  dataPanel: string;
  dataPanelCollections: string;
  versionsButton: string;
  translationsButton: string;
  blockPicker: BlockPickerLabels;
  tree_: TreePanelLabels;
  settingsPanel: SettingsPanelLabels;
  versionsPanel: VersionsPanelLabels;
  translationsPanel: TranslationsPanelLabels;
}

function typeToKey(type: string): string {
  return type.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase();
}

export function PageBuilder({
  pageId,
  initialLayout,
  initialRevision,
  definitions,
  initialStylePresets,
  templates,
  pages,
  locales,
  defaultLocale,
  dataBudget,
  hasPublishedVersion,
  labels,
}: {
  pageId: string;
  initialLayout: LayoutTree;
  initialRevision: number;
  definitions: SerializedBlockDefinition[];
  initialStylePresets: StylePresetSummary[];
  templates: SectionTemplateSummary[];
  pages: { id: string; title: string }[];
  locales: string[];
  defaultLocale: string;
  dataBudget: DataBudget | null;
  hasPublishedVersion: boolean;
  labels: PageBuilderLabels;
}) {
  const definitionsByType = React.useMemo(
    () => new Map(definitions.map((d) => [d.type, d])),
    [definitions],
  );

  const [past, setPast] = React.useState<StoredNode[][]>([]);
  const [present, setPresent] = React.useState<StoredNode[]>(initialLayout.nodes);
  const [future, setFuture] = React.useState<StoredNode[][]>([]);
  const [revision, setRevision] = React.useState(initialRevision);
  const [stylePresets, setStylePresets] = React.useState(initialStylePresets);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [previewWidth, setPreviewWidth] = React.useState<PreviewWidth>(1440);
  const [locale, setLocale] = React.useState(defaultLocale);
  const [clipboard, setClipboard] = React.useState<StoredNode | null>(null);

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerTarget, setPickerTarget] = React.useState<{
    parentId: string | null;
    index: number;
  }>({
    parentId: null,
    index: 0,
  });
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [saveAsStyleOpen, setSaveAsStyleOpen] = React.useState(false);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = React.useState(false);
  const [versionsOpen, setVersionsOpen] = React.useState(false);
  const [translationsOpen, setTranslationsOpen] = React.useState(false);
  const [dialogKey, setDialogKey] = React.useState("");
  const [dialogName, setDialogName] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [conflict, setConflict] = React.useState<number | null>(null);
  const [gateResult, setGateResult] = React.useState<{ errors: string[]; warnings: string[] }>({
    errors: [],
    warnings: [],
  });

  function applyChange(updater: (nodes: StoredNode[]) => StoredNode[]) {
    const next = updater(present);
    // A genuine no-op (e.g. "move down" on the last sibling) returns the
    // SAME array reference (tree-utils.ts's early-return paths) — skip
    // recording history and marking dirty rather than polluting undo with
    // a no-change entry and triggering a pointless autosave.
    if (next === present) return;
    setPast((prev) => [...prev, present]);
    setPresent(next);
    setFuture([]);
    setDirty(true);
  }

  function undo() {
    setPast((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1] as StoredNode[];
      setFuture((f) => [present, ...f]);
      setPresent(previous);
      setDirty(true);
      return prev.slice(0, -1);
    });
  }

  function redo() {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[0] as StoredNode[];
      setPast((p) => [...p, present]);
      setPresent(next);
      setDirty(true);
      return prev.slice(1);
    });
  }

  // Keyboard shortcuts — Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z / Ctrl+Y.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- undo/redo close over `present`/`past`/`future` via setState updaters only
  }, []);

  // Autosave: debounced on `present` changes. Skips the very first render
  // (nothing changed yet) and stops entirely once a conflict is detected —
  // "reload latest" is the only way forward from there (ADR-032 §6, refuse-
  // on-stale, no merge).
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (conflict !== null) return;
    const timer = setTimeout(() => {
      void (async () => {
        setSaving(true);
        const layout: LayoutTree = { version: 1, nodes: present };
        const result = await saveDraftAction(pageId, layout, revision);
        setSaving(false);
        if (result.ok) {
          setRevision(result.revision);
          setDirty(false);
          const gates = await checkDraftGatesAction(layout);
          setGateResult(gates);
        } else if (result.kind === "conflict") {
          setConflict(result.currentRevision);
        } else {
          toast.error(result.message);
        }
      })();
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires on `present` only; `revision`/`pageId`/`conflict` are read fresh via closure each debounce cycle
  }, [present]);

  async function reloadLatest() {
    window.location.reload();
  }

  const selectedNode = selectedId ? findNode(present, selectedId) : null;
  const selectedDefinition = selectedNode ? definitionsByType.get(selectedNode.type) : undefined;

  // The Data panel (ADR-029 §5): what this page collects, against the
  // budget. Always 0 today — no `category: "collection"` block is
  // registered yet (Phase 4) — the count is real and wired, it simply has
  // nothing to count until then.
  const collectionCount = React.useMemo(() => {
    function count(nodes: StoredNode[]): number {
      return nodes.reduce((sum, node) => {
        const isCollection = definitionsByType.get(node.type)?.category === "collection";
        return sum + (isCollection ? 1 : 0) + count(node.children);
      }, 0);
    }
    return count(present);
  }, [present, definitionsByType]);

  function openPickerAt(parentId: string | null, index: number) {
    setPickerTarget({ parentId, index });
    setPickerOpen(true);
  }

  function newNodeFromDefinition(definition: SerializedBlockDefinition): StoredNode {
    return {
      type: definition.type,
      version: definition.version,
      id: genNodeId(),
      props: definition.defaults,
      hidden: false,
      children: [],
    };
  }

  function handlePickBlock(definition: SerializedBlockDefinition) {
    const node = newNodeFromDefinition(definition);
    applyChange((nodes) => insertNode(nodes, pickerTarget.parentId, pickerTarget.index, node));
    setSelectedId(node.id);
  }

  function handlePickTemplate(template: SectionTemplateSummary) {
    const raw = template.layout as StoredNode | LayoutTree;
    const node = cloneWithFreshIds(
      "nodes" in raw ? (raw.nodes[0] as StoredNode) : (raw as StoredNode),
    );
    applyChange((nodes) => insertNode(nodes, pickerTarget.parentId, pickerTarget.index, node));
    setSelectedId(node.id);
  }

  function handleDuplicate(id: string) {
    const node = findNode(present, id);
    if (!node) return;
    const copy = cloneWithFreshIds(node);
    const parentId = findParentId(present, id);
    const siblings = parentId ? (findNode(present, parentId)?.children ?? []) : present;
    const index = siblings.findIndex((n) => n.id === id);
    // Insert right after the original, at the same level.
    applyChange((nodes) => insertNode(nodes, parentId, index + 1, copy));
  }

  function handleDelete(id: string) {
    setDeleteTargetId(id);
  }

  function confirmDelete() {
    if (!deleteTargetId) return;
    applyChange((nodes) => removeNode(nodes, deleteTargetId));
    if (selectedId === deleteTargetId) setSelectedId(null);
    setDeleteTargetId(null);
  }

  function handleToggleHidden(id: string) {
    applyChange((nodes) => updateNode(nodes, id, (node) => ({ ...node, hidden: !node.hidden })));
  }

  function handleCopy(id: string) {
    const node = findNode(present, id);
    if (node) setClipboard(node);
  }

  function handlePaste(parentId: string) {
    if (!clipboard) return;
    const copy = cloneWithFreshIds(clipboard);
    applyChange((nodes) => {
      const parent = findNode(nodes, parentId);
      const index = parent ? parent.children.length : nodes.length;
      return insertNode(nodes, parentId, index, copy);
    });
  }

  function handlePasteAtRoot() {
    if (!clipboard) return;
    const copy = cloneWithFreshIds(clipboard);
    applyChange((nodes) => insertNode(nodes, null, nodes.length, copy));
  }

  async function handleSaveAsStyle() {
    if (!selectedNode) return;
    const preset = selectedNode.style?.presetId
      ? stylePresets.find((p) => p.id === selectedNode.style?.presetId)
      : undefined;
    const config = {
      style: { ...preset?.config.style, ...selectedNode.style?.overrides },
      motion: { ...preset?.config.motion, ...selectedNode.motion },
    };
    const id = await createStylePresetFromNodeAction({
      key: dialogKey,
      name: dialogName,
      scope: selectedNode.type,
      config,
    });
    setStylePresets((prev) => [...prev, { id, key: dialogKey, name: dialogName, config }]);
    applyChange((nodes) =>
      updateNode(nodes, selectedNode.id, (node) => ({ ...node, style: { presetId: id } })),
    );
    setSaveAsStyleOpen(false);
    setDialogKey("");
    setDialogName("");
    toast.success(labels.savedDraft);
  }

  async function handleSaveAsTemplate() {
    if (!selectedNode) return;
    await createLayoutTemplateFromNodeAction({
      key: dialogKey,
      name: dialogName,
      kind: selectedNode.children.length > 0 ? "SECTION" : "BLOCK",
      layout: selectedNode,
    });
    setSaveAsTemplateOpen(false);
    setDialogKey("");
    setDialogName("");
    toast.success(labels.savedDraft);
  }

  function handleChangeTranslation(
    nodeId: string,
    translationLocale: string,
    field: string,
    value: string,
  ) {
    applyChange((nodes) =>
      updateNode(nodes, nodeId, (node) => ({
        ...node,
        translations: {
          ...node.translations,
          [translationLocale]: {
            ...(node.translations?.[translationLocale] ?? {}),
            [field]: value,
          },
        },
      })),
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-2">
      <div className="flex items-center justify-between gap-2 rounded-md border bg-card p-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title={labels.undo}
            disabled={past.length === 0}
            onClick={undo}
          >
            <Undo2 aria-hidden className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title={labels.redo}
            disabled={future.length === 0}
            onClick={redo}
          >
            <Redo2 aria-hidden className="size-4" />
          </Button>
          <BlockPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            definitions={definitions}
            templates={templates}
            onPickBlock={handlePickBlock}
            onPickTemplate={handlePickTemplate}
            labels={labels.blockPicker}
          />
          <Button type="button" size="sm" onClick={() => openPickerAt(null, present.length)}>
            {labels.blockPicker.addBlock}
          </Button>
          {clipboard && (
            <Button type="button" variant="outline" size="sm" onClick={handlePasteAtRoot}>
              {labels.tree_.paste}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setVersionsOpen(true)}>
            {labels.versionsButton}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTranslationsOpen(true)}
          >
            {labels.translationsButton}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {dataBudget && (
            <span
              className={cn(
                "text-xs",
                collectionCount > dataBudget.page.collections.block
                  ? "font-medium text-destructive"
                  : collectionCount > dataBudget.page.collections.warn
                    ? "font-medium text-amber-600 dark:text-amber-500"
                    : "text-muted-foreground",
              )}
              title={labels.dataPanel}
            >
              {labels.dataPanelCollections}: {collectionCount} / {dataBudget.page.collections.block}
            </span>
          )}
          {locales.length > 1 && (
            <Select value={locale} onValueChange={(v) => v && setLocale(v)}>
              <SelectTrigger size="sm">
                <SelectValue>{locale}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {locales.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className="text-xs text-muted-foreground">
            {saving ? labels.saving : dirty ? labels.unsavedChanges : labels.savedDraft}
          </span>
        </div>
      </div>

      {conflict !== null && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <div>
            <p className="font-medium">{labels.conflictTitle}</p>
            <p className="text-muted-foreground">{labels.conflictBody}</p>
          </div>
          <Button type="button" size="sm" onClick={reloadLatest}>
            {labels.reloadLatest}
          </Button>
        </div>
      )}

      {(gateResult.errors.length > 0 || gateResult.warnings.length > 0) && (
        <div className="flex flex-col gap-1 rounded-md border p-2 text-xs">
          {gateResult.errors.map((message, i) => (
            <p key={i} className="flex items-center gap-1.5 text-destructive">
              <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
              {message}
            </p>
          ))}
          {gateResult.warnings.map((message, i) => (
            <p key={i} className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
              <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
              {message}
            </p>
          ))}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr_320px] gap-2">
        <div className="flex flex-col overflow-y-auto rounded-md border bg-card p-2">
          <h2 className="mb-1 px-1 text-xs font-semibold uppercase text-muted-foreground">
            {labels.tree}
          </h2>
          <TreePanel
            nodes={present}
            definitions={definitionsByType}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMoveUp={(id) => applyChange((nodes) => moveSibling(nodes, id, "up"))}
            onMoveDown={(id) => applyChange((nodes) => moveSibling(nodes, id, "down"))}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onToggleHidden={handleToggleHidden}
            onCopy={handleCopy}
            onPaste={handlePaste}
            hasClipboard={clipboard !== null}
            labels={labels.tree_}
            empty={labels.empty}
          />
        </div>

        <div className="flex flex-col overflow-hidden rounded-md border bg-muted/20">
          <div className="flex items-center justify-center gap-1 border-b bg-card p-1">
            {PREVIEW_WIDTHS.map((width) => (
              <Button
                key={width}
                type="button"
                variant={previewWidth === width ? "secondary" : "ghost"}
                size="icon-sm"
                title={`${width}px`}
                onClick={() => setPreviewWidth(width)}
              >
                {width === 375 ? (
                  <Smartphone aria-hidden className="size-4" />
                ) : width === 768 ? (
                  <Tablet aria-hidden className="size-4" />
                ) : (
                  <Monitor aria-hidden className="size-4" />
                )}
              </Button>
            ))}
          </div>
          <div className="flex flex-1 items-start justify-center overflow-auto p-2">
            <PreviewFrame
              pageId={pageId}
              locale={locale}
              revision={revision}
              width={previewWidth}
            />
          </div>
        </div>

        <div className="flex flex-col overflow-y-auto rounded-md border bg-card p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            {labels.settings}
          </h2>
          {selectedNode && selectedDefinition ? (
            <SettingsPanel
              node={selectedNode}
              definition={selectedDefinition}
              locale={locale}
              defaultLocale={defaultLocale}
              onUpdate={(updater) =>
                applyChange((nodes) => updateNode(nodes, selectedNode.id, updater))
              }
              pages={pages}
              stylePresets={stylePresets}
              onSaveAsStyle={() => {
                setDialogKey(typeToKey(selectedNode.type));
                setDialogName("");
                setSaveAsStyleOpen(true);
              }}
              onSaveAsTemplate={() => {
                setDialogKey(typeToKey(selectedNode.type));
                setDialogName("");
                setSaveAsTemplateOpen(true);
              }}
              labels={labels.settingsPanel}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{labels.emptySelection}</p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title={labels.confirmDeleteBlockTitle}
        description={labels.confirmDeleteBlockBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={confirmDelete}
      />

      <Dialog open={saveAsStyleOpen} onOpenChange={setSaveAsStyleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labels.saveAsStyleTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{labels.styleKeyLabel}</Label>
              <Input value={dialogKey} onChange={(e) => setDialogKey(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{labels.styleNameLabel}</Label>
              <Input value={dialogName} onChange={(e) => setDialogName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveAsStyleOpen(false)}>
              {labels.cancel}
            </Button>
            <Button
              type="button"
              disabled={!dialogKey || !dialogName}
              onClick={() => void handleSaveAsStyle()}
            >
              {labels.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveAsTemplateOpen} onOpenChange={setSaveAsTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labels.saveAsTemplateTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{labels.styleKeyLabel}</Label>
              <Input value={dialogKey} onChange={(e) => setDialogKey(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{labels.styleNameLabel}</Label>
              <Input value={dialogName} onChange={(e) => setDialogName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveAsTemplateOpen(false)}>
              {labels.cancel}
            </Button>
            <Button
              type="button"
              disabled={!dialogKey || !dialogName}
              onClick={() => void handleSaveAsTemplate()}
            >
              {labels.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VersionsPanel
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        pageId={pageId}
        hasPublishedVersion={hasPublishedVersion}
        onRestored={() => window.location.reload()}
        labels={labels.versionsPanel}
      />
      <TranslationsPanel
        open={translationsOpen}
        onOpenChange={setTranslationsOpen}
        nodes={present}
        definitions={definitionsByType}
        locales={locales}
        defaultLocale={defaultLocale}
        onChangeTranslation={handleChangeTranslation}
        labels={labels.translationsPanel}
      />
    </div>
  );
}

function PreviewFrame({
  pageId,
  locale,
  revision,
  width,
}: {
  pageId: string;
  locale: string;
  revision: number;
  width: PreviewWidth;
}) {
  // `revision` in the query string busts the iframe's own cache after
  // every autosave — the src otherwise never changes, so the iframe would
  // never reload. Real draft-mode preview (ADR-026 point 5): this hits the
  // same `/api/preview` → real public route path.
  const src = `/api/preview?pageId=${encodeURIComponent(pageId)}&locale=${encodeURIComponent(locale)}&r=${revision}`;
  return (
    <iframe
      key={locale}
      src={src}
      title="Preview"
      className="h-[calc(100vh-14rem)] min-h-96 shrink-0 border-0"
      style={{ width }}
    />
  );
}
