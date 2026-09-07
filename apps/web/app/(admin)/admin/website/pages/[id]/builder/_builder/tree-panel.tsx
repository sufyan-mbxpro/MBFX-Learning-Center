"use client";

// Tree/layers panel (plan §8) — nesting, a "Linked" badge for a preset'd
// node, select/hide/duplicate/delete/move/copy/paste. Reorder is up/down
// BUTTONS, not drag-and-drop: the plan's own text ("drag, as
// /admin/navigation already does") turned out to describe code that
// doesn't exist — `/admin/navigation` itself only has up/down buttons
// (verified against apps/web/app/(admin)/admin/navigation/
// menu-item-controls.tsx before writing this). Matching the ACTUAL
// shipped precedent, not the plan's inaccurate description of it, and not
// adding a new drag-and-drop dependency for one screen.
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Eye,
  EyeOff,
  Files,
  GripVertical,
  Link2,
  Trash2,
} from "lucide-react";
import type { StoredNode } from "@repo/contracts";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import type { SerializedBlockDefinition } from "./types.ts";

export interface TreePanelLabels {
  linked: string;
  duplicate: string;
  delete: string;
  moveUp: string;
  moveDown: string;
  hide: string;
  show: string;
  copy: string;
  paste: string;
}

function TreeRow({
  node,
  depth,
  definitions,
  selectedId,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onToggleHidden,
  onCopy,
  onPaste,
  hasClipboard,
  labels,
}: {
  node: StoredNode;
  depth: number;
  definitions: Map<string, SerializedBlockDefinition>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onCopy: (id: string) => void;
  onPaste: (parentId: string) => void;
  hasClipboard: boolean;
  labels: TreePanelLabels;
}) {
  const definition = definitions.get(node.type);
  const canHaveChildren = definition?.supports.children ?? false;
  const isSelected = node.id === selectedId;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => e.key === "Enter" && onSelect(node.id)}
        className={cn(
          "group flex items-center gap-1 rounded-md py-1 pe-1 text-sm hover:bg-muted/50",
          isSelected && "bg-muted",
        )}
        style={{ paddingInlineStart: `${depth * 16 + 4}px` }}
      >
        {node.children.length > 0 ? (
          <ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight aria-hidden className="size-3.5 shrink-0 text-transparent" />
        )}
        <GripVertical aria-hidden className="size-3.5 shrink-0 text-muted-foreground/50" />
        <span
          className={cn("min-w-0 flex-1 truncate", node.hidden && "text-muted-foreground italic")}
        >
          {node.label || (definition ? definition.label : node.type)}
        </span>
        {node.style?.presetId && (
          <Badge variant="outline" className="gap-1 text-[0.65rem]">
            <Link2 aria-hidden className="size-2.5" />
            {labels.linked}
          </Badge>
        )}
        <div className="hidden items-center gap-0.5 group-hover:flex">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={labels.moveUp}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp(node.id);
            }}
          >
            <ArrowUp aria-hidden className="size-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={labels.moveDown}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown(node.id);
            }}
          >
            <ArrowDown aria-hidden className="size-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={node.hidden ? labels.show : labels.hide}
            onClick={(e) => {
              e.stopPropagation();
              onToggleHidden(node.id);
            }}
          >
            {node.hidden ? (
              <EyeOff aria-hidden className="size-3" />
            ) : (
              <Eye aria-hidden className="size-3" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={labels.copy}
            onClick={(e) => {
              e.stopPropagation();
              onCopy(node.id);
            }}
          >
            <Copy aria-hidden className="size-3" />
          </Button>
          {canHaveChildren && hasClipboard && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title={labels.paste}
              onClick={(e) => {
                e.stopPropagation();
                onPaste(node.id);
              }}
            >
              <ClipboardPaste aria-hidden className="size-3" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={labels.duplicate}
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(node.id);
            }}
          >
            <Files aria-hidden className="size-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-destructive"
            title={labels.delete}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
          >
            <Trash2 aria-hidden className="size-3" />
          </Button>
        </div>
      </div>
      {node.children.map((child) => (
        <TreeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          definitions={definitions}
          selectedId={selectedId}
          onSelect={onSelect}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onToggleHidden={onToggleHidden}
          onCopy={onCopy}
          onPaste={onPaste}
          hasClipboard={hasClipboard}
          labels={labels}
        />
      ))}
    </div>
  );
}

export function TreePanel({
  nodes,
  definitions,
  selectedId,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onToggleHidden,
  onCopy,
  onPaste,
  hasClipboard,
  labels,
  empty,
}: {
  nodes: StoredNode[];
  definitions: Map<string, SerializedBlockDefinition>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onCopy: (id: string) => void;
  onPaste: (parentId: string) => void;
  hasClipboard: boolean;
  labels: TreePanelLabels;
  empty: string;
}) {
  if (nodes.length === 0) {
    return <p className="p-4 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {nodes.map((node) => (
        <TreeRow
          key={node.id}
          node={node}
          depth={0}
          definitions={definitions}
          selectedId={selectedId}
          onSelect={onSelect}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onToggleHidden={onToggleHidden}
          onCopy={onCopy}
          onPaste={onPaste}
          hasClipboard={hasClipboard}
          labels={labels}
        />
      ))}
    </div>
  );
}
