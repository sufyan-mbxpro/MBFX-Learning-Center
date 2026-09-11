"use client";

// Curated "Recommended next" courses (changes-11 PR 3.2, D17).
//
// The order in this list IS the order a learner sees — `resolveRecommendations`
// restores it explicitly, because `findMany` does not preserve `in` order and a
// curated list whose order is ignored is not a curated list. So the move
// controls here are not decoration.
//
// Unlike the curriculum tab, this panel holds a DRAFT: recommendations travel
// in `saveCourseAction`'s payload, so they commit in the same transaction as
// the course's meta and translation. `undefined` versus `[]` matters at that
// boundary — the shell sends the array only from this tab, so a save from
// Details cannot wipe what was set here.
import { ArrowDown, ArrowUp, Sparkles, X } from "lucide-react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { AdminCombobox } from "../../../../_components/combobox.tsx";
import { EditorSection } from "../../../../_components/editor/editor-section.tsx";

export interface RecommendationOption {
  id: string;
  title: string;
  trackLabel: string;
  statusLabel: string;
  /** Only PUBLISHED courses ever reach a learner; the rest are shown as
   * pickable but flagged, so an editor is not left wondering why their
   * selection never appears. */
  isPublished: boolean;
}

export interface RecommendationsLabels {
  section: string;
  sectionDescription: string;
  hint: string;
  add: string;
  emptyTitle: string;
  emptyBody: string;
  moveUp: string;
  moveDown: string;
  remove: string;
  untitled: string;
  fallbackTitle: string;
}

const MAX_RECOMMENDATIONS = 12;

export function RecommendationsPanel({
  value,
  onChange,
  options,
  fallbackPreview,
  disabled,
  labels,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options: RecommendationOption[];
  /**
   * What `resolveRecommendations` would return for this course RIGHT NOW —
   * curated entries first, then the same-track top-up. Plan §8.2 asks for it
   * so the admin sees what a learner will actually get rather than only what
   * they picked.
   */
  fallbackPreview: { id: string; title: string }[];
  disabled: boolean;
  labels: RecommendationsLabels;
}) {
  const byId = new Map(options.map((option) => [option.id, option]));
  const available = options.filter((option) => !value.includes(option.id));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const a = next[index];
    const b = next[target];
    if (a === undefined || b === undefined) return;
    next[index] = b;
    next[target] = a;
    onChange(next);
  };

  return (
    <EditorSection
      title={labels.section}
      description={labels.sectionDescription}
      icon={Sparkles}
      accent="info"
    >
      {value.length === 0 ? (
        <Empty className="border-none">
          <EmptyMedia>
            <Sparkles aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
          <EmptyDescription>{labels.emptyBody}</EmptyDescription>
        </Empty>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {value.map((id, index) => {
            const option = byId.get(id);
            return (
              <li
                key={id}
                className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2"
              >
                <span className="w-5 text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {option?.title || labels.untitled}
                </span>
                {option && !option.isPublished && (
                  <Badge variant="secondary" className="text-xs">
                    {option.statusLabel}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={labels.moveUp}
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={labels.moveDown}
                  disabled={disabled || index === value.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={labels.remove}
                  className="text-destructive"
                  disabled={disabled}
                  onClick={() => onChange(value.filter((entry) => entry !== id))}
                >
                  <X aria-hidden />
                </Button>
              </li>
            );
          })}
        </ol>
      )}

      {!disabled && available.length > 0 && value.length < MAX_RECOMMENDATIONS && (
        <AdminCombobox
          aria-label={labels.add}
          placeholder={labels.add}
          value=""
          onValueChange={(v) => (v ? onChange([...value, v]) : undefined)}
          options={available.map((option) => ({
            value: option.id,
            label: `${option.title || labels.untitled} — ${option.trackLabel}${
              option.isPublished ? "" : ` (${option.statusLabel})`
            }`,
          }))}
        />
      )}

      <p className="text-xs text-muted-foreground">{labels.hint}</p>

      <div className="flex flex-col gap-1.5 border-t pt-3">
        <p className="text-xs font-medium">{labels.fallbackTitle}</p>
        {fallbackPreview.length === 0 ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : (
          <ol className="flex flex-col gap-0.5">
            {fallbackPreview.map((course, index) => (
              <li key={course.id} className="text-xs text-muted-foreground">
                {index + 1}. {course.title || labels.untitled}
              </li>
            ))}
          </ol>
        )}
      </div>
    </EditorSection>
  );
}
