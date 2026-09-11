"use client";

// Related Posts + Related Posts Settings (changes-07 §1.2 items 4–5).
//
// Curation is stored as ContentRelation rows, in the order shown here. The
// public page falls back to the automatic by-shared-tags list when nothing is
// curated (PR 3), so an empty panel is not an empty strip on the site.

import { ChevronDown, ChevronUp, Link2, Settings2, X } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { Switch } from "@repo/ui/components/switch";
import { AdminCombobox } from "../../../_components/combobox.tsx";
import { EditorSection, Field } from "../../../_components/editor/editor-section.tsx";

export interface RelatedLabels {
  section: string;
  description: string;
  countSuffix: string;
  hint: string;
  emptyTitle: string;
  emptyBody: string;
  addLabel: string;
  addPlaceholder: string;
  remove: string;
  moveUp: string;
  moveDown: string;
  settingsSection: string;
  settingsDescription: string;
  showRelated: string;
  relatedCount: string;
  postsSuffix: string;
}

function move(list: string[], from: number, to: number): string[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

export function RelatedPanel({
  selected,
  options,
  showRelated,
  relatedCount,
  onSelectedChange,
  onShowRelatedChange,
  onRelatedCountChange,
  labels,
}: {
  selected: string[];
  options: { id: string; title: string }[];
  showRelated: boolean;
  relatedCount: number;
  onSelectedChange: (ids: string[]) => void;
  onShowRelatedChange: (value: boolean) => void;
  onRelatedCountChange: (value: number) => void;
  labels: RelatedLabels;
}) {
  const byId = new Map(options.map((o) => [o.id, o.title]));
  const available = options.filter((o) => !selected.includes(o.id));

  return (
    <>
      <EditorSection
        title={`${labels.section} (${selected.length})`}
        description={labels.description}
        icon={Link2}
        accent="info"
      >
        {selected.length === 0 ? (
          <Empty className="border-none">
            <EmptyMedia>
              <Link2 aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
            <EmptyDescription>{labels.emptyBody}</EmptyDescription>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {selected.map((id, index) => (
              <li key={id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                <span className="flex-1 truncate text-sm">{byId.get(id) ?? id}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={labels.moveUp}
                  disabled={index === 0}
                  onClick={() => onSelectedChange(move(selected, index, index - 1))}
                >
                  <ChevronUp aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={labels.moveDown}
                  disabled={index === selected.length - 1}
                  onClick={() => onSelectedChange(move(selected, index, index + 1))}
                >
                  <ChevronDown aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={labels.remove}
                  onClick={() => onSelectedChange(selected.filter((s) => s !== id))}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {available.length > 0 && selected.length < 12 && (
          <Field id="related-add" label={labels.addLabel} hint={labels.hint}>
            <AdminCombobox
              id="related-add"
              value=""
              placeholder={labels.addPlaceholder}
              onValueChange={(v) => {
                if (v) onSelectedChange([...selected, v]);
              }}
              options={available.map((o) => ({ value: o.id, label: o.title }))}
            />
          </Field>
        )}
      </EditorSection>

      <EditorSection
        title={labels.settingsSection}
        description={labels.settingsDescription}
        icon={Settings2}
        accent="neutral"
      >
        <label className="flex items-center justify-between gap-2 text-sm">
          {labels.showRelated}
          <Switch checked={showRelated} onCheckedChange={(v) => onShowRelatedChange(v === true)} />
        </label>
        <Field id="related-count" label={labels.relatedCount}>
          <AdminCombobox
            id="related-count"
            value={String(relatedCount)}
            onValueChange={(v) => onRelatedCountChange(Number(v) || 3)}
            options={[1, 2, 3, 4, 6, 8, 12].map((n) => ({
              value: String(n),
              label: `${n} ${labels.postsSuffix}`,
            }))}
          />
        </Field>
      </EditorSection>
    </>
  );
}
