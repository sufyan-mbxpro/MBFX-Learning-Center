"use client";

// Translations tab (plan §8, PR 3.5) — every translatable prop × locale
// in one table, edited in place (the translator's view; the per-block
// settings panel's own locale switcher, PR 3.3, is the designer's view of
// the same data). Scoped down from the plan's MISSING/OUTDATED badges to
// MISSING only: OUTDATED needs a source-content hash recorded per save
// (the pattern articles/glossary already use, `computeSourceHash`) that
// nothing in the node envelope carries today — a real, separate piece of
// work, named rather than faked with an always-false badge.
import * as React from "react";
import type { StoredNode } from "@repo/contracts";
import { Badge } from "@repo/ui/components/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";
import { Textarea } from "@repo/ui/components/textarea";
import type { SerializedBlockDefinition } from "./types.ts";

export interface TranslationsPanelLabels {
  title: string;
  description: string;
  empty: string;
  close: string;
  missing: string;
  block: string;
  field: string;
}

interface Row {
  nodeId: string;
  blockLabel: string;
  fieldPath: string;
  fieldLabel: string;
  baseValue: string;
}

function flatten(nodes: StoredNode[]): StoredNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

export function TranslationsPanel({
  open,
  onOpenChange,
  nodes,
  definitions,
  locales,
  defaultLocale,
  onChangeTranslation,
  labels,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  nodes: StoredNode[];
  definitions: Map<string, SerializedBlockDefinition>;
  locales: string[];
  defaultLocale: string;
  onChangeTranslation: (nodeId: string, locale: string, field: string, value: string) => void;
  labels: TranslationsPanelLabels;
}) {
  const otherLocales = locales.filter((l) => l !== defaultLocale);

  const rows: Row[] = React.useMemo(() => {
    const out: Row[] = [];
    for (const node of flatten(nodes)) {
      const definition = definitions.get(node.type);
      if (!definition) continue;
      const props = (node.props ?? {}) as Record<string, unknown>;
      for (const field of definition.fields) {
        if (!field.translatable) continue;
        const baseValue = props[field.path];
        if (typeof baseValue !== "string") continue; // array-shaped translatable props (faq/tabs items) aren't editable cell-by-cell here
        out.push({
          nodeId: node.id,
          blockLabel: node.label || definition.label,
          fieldPath: field.path,
          fieldLabel: field.label,
          baseValue,
        });
      }
    }
    return out;
  }, [nodes, definitions]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" className="w-full max-w-3xl" closeLabel={labels.close}>
        <SheetHeader>
          <SheetTitle>{labels.title}</SheetTitle>
          <SheetDescription>{labels.description}</SheetDescription>
        </SheetHeader>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.empty}</p>
        ) : (
          <div className="flex flex-col gap-4 overflow-x-auto">
            {rows.map((row) => (
              <div
                key={`${row.nodeId}:${row.fieldPath}`}
                className="flex flex-col gap-2 rounded-md border p-3"
              >
                <p className="text-xs text-muted-foreground">
                  {labels.block}:{" "}
                  <span className="font-medium text-foreground">{row.blockLabel}</span>
                  {" · "}
                  {labels.field}:{" "}
                  <span className="font-medium text-foreground">{row.fieldLabel}</span>
                </p>
                <p className="rounded bg-muted/40 p-2 text-sm">{row.baseValue}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {otherLocales.map((locale) => {
                    const node = flatten(nodes).find((n) => n.id === row.nodeId);
                    const translation = node?.translations?.[locale] as
                      Record<string, unknown> | undefined;
                    const value = translation?.[row.fieldPath];
                    const isMissing = typeof value !== "string" || value.trim() === "";
                    return (
                      <div key={locale} className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium uppercase text-muted-foreground">
                            {locale}
                          </span>
                          {isMissing && (
                            <Badge variant="outline" className="text-[0.65rem] text-destructive">
                              {labels.missing}
                            </Badge>
                          )}
                        </div>
                        <Textarea
                          rows={2}
                          value={typeof value === "string" ? value : ""}
                          onChange={(e) =>
                            onChangeTranslation(row.nodeId, locale, row.fieldPath, e.target.value)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
